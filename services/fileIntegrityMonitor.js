const fs = require('fs');
const crypto = require('crypto');
const EventEmitter = require('events');
const fimConfig = require('../config/fimConfig');
const FileBaseline = require('../models/FileBaseline');
const FileIntegrityEvent = require('../models/FileIntegrityEvent');
const { sendEmailAlert } = require('./emailAlert');

const fimEvents = new EventEmitter();
const activeWatchers = new Map(); // filePath -> FSWatcher
const lastEventTime = new Map();   // filePath -> timestamp (debounce duplicate fs.watch events)
const fileStateCache = new Map();  // filePath -> { status, lastHash, lastChecked }

/**
 * Calculate SHA-256 hash of a file safely without storing or loading entire file into memory
 */
function calculateHash(filePath) {
    return new Promise((resolve) => {
        if (!fs.existsSync(filePath)) {
            return resolve(null);
        }

        try {
            const hash = crypto.createHash(fimConfig.algorithm || 'sha256');
            const stream = fs.createReadStream(filePath);

            stream.on('data', (chunk) => hash.update(chunk));
            stream.on('end', () => resolve(hash.digest('hex')));
            stream.on('error', (err) => {
                console.error(`⚠️ [FIM] Read error on ${filePath}: ${err.message}`);
                resolve(null);
            });
        } catch (err) {
            console.error(`⚠️ [FIM] Cannot access ${filePath}: ${err.message}`);
            resolve(null);
        }
    });
}

/**
 * Create or fetch SHA-256 trusted baseline in MongoDB
 */
async function createBaseline(filePath, forceUpdate = false) {
    try {
        const currentHash = await calculateHash(filePath);

        if (!currentHash) {
            console.warn(`⚠️ [FIM] Baseline skipped for ${filePath}: File inaccessible or missing`);
            return null;
        }

        let existing = await FileBaseline.findOne({ filePath });

        if (existing && !forceUpdate) {
            console.log(`🔒 [FIM] Existing baseline loaded for ${filePath} (${existing.hash.substring(0, 10)}...)`);
            return existing;
        }

        if (existing && forceUpdate) {
            existing.hash = currentHash;
            existing.updatedAt = new Date();
            await existing.save();
            console.log(`✅ [FIM] Baseline REBUILT for ${filePath} (${currentHash.substring(0, 10)}...)`);
            return existing;
        }

        const newBaseline = new FileBaseline({
            filePath,
            hash: currentHash,
            algorithm: 'SHA-256'
        });

        await newBaseline.save();
        console.log(`⭐ [FIM] Trusted baseline created for ${filePath} (${currentHash.substring(0, 10)}...)`);
        return newBaseline;
    } catch (err) {
        console.error(`❌ [FIM] Error creating baseline for ${filePath}: ${err.message}`);
        return null;
    }
}

/**
 * Check single file integrity against trusted baseline
 */
async function checkIntegrity(filePath) {
    try {
        const baseline = await FileBaseline.findOne({ filePath });
        const exists = fs.existsSync(filePath);

        if (!baseline) {
            if (exists) {
                await createBaseline(filePath);
                return { status: 'UNCHANGED', filePath };
            }
            return { status: 'UNACCESSIBLE', filePath };
        }

        if (!exists) {
            return {
                status: 'DELETED',
                filePath,
                oldHash: baseline.hash,
                newHash: null
            };
        }

        const currentHash = await calculateHash(filePath);

        if (!currentHash) {
            return { status: 'UNACCESSIBLE', filePath };
        }

        if (currentHash === baseline.hash) {
            return {
                status: 'UNCHANGED',
                filePath,
                hash: currentHash
            };
        } else {
            return {
                status: 'MODIFIED',
                filePath,
                oldHash: baseline.hash,
                newHash: currentHash
            };
        }
    } catch (err) {
        console.error(`❌ [FIM] Error checking integrity for ${filePath}: ${err.message}`);
        return { status: 'UNACCESSIBLE', filePath };
    }
}

/**
 * Handle debounced file change events
 */
async function handleFileChangeEvent(filePath) {
    const now = Date.now();
    const lastTime = lastEventTime.get(filePath) || 0;

    if (now - lastTime < (fimConfig.debounceMs || 500)) {
        return; // Suppress duplicate fs.watch rapid triggers
    }
    lastEventTime.set(filePath, now);

    const result = await checkIntegrity(filePath);
    const cached = fileStateCache.get(filePath);

    // Prevent redundant alerts if state hasn't changed
    if (cached && cached.status === result.status && cached.newHash === result.newHash) {
        return;
    }

    fileStateCache.set(filePath, {
        status: result.status,
        newHash: result.newHash,
        lastChecked: new Date()
    });

    if (result.status === 'MODIFIED') {
        const eventData = {
            filePath,
            eventType: 'FILE_MODIFIED',
            oldHash: result.oldHash,
            newHash: result.newHash,
            severity: 'HIGH',
            timestamp: new Date(),
            message: `File integrity violation: ${filePath} was modified!`
        };

        await saveAndBroadcastFIMEvent(eventData);
    } else if (result.status === 'DELETED') {
        const eventData = {
            filePath,
            eventType: 'FILE_DELETED',
            oldHash: result.oldHash,
            newHash: null,
            severity: 'CRITICAL',
            timestamp: new Date(),
            message: `Critical alert: Monitored file ${filePath} was deleted!`
        };

        await saveAndBroadcastFIMEvent(eventData);
    }
}

