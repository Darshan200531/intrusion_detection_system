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

   // // 1. Detect Anonymous Login
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
            blockIp(ip, `Brute force FTP attempt (${ftpFailedAttempts[ip].length} failed logins)`, 'FTP');

            ftpFailedAttempts[ip] = []; // reset after alert
        }
    }

    // 3. Detect Malicious / Suspicious File Uploads
    let isMaliciousFile = false;
    let fileCategory = null;

    if (type === 'file_upload' && filename) {
        // Extract file extension cleanly
        const cleanFilename = filename.split('/').pop().split('\\').pop();
        const extMatch = cleanFilename.match(/\.([0-9a-z]+)(?:[\?#]|$)/i);
        const ext = extMatch ? extMatch[1].toLowerCase() : '';

        // Known malicious script / web shell extensions
        const webShellExts = ['php', 'phtml', 'php3', 'php4', 'php5', 'phps', 'jsp', 'asp', 'aspx', 'cgi', 'pl', 'py', 'sh', 'bash', 'rb'];
        // Executables, binaries, and installer extensions
        const execExts = ['bin', 'run', 'exe', 'elf', 'deb', 'rpm', 'appimage', 'msi', 'bat', 'cmd', 'ps1', 'vbs', 'jar', 'scr', 'hta'];
        // Obfuscation / double extension patterns (e.g. evil.php.png, attack.sh.txt)
        const isDoubleExt = /\.(php|sh|py|pl|exe|bat|bin|cmd|vbs|ps1)\.[a-z0-9]+$/i.test(cleanFilename);
        // Signature patterns commonly found in malicious payload uploads
        const isMaliciousPattern = /(webshell|c99|r57|b374k|weevely|shell|backdoor|rootkit|exploit|payload|trojan|reverse|meterpreter|malware|ransom|mimikatz)/i.test(cleanFilename);

        if (isMaliciousPattern || isDoubleExt || webShellExts.includes(ext) || execExts.includes(ext)) {
            isMaliciousFile = true;
            fileCategory = isMaliciousPattern
                ? 'Malicious Payload / Web Shell'
                : isDoubleExt
                ? 'Double Extension Evasion'
                : webShellExts.includes(ext)
                ? 'Web Shell / Script'
                : 'Executable / Binary';

            severity = (isMaliciousPattern || isDoubleExt || ['php', 'jsp', 'exe', 'bin', 'sh', 'elf'].includes(ext)) ? 'critical' : 'high';
            
            if (isMaliciousPattern) {
                reason = `Malicious pattern / exploit tool signature detected in file name (${cleanFilename})`;
            } else if (isDoubleExt) {
                reason = `Evasion attempt: double extension detected in file name (${cleanFilename})`;
            } else {
                reason = `Unauthorized ${fileCategory} file upload (.${ext})`;
            }

            detectionRule = 'Malicious File Detection';
            message = `FTP Malicious File Upload Detected: ${cleanFilename} uploaded by ${username || 'unknown'} from ${ip}. Reason: ${reason}`;
            shouldAlert = true;

            // Track repeated suspicious/malicious transfers per IP for iptables blocking threshold
            if (!ftpSuspiciousAttempts[ip]) ftpSuspiciousAttempts[ip] = [];
            ftpSuspiciousAttempts[ip].push(now);

            ftpSuspiciousAttempts[ip] = ftpSuspiciousAttempts[ip].filter(t => now - t <= rules.FTP_TIME_WINDOW_SECONDS * 1000);

            const threshold = rules.FTP_SUSPICIOUS_THRESHOLD || 3;
            if (ftpSuspiciousAttempts[ip].length >= threshold || severity === 'critical') {
                console.log(`🚨 IPTABLES BLOCK: Blocking IP ${ip} due to malicious FTP file upload (${cleanFilename})`);
                blockIp(ip, `Malicious FTP file upload: ${cleanFilename}`, 'FTP');
                message += ` [IP BLOCKED by iptables]`;
                ftpSuspiciousAttempts[ip] = [];
            }
        } else if (filesize && (filesize / (1024 * 1024)) > rules.FTP_MAX_UPLOAD_MB && severity === 'low') {
            // Detect Large File Uploads (if not already marked malicious)
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
                filename: filename ? (filename.split('/').pop().split('\\').pop()) : '',
                fullFilename: filename || '',
                action: currentAction,
                severity: severity,
                reason: reason || message,
                message: message,
                detectionRule: detectionRule,
                isMaliciousFile: isMaliciousFile,
                fileCategory: fileCategory,
                timestamp: (timestamp || new Date()).toLocaleString()
            });
        }
    } catch (err) {
        console.error("Error saving FTP log to MongoDB:", err);
    }
};

module.exports = { detectFTP, ftpDetectorEvents };
