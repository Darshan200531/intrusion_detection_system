const express = require('express');
const router = express.Router();
const SSHLog = require('../models/SSHLog');
const FTPLog = require('../models/FTPLog');
const SMTPLog = require('../models/SMTPLog');

// Helper to fetch and normalize logs
async function fetchNormalizedLogs(Model, serviceName, query = {}, limit = 200) {
    const logs = await Model.find(query).sort({ timestamp: -1 }).limit(limit).lean();
    return logs.map(log => ({
        _id: log._id,
        service: serviceName,
        timestamp: log.timestamp,
        sourceIp: log.sourceIp,
        username: log.username,
        eventType: log.eventType,
        severity: log.severity,
        message: log.message,
        detectionRule: log.detectionRule,
        status: log.status
    }));
}

// Get unified history
router.get('/history', async (req, res) => {
    try {
        const [sshLogs, ftpLogs, smtpLogs] = await Promise.all([
            fetchNormalizedLogs(SSHLog, 'SSH'),
            fetchNormalizedLogs(FTPLog, 'FTP'),
            fetchNormalizedLogs(SMTPLog, 'SMTP')
        ]);
        
        // Combine and sort descending by timestamp
        const combined = [...sshLogs, ...ftpLogs, ...smtpLogs].sort((a, b) => b.timestamp - a.timestamp);
        
        // Return latest 500
        res.json(combined.slice(0, 500));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get analytics summary
router.get('/summary', async (req, res) => {
    try {
        const [sshCount, ftpCount, smtpCount, sshAlerts, ftpAlerts, smtpAlerts] = await Promise.all([
            SSHLog.countDocuments(),
            FTPLog.countDocuments(),
            SMTPLog.countDocuments(),
            SSHLog.countDocuments({ severity: { $in: ['high', 'critical'] } }),
            FTPLog.countDocuments({ severity: { $in: ['high', 'critical'] } }),
            SMTPLog.countDocuments({ severity: { $in: ['high', 'critical'] } })
        ]);

        res.json({
            totalLogs: {
                SSH: sshCount,
                FTP: ftpCount,
                SMTP: smtpCount
            },
            criticalAlerts: {
                SSH: sshAlerts,
                FTP: ftpAlerts,
                SMTP: smtpAlerts
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
