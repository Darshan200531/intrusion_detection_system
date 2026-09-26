const express = require('express');
const router = express.Router();
const SSHLog = require('../models/SSHLog');
const FTPLog = require('../models/FTPLog');
const SMTPLog = require('../models/SMTPLog');
const FileIntegrityEvent = require('../models/FileIntegrityEvent');

// Helper to fetch and normalize logs
async function fetchNormalizedLogs(Model, serviceName, query = {}, limit = 200) {
    const logs = await Model.find(query).sort({ timestamp: -1 }).limit(limit).lean();
    return logs.map(log => ({
        _id: log._id,
        service: serviceName,
        timestamp: log.timestamp,
        sourceIp: log.sourceIp || log.filePath || '—',
        username: log.username || (log.filePath ? `File: ${log.filePath}` : ''),
        eventType: log.eventType,
        severity: (log.severity || 'low').toLowerCase(),
        message: log.message || '',
        detectionRule: log.detectionRule || serviceName + ' Rule',
        status: log.status
    }));
}

// Get unified history
router.get('/history', async (req, res) => {
    try {
        const [sshLogs, ftpLogs, smtpLogs, fimLogs] = await Promise.all([
            fetchNormalizedLogs(SSHLog, 'SSH'),
            fetchNormalizedLogs(FTPLog, 'FTP'),
            fetchNormalizedLogs(SMTPLog, 'SMTP'),
            fetchNormalizedLogs(FileIntegrityEvent, 'FIM')
        ]);
        
        // Combine and sort descending by timestamp
        const combined = [...sshLogs, ...ftpLogs, ...smtpLogs, ...fimLogs].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        // Return latest 500
        res.json(combined.slice(0, 500));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get analytics summary
router.get('/summary', async (req, res) => {
    try {
        const [sshCount, ftpCount, smtpCount, fimCount, sshAlerts, ftpAlerts, smtpAlerts, fimAlerts] = await Promise.all([
            SSHLog.countDocuments(),
            FTPLog.countDocuments(),
            SMTPLog.countDocuments(),
            FileIntegrityEvent.countDocuments(),
            SSHLog.countDocuments({ severity: { $in: ['high', 'critical'] } }),
            FTPLog.countDocuments({ severity: { $in: ['high', 'critical'] } }),
            SMTPLog.countDocuments({ severity: { $in: ['high', 'critical'] } }),
            FileIntegrityEvent.countDocuments({ severity: { $in: ['HIGH', 'CRITICAL', 'high', 'critical'] } })
        ]);

        res.json({
            totalLogs: {
                SSH: sshCount,
                FTP: ftpCount,
                SMTP: smtpCount,
                FIM: fimCount
            },
            criticalAlerts: {
                SSH: sshAlerts,
                FTP: ftpAlerts,
                SMTP: smtpAlerts,
                FIM: fimAlerts
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
