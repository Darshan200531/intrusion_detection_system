const express = require('express');
const router = express.Router();
const FileBaseline = require('../models/FileBaseline');
const FileIntegrityEvent = require('../models/FileIntegrityEvent');
const fimConfig = require('../config/fimConfig');
const { 
    getFIMSummaryStats, 
    rebuildBaseline, 
    handleFileChangeEvent, 
    checkIntegrity 
} = require('../services/fileIntegrityMonitor');

// Get FIM stats and summary
router.get('/stats', async (req, res) => {
    try {
        const stats = await getFIMSummaryStats();
        res.json(stats);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get FIM event history
router.get('/events', async (req, res) => {
    try {
        const events = await FileIntegrityEvent.find({})
            .sort({ timestamp: -1 })
            .limit(100)
            .lean();
        res.json(events);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get active file baselines
router.get('/baselines', async (req, res) => {
    try {
        const baselines = await FileBaseline.find({}).sort({ filePath: 1 }).lean();
        res.json(baselines);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Rebuild baseline for a file or all files
router.post('/baseline/rebuild', async (req, res) => {
    try {
        const { filePath } = req.body;
        
        if (filePath) {
            const updated = await rebuildBaseline(filePath);
            return res.json({ ok: true, message: `Baseline rebuilt for ${filePath}`, baseline: updated });
        }

        // Rebuild all configured files
        const files = fimConfig.monitoredFiles || [];
        const results = [];
        for (const f of files) {
            const up = await rebuildBaseline(f);
            if (up) results.push(up);
        }

        res.json({ ok: true, message: `Rebuilt baselines for ${results.length} files`, baselines: results });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// FIM Simulation endpoint for testing
router.post('/simulate', async (req, res) => {
    try {
        const { eventType, filePath } = req.body;
        const targetPath = filePath || (fimConfig.monitoredFiles && fimConfig.monitoredFiles[0]) || '/etc/ssh/sshd_config';

        if (eventType === 'FILE_MODIFIED') {
            const baseline = await FileBaseline.findOne({ filePath: targetPath });
            const oldHash = baseline ? baseline.hash : 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
            const fakeNewHash = 'a' + oldHash.substring(1);

            const simEvent = new FileIntegrityEvent({
                filePath: targetPath,
                eventType: 'FILE_MODIFIED',
                oldHash: oldHash,
                newHash: fakeNewHash,
                severity: 'HIGH',
                message: `[SIMULATED] File integrity violation: ${targetPath} was modified!`
            });
            await simEvent.save();
            return res.json({ ok: true, event: simEvent });
        }

        if (eventType === 'FILE_DELETED') {
            const baseline = await FileBaseline.findOne({ filePath: targetPath });
            const oldHash = baseline ? baseline.hash : 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

            const simEvent = new FileIntegrityEvent({
                filePath: targetPath,
                eventType: 'FILE_DELETED',
                oldHash: oldHash,
                newHash: null,
                severity: 'CRITICAL',
                message: `[SIMULATED] Critical alert: Monitored file ${targetPath} was deleted!`
            });
            await simEvent.save();
            return res.json({ ok: true, event: simEvent });
        }

        // Trigger live check
        await handleFileChangeEvent(targetPath);
        res.json({ ok: true, message: `Triggered live FIM check on ${targetPath}` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
