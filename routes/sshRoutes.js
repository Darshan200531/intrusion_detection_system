const express = require('express');
const router = express.Router();
const SSHLog = require('../models/SSHLog');

// Helper to normalize SSH log schema for frontend consumption
function normalizeSSHLog(log) {
    return {
        _id:           log._id,
        service:       'SSH',
        type:          log.eventType,
        eventType:     log.eventType,
        ip:            log.sourceIp,
        sourceIp:      log.sourceIp,
        username:      log.username || '',
        timestamp:     log.timestamp,
        severity:      log.severity || 'low',
        message:       log.message || '',
        detectionRule: log.detectionRule || null,
        status:        log.status || 'logged'
    };
}

// Get all SSH activity logs (latest 100)
router.get('/alerts', async (req, res) => {
    try {
        const logs = await SSHLog.find({}).sort({ timestamp: -1 }).limit(100).lean();
        res.json(logs.map(normalizeSSHLog));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Alias for history
router.get('/history', async (req, res) => {
    try {
        const logs = await SSHLog.find({}).sort({ timestamp: -1 }).limit(100).lean();
        res.json(logs.map(normalizeSSHLog));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get SSH stats for dashboard cards
router.get('/stats', async (req, res) => {
    try {
        const successCount = await SSHLog.countDocuments({ eventType: 'success_login' });
        const failedCount = await SSHLog.countDocuments({ eventType: 'failed_login' });
        const attackCount = await SSHLog.countDocuments({ eventType: { $in: ['attack', 'blocked_attempt'] } });
        const totalAlerts = await SSHLog.countDocuments({});

        res.json({
            successCount,
            failedCount,
            attackCount,
            totalAlerts
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
