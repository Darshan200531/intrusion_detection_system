const EventEmitter = require('events');
const rules = require('../services/rules');
const SMTPLog = require('../models/SMTPLog');
const { blockIp } = require('../services/blocker');

const smtpDetectorEvents = new EventEmitter();
const smtpAttempts = {};
const smtpRate = {};

const detectSMTP = async (log) => {
    if (!log) return;

    const now = Date.now();
    const { type, ip, username, msgId, size, raw, timestamp } = log;
    
    let severity = 'low';
    let message = raw || '';
    let detectionRule = null;
    let shouldAlert = true;

    // 1. Open Relay
    if (type === 'open_relay') {
        severity = 'critical';
        message = `Open relay attempt detected from ${ip || 'unknown'}`;
        detectionRule = 'Open Relay';
        shouldAlert = true;
    }

    // 2. Failed Auth
    else if (type === 'auth_failure') {
        if (!smtpAttempts[ip]) smtpAttempts[ip] = [];
        smtpAttempts[ip].push(now);
        
        // Filter by time window
        smtpAttempts[ip] = smtpAttempts[ip].filter(t => now - t <= rules.SMTP_TIME_WINDOW_SECONDS * 1000);
        
        if (smtpAttempts[ip].length >= rules.SMTP_AUTH_FAILURE_THRESHOLD) {
            severity = 'critical';
            message = `Multiple failed SMTP logins (${smtpAttempts[ip].length} attempts in ${rules.SMTP_TIME_WINDOW_SECONDS}s). IP Blocked.`;
            detectionRule = 'Brute Force SMTP';
            shouldAlert = true;

            // Trigger IP block
            console.log(`🛡️ IPTABLES BLOCK: Triggering IP block for ${ip} due to SMTP brute force`);
            blockIp(ip, message, 'SMTP');

            smtpAttempts[ip] = []; // reset after alert
        } else {
            severity = 'medium';
            message = raw || `Failed SMTP authentication attempt from ${ip || 'unknown'}`;
            detectionRule = 'Failed SMTP Login';
            shouldAlert = true;
        }
    }

    // 3. Successful Auth
    else if (type === 'auth_success') {
        severity = 'low';
        message = raw || `Successful SMTP login for ${username || 'user'} from ${ip || 'unknown'}`;
        detectionRule = 'SMTP Auth Success';
        shouldAlert = true;
    }

    // 4. Email Sent / Rate Monitoring
    else if (type === 'email_sent') {
        if (!smtpRate[ip]) smtpRate[ip] = [];
        smtpRate[ip].push(now);
        
        // Time window for rate is 1 minute
        smtpRate[ip] = smtpRate[ip].filter(t => now - t <= 60 * 1000);
        
        if (smtpRate[ip].length >= rules.SMTP_MAX_EMAILS_PER_MIN) {
            severity = 'high';
            message = `High email sending rate (${smtpRate[ip].length} emails/min from ${ip})`;
            detectionRule = 'Spam / High Rate';
            shouldAlert = true;
            smtpRate[ip] = [];
        } else if (size && (size / (1024 * 1024)) > rules.SMTP_MAX_ATTACHMENT_MB) {
            severity = 'medium';
            message = `Large email sent (${(size / (1024 * 1024)).toFixed(2)} MB) by ${ip}`;
            detectionRule = 'Large Attachment';
            shouldAlert = true;
        } else {
            severity = 'low';
            message = raw || `Email sent by ${username || 'unknown'} (Size: ${size ? (size / 1024).toFixed(1) + ' KB' : 'N/A'})`;
            detectionRule = 'Email Sent';
            shouldAlert = true;
        }
    }

    // 5. Default/Other SMTP activity
    else {
        severity = 'low';
        message = raw || `SMTP activity detected (${type})`;
        detectionRule = 'SMTP Activity';
        shouldAlert = true;
    }

    // Save to DB
    try {
        const newLog = new SMTPLog({
            timestamp: timestamp || new Date(),
            sourceIp: ip || '127.0.0.1',
            username: username || '',
            eventType: type,
            severity: severity,
            message: message,
            detectionRule: detectionRule,
            status: 'alerted'
        });
        await newLog.save();

        // Emit Alert for real-time monitoring
        console.log(`🚨 SMTP ALERT [${severity.toUpperCase()}]: ${message} | IP: ${ip || '127.0.0.1'}`);
        smtpDetectorEvents.emit('alert', {
            service: 'SMTP',
            type: type,
            eventType: type,
            ip: ip || '127.0.0.1',
            sourceIp: ip || '127.0.0.1',
            username: username || '',
            severity: severity,
            message: message,
            detectionRule: detectionRule,
            timestamp: (timestamp || new Date()).toLocaleString()
        });
    } catch (err) {
        console.error("Error saving SMTP log:", err);
    }
};

module.exports = { detectSMTP, smtpDetectorEvents };
