const EventEmitter = require('events');
const rules = require('../services/rules');
const FTPLog = require('../models/FTPLog');
const { blockIp } = require('../services/blocker');

const ftpDetectorEvents = new EventEmitter();
const ftpFailedAttempts = {};
const ftpSuspiciousAttempts = {};

const detectFTP = async (log) => {
    if (!log) return;
    
    const now = Date.now();
    const { type, ip, username, filename, filesize, action, raw, timestamp } = log;
    
    let severity = 'low';
    let message = raw || '';
    let detectionRule = null;
    let reason = null;
    let shouldAlert = false;
    const currentAction = action || (type.includes('upload') ? 'UPLOAD' : type.includes('download') ? 'DOWNLOAD' : type.includes('login') ? 'LOGIN' : 'OTHER');

    // 1. Detect Anonymous Login
    if (type === 'anonymous_login') {
        severity = 'medium';
        reason = 'Anonymous FTP login detected';
        message = `Anonymous FTP login detected from ${ip}`;
        detectionRule = 'Anonymous Login';
        shouldAlert = true;
    }

    // 2. Detect Failed Login
    if (type === 'failed_login') {
        if (!ftpFailedAttempts[ip]) ftpFailedAttempts[ip] = [];
        ftpFailedAttempts[ip].push(now);
        
        ftpFailedAttempts[ip] = ftpFailedAttempts[ip].filter(t => now - t <= rules.FTP_TIME_WINDOW_SECONDS * 1000);
        
        if (ftpFailedAttempts[ip].length >= rules.FTP_FAILED_LOGIN_THRESHOLD) {
            severity = 'high';
            reason = `Brute force FTP attempt (${ftpFailedAttempts[ip].length} failed logins)`;
            message = `Multiple failed FTP logins (${ftpFailedAttempts[ip].length} attempts in ${rules.FTP_TIME_WINDOW_SECONDS}s)`;
            detectionRule = 'Brute Force FTP';
            shouldAlert = true;

            // Trigger iptables IP blocking for repeated failed logins
            console.log(`🛡️ IPTABLES BLOCK: Triggering IP block for ${ip} due to FTP brute force`);
            blockIp(ip);

            ftpFailedAttempts[ip] = []; // reset after alert
        }
    }

    // 3. Detect Suspicious File Uploads
    if (type === 'file_upload' && filename) {
        // Extract file extension cleanly
        const cleanFilename = filename.split('/').pop().split('\\').pop();
        const extMatch = cleanFilename.match(/\.([0-9a-z]+)(?:[\?#]|$)/i);
        
        // Suspicious extensions for Ubuntu server: .sh, .py, .pl, .rb, .php, .bin, .run, .deb, .AppImage
        const suspiciousExts = ['sh', 'py', 'pl', 'rb', 'php', 'bin', 'run', 'deb', 'appimage'];
        
        if (extMatch) {
            const ext = extMatch[1].toLowerCase();
            if (suspiciousExts.includes(ext)) {
                severity = 'high';
                reason = `Contains suspicious executable/script file extension (.${ext})`;
                message = `FTP Suspicious File Transfer: ${cleanFilename} uploaded by ${username || 'unknown'} from ${ip}. Reason: Contains suspicious executable/script file extension (.${ext})`;
                detectionRule = 'FTP Suspicious File Transfer';
                shouldAlert = true;

                // Track repeated suspicious transfers per IP for iptables blocking threshold
                if (!ftpSuspiciousAttempts[ip]) ftpSuspiciousAttempts[ip] = [];
                ftpSuspiciousAttempts[ip].push(now);

                ftpSuspiciousAttempts[ip] = ftpSuspiciousAttempts[ip].filter(t => now - t <= rules.FTP_TIME_WINDOW_SECONDS * 1000);

                const threshold = rules.FTP_SUSPICIOUS_THRESHOLD || 3;
                if (ftpSuspiciousAttempts[ip].length >= threshold) {
                    console.log(`🚨 IPTABLES BLOCK: Blocking IP ${ip} after ${ftpSuspiciousAttempts[ip].length} repeated suspicious FTP uploads`);
                    blockIp(ip);
                    severity = 'critical';
                    message += ` [IP BLOCKED by iptables]`;
                    detectionRule = 'Repeated FTP Suspicious Transfers';
                    ftpSuspiciousAttempts[ip] = [];
                }
            }
        }
        
        // Detect Large File Uploads (if not already marked suspicious)
        if (filesize && (filesize / (1024 * 1024)) > rules.FTP_MAX_UPLOAD_MB && severity === 'low') {
            severity = 'medium';
            reason = `Large file upload exceeds threshold (${rules.FTP_MAX_UPLOAD_MB}MB)`;
            message = `Large file uploaded: ${cleanFilename} (${(filesize / (1024 * 1024)).toFixed(2)} MB)`;
            detectionRule = 'Large File Upload';
            shouldAlert = true;
        }
    }

    // Save to MongoDB
    try {
        const newLog = new FTPLog({
            timestamp: timestamp || new Date(),
            sourceIp: ip,
            username: username || '',
            filename: filename || null,
            action: currentAction,
            eventType: type,
            severity: severity,
            message: message,
            reason: reason,
            detectionRule: detectionRule,
            status: shouldAlert ? 'alerted' : 'logged'
        });
        await newLog.save();

        // Emit real-time alert for dashboard
        if (shouldAlert) {
            console.log(`🚨 FTP ALERT [${severity.toUpperCase()}]: ${message} | IP: ${ip}`);
            ftpDetectorEvents.emit('alert', {
                service: 'FTP',
                type: type,
                eventType: type,
                ip: ip,
                sourceIp: ip,
                username: username || '',
                filename: filename || '',
                action: currentAction,
                severity: severity,
                reason: reason || message,
                message: message,
                detectionRule: detectionRule,
                timestamp: (timestamp || new Date()).toLocaleString()
            });
        }
    } catch (err) {
        console.error("Error saving FTP log to MongoDB:", err);
    }
};

module.exports = { detectFTP, ftpDetectorEvents };
