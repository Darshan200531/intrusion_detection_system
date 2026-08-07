const express = require('express');
const router = express.Router();
const FTPLog = require('../models/FTPLog');

// Get all FTP alerts
router.get('/alerts', async (req, res) => {
    try {
        const logs = await FTPLog.find({ status: 'alerted' }).sort({ timestamp: -1 }).limit(100);
        res.json(logs);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get FTP stats for dashboard charts
router.get('/stats', async (req, res) => {
    try {
        const totalAlerts = await FTPLog.countDocuments({ status: 'alerted' });
        const recentEvents = await FTPLog.countDocuments({ 
            timestamp: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } 
        });
        
        // Group by rule
        const ruleStats = await FTPLog.aggregate([
            { $match: { status: 'alerted' } },
            { $group: { _id: '$detectionRule', count: { $sum: 1 } } }
        ]);

        res.json({
            totalAlerts,
            recentEvents,
            ruleStats
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
