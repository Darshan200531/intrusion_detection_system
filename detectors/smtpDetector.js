const EventEmitter = require('events');
const rules = require('../services/rules');
const SMTPLog = require('../models/SMTPLog');

const smtpDetectorEvents = new EventEmitter();
const smtpAttempts = {};
const smtpRate = {};

const detectSMTP = async (log) => {
    if (!log) return;

    const now = Date.now();
    const { type, ip, username, msgId, size, raw, timestamp } = log;
    
    let severity = 'low';
    let message = raw;
    let detectionRule = null;
    let shouldAlert = false;

    // Open Relay
    if (type === 'open_relay') {
        severity = 'critical';
        message = `Open relay attempt detected from ${ip}`;
        detectionRule = 'Open Relay';
        shouldAlert = true;
    }

    // Failed Auth
    if (type === 'auth_failure') {
        if (!smtpAttempts[ip]) smtpAttempts[ip] = [];
        smtpAttempts[ip].push(now);
        
        // Filter by time window
        smtpAttempts[ip] = smtpAttempts[ip].filter(t => now - t <= rules.SMTP_TIME_WINDOW_SECONDS * 1000);
        
        if (smtpAttempts[ip].length >= rules.SMTP_AUTH_FAILURE_THRESHOLD) {
            severity = 'high';
            message = `Multiple failed SMTP logins (${smtpAttempts[ip].length} attempts in ${rules.SMTP_TIME_WINDOW_SECONDS}s)`;
            detectionRule = 'Brute Force SMTP';
            shouldAlert = true;
            smtpAttempts[ip] = []; // reset after alert
        }
    }

    // High Email Sending Rate
    if (type === 'email_sent') {
        if (!smtpRate[ip]) smtpRate[ip] = [];
        smtpRate[ip].push(now);
        
        // Time window for rate is 1 minute (hardcoded or configured)
        smtpRate[ip] = smtpRate[ip].filter(t => now - t <= 60 * 1000);
        
        if (smtpRate[ip].length >= rules.SMTP_MAX_EMAILS_PER_MIN) {
            severity = 'high';
            message = `High email sending rate (${smtpRate[ip].length} emails/min from ${ip})`;
            detectionRule = 'Spam / High Rate';
            shouldAlert = true;
            smtpRate[ip] = [];
        }

        // Large Attachment
        if (size && (size / (1024 * 1024)) > rules.SMTP_MAX_ATTACHMENT_MB) {
            severity = 'medium';
            message = `Large email sent (${(size / (1024 * 1024)).toFixed(2)} MB) by ${ip}`;
            detectionRule = 'Large Attachment';
            shouldAlert = true;
        }
    }

    // Save to DB
    try {
        const newLog = new SMTPLog({
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
            console.log(`🚨 SMTP ALERT: ${message} | IP: ${ip}`);
            smtpDetectorEvents.emit('alert', {
                service: 'SMTP',
                type: type,
                ip: ip,
                username: username,
                severity: severity,
                message: message,
                timestamp: new Date().toLocaleString()
            });
        }
    } catch (err) {
        console.error("Error saving SMTP log:", err);
    }
};

module.exports = { detectSMTP, smtpDetectorEvents };
