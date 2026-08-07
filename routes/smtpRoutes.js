const express = require('express');
const router = express.Router();
const SMTPLog = require('../models/SMTPLog');

// Get all SMTP alerts
router.get('/alerts', async (req, res) => {
    try {
        const logs = await SMTPLog.find({ status: 'alerted' }).sort({ timestamp: -1 }).limit(100);
        res.json(logs);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get SMTP stats for dashboard charts
router.get('/stats', async (req, res) => {
    try {
        const totalAlerts = await SMTPLog.countDocuments({ status: 'alerted' });
        const recentEvents = await SMTPLog.countDocuments({ 
            timestamp: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } 
        });
        
        // Group by rule
        const ruleStats = await SMTPLog.aggregate([
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
