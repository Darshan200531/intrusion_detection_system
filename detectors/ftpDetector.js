const EventEmitter = require('events');
const rules = require('../services/rules');
const FTPLog = require('../models/FTPLog');

const ftpDetectorEvents = new EventEmitter();
const ftpAttempts = {};

const detectFTP = async (log) => {
    if (!log) return;
    
    const now = Date.now();
    const { type, ip, username, filename, filesize, raw, timestamp } = log;
    
    let severity = 'low';
    let message = raw;
    let detectionRule = null;
    let shouldAlert = false;

    // Detect Anonymous Login
    if (type === 'anonymous_login') {
        severity = 'medium';
        message = `Anonymous login detected from ${ip}`;
        detectionRule = 'Anonymous Login';
        shouldAlert = true;
    }

    // Detect Failed Login
    if (type === 'failed_login') {
        if (!ftpAttempts[ip]) ftpAttempts[ip] = [];
        ftpAttempts[ip].push(now);
        
        // Filter by time window
        ftpAttempts[ip] = ftpAttempts[ip].filter(t => now - t <= rules.FTP_TIME_WINDOW_SECONDS * 1000);
        
        if (ftpAttempts[ip].length >= rules.FTP_FAILED_LOGIN_THRESHOLD) {
            severity = 'high';
            message = `Multiple failed FTP logins (${ftpAttempts[ip].length} attempts in ${rules.FTP_TIME_WINDOW_SECONDS}s)`;
            detectionRule = 'Brute Force FTP';
            shouldAlert = true;
            ftpAttempts[ip] = []; // reset after alert
        }
    }

    // Detect Suspicious File Uploads
    if (type === 'file_upload') {
        const extMatch = filename.match(/\.([0-9a-z]+)(?:[\?#]|$)/i);
        if (extMatch) {
            const ext = extMatch[1].toLowerCase();
            const suspiciousExts = ['php', 'exe', 'sh', 'bat'];
            if (suspiciousExts.includes(ext)) {
                severity = 'critical';
                message = `Suspicious file uploaded: ${filename}`;
                detectionRule = 'Malicious File Upload';
                shouldAlert = true;
            }
        }
        
        // Detect Large File Uploads
        if (filesize && (filesize / (1024 * 1024)) > rules.FTP_MAX_UPLOAD_MB) {
            severity = 'medium';
            message = `Large file uploaded: ${filename} (${(filesize / (1024 * 1024)).toFixed(2)} MB)`;
            detectionRule = 'Large File Upload';
            shouldAlert = true;
        }
    }

    // Save to DB
    try {
        const newLog = new FTPLog({
            timestamp: timestamp || new Date(),
            sourceIp: ip,
            username: username,
            eventType: type,
            severity: severity,
            message: message,
            detectionRule: detectionRule,
            status: shouldAlert ? 'alerted' : 'logged'
        });
        await newLog.save();

        // Emit Alert if required
        if (shouldAlert) {
            console.log(`🚨 FTP ALERT: ${message} | IP: ${ip}`);
            ftpDetectorEvents.emit('alert', {
                service: 'FTP',
                type: type,
                ip: ip,
                username: username,
                severity: severity,
                message: message,
                timestamp: new Date().toLocaleString()
            });
        }
    } catch (err) {
        console.error("Error saving FTP log:", err);
    }
};

module.exports = { detectFTP, ftpDetectorEvents };
