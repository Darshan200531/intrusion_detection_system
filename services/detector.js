const rules = require('../config/rules');
const alert = require('./alert');
const { updateTimeWindow } = require('../utils/timeWindow');
const Log = require('../models/Log');

let failedAttempts = {};

async function saveLogEntry(log) {
    if (!rules.ENABLE_DB_STORAGE) return;

    try {
        const logEntry = new Log({
            timestamp: log.timestamp,
            ip: log.ip,
            username: log.username || 'unknown',
            status: log.status,
            rawLogLine: log.raw || '',
            source: log.raw && log.raw.includes('sshd') ? 'linux-auth' : 'custom'
        });
        await logEntry.save();
    } catch (err) {
        console.error('Failed to save log entry:', err.message);
    }
}

function detect(log) {
    if (!log) return;

    const { ip, timestamp, status } = log;

    // Store every parsed log in MongoDB (fire and forget)
    saveLogEntry(log);

    // SUCCESS handling
    if (status === 'SUCCESS') {
        console.log(`✅ Successful login from IP: ${ip} at ${timestamp}`);
        failedAttempts[ip] = []; // reset on success
        return;
    }

    // FAILED handling
    if (status === 'FAILED') {
        if (!failedAttempts[ip]) {
            failedAttempts[ip] = [];
        }

        failedAttempts[ip] = updateTimeWindow(
            failedAttempts[ip],
            timestamp,
            rules.TIME_WINDOW_SECONDS
        );

        console.log(`❌ Failed login from IP: ${ip}`);

        // Threshold check
        if (failedAttempts[ip].length >= rules.FAILED_LOGIN_THRESHOLD) {
            alert.trigger(ip, failedAttempts[ip].length);
            failedAttempts[ip] = [];
        } else {
            console.log(`⚠️ ${failedAttempts[ip].length} failed attempts from ${ip}`);
        }
    }
}

module.exports = detect;
