const express = require('express');
const router = express.Router();
const SSHLog = require('../models/SSHLog');

// Get all SSH activity logs (latest 100)
router.get('/alerts', async (req, res) => {
    try {
        const logs = await SSHLog.find({}).sort({ timestamp: -1 }).limit(100).lean();
        res.json(logs);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Alias for backwards compatibility
router.get('/history', async (req, res) => {
    try {
        const logs = await SSHLog.find({}).sort({ timestamp: -1 }).limit(100).lean();
        res.json(logs);
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