/**
 * Save FIM event to MongoDB, emit via Socket.IO, and send Email Alert if critical
 */
async function saveAndBroadcastFIMEvent(eventData) {
    try {
        const fimEventDoc = new FileIntegrityEvent(eventData);
        await fimEventDoc.save();

        console.log(`🚨 [FIM ALERT] [${eventData.severity}] ${eventData.eventType}: ${eventData.filePath}`);

        // Broadcast to dashboard
        fimEvents.emit('alert', {
            service: 'FIM',
            type: eventData.eventType,
            eventType: eventData.eventType,
            filePath: eventData.filePath,
            oldHash: eventData.oldHash,
            newHash: eventData.newHash,
            severity: eventData.severity,
            message: eventData.message,
            timestamp: eventData.timestamp.toLocaleString()
        });

        // Email Alert for HIGH and CRITICAL events
        if (eventData.severity === 'HIGH' || eventData.severity === 'CRITICAL') {
            sendEmailAlert(eventData).catch(err => console.error('FIM Email alert error:', err));
        }

        // Trigger FIM status refresh
        broadcastFIMStats();
    } catch (err) {
        console.error(`❌ [FIM] Error saving event: ${err.message}`);
    }
}

/**
 * Attach debounced real-time fs.watch listener
 */
function monitorFile(filePath) {
    if (activeWatchers.has(filePath)) {
        return;
    }

    if (!fs.existsSync(filePath)) {
        console.warn(`⚠️ [FIM] Watcher skipped for ${filePath}: File does not exist yet`);
        return;
    }

    try {
        const watcher = fs.watch(filePath, (eventType) => {
            handleFileChangeEvent(filePath);
        });

        watcher.on('error', (err) => {
            console.error(`⚠️ [FIM] Watcher error on ${filePath}: ${err.message}`);
            watcher.close();
            activeWatchers.delete(filePath);
        });

        activeWatchers.set(filePath, watcher);
        console.log(`👀 [FIM] Real-time file watcher active on: ${filePath}`);
    } catch (err) {
        console.error(`❌ [FIM] Could not set watch on ${filePath}: ${err.message}`);
    }
}

/**
 * Broadcast summary statistics to frontend
 */
async function getFIMSummaryStats() {
    try {
        const baselines = await FileBaseline.find({}).lean();
        const monitoredFiles = fimConfig.monitoredFiles || [];

        let unchangedCount = 0;
        let modifiedCount = 0;
        let deletedCount = 0;

        const fileStatuses = await Promise.all(
            monitoredFiles.map(async (fp) => {
                const check = await checkIntegrity(fp);
                if (check.status === 'UNCHANGED') unchangedCount++;
                if (check.status === 'MODIFIED') modifiedCount++;
                if (check.status === 'DELETED') deletedCount++;
                return check;
            })
        );

        const criticalAlerts = await FileIntegrityEvent.countDocuments({
            severity: { $in: ['HIGH', 'CRITICAL'] }
        });

        return {
            monitoredCount: monitoredFiles.length,
            unchangedCount,
            modifiedCount,
            deletedCount,
            criticalAlerts,
            fileStatuses,
            baselines
        };
    } catch (err) {
        console.error('Error calculating FIM stats:', err);
        return {
            monitoredCount: 0,
            unchangedCount: 0,
            modifiedCount: 0,
            deletedCount: 0,
            criticalAlerts: 0,
            fileStatuses: [],
            baselines: []
        };
    }
}

async function broadcastFIMStats() {
    try {
        const stats = await getFIMSummaryStats();
        fimEvents.emit('stats_update', stats);
    } catch (err) {
        console.error('Error broadcasting FIM stats:', err);
    }
}

/**
 * Initialize FIM Engine upon server boot
 */
async function initializeFIM() {
    console.log('\n🔒 Initializing File Integrity Monitoring (FIM)...');

    const files = fimConfig.monitoredFiles || [];

    for (const filePath of files) {
        // Create baseline if missing (does NOT overwrite existing trusted baseline)
        await createBaseline(filePath, false);
        // Attach filesystem monitor
        monitorFile(filePath);
    }

    const summary = await getFIMSummaryStats();
    console.log(`✅ [FIM] Monitoring ${summary.monitoredCount} file(s) | Unchanged: ${summary.unchangedCount} | Modified: ${summary.modifiedCount} | Deleted: ${summary.deletedCount}\n`);

    return summary;
}

/**
 * Force update / rebuild trusted baseline for a file
 */
async function rebuildBaseline(filePath) {
    const updated = await createBaseline(filePath, true);
    if (updated) {
        // Re-attach watcher if needed
        monitorFile(filePath);
        // Clear cached state
        fileStateCache.delete(filePath);
        await broadcastFIMStats();
    }
    return updated;
}

module.exports = {
    calculateHash,
    createBaseline,
    checkIntegrity,
    monitorFile,
    initializeFIM,
    getFIMSummaryStats,
    rebuildBaseline,
    handleFileChangeEvent,
    fimEvents
};
