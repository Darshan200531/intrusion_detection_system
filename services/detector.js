// Detector
const rules = require('./rules');
const { blockIp, isBlocked } = require('./blocker');
const EventEmitter = require('events');
const SSHLog = require('../models/SSHLog');

const detectorEvents = new EventEmitter();
const attempts = {};

// Helper to save log asynchronously without blocking
const saveLog = (logData) => {
    new SSHLog(logData).save().catch(err => console.error("Error saving SSH log:", err));
};

function detect(log) {
    if (!log) return;

    const now = Date.now();
    const ip = log.ip;
    const timestamp = log.timestamp || new Date();

    // 🚫 Check if IP is already blocked
    if (ip && ip !== 'localhost' && isBlocked(ip)) {
        console.log(`🚫 Blocked IP Attempt: ${log.username} | ${ip} | ${timestamp.toLocaleString()} | DENIED`);
        detectorEvents.emit('alert', { type: 'blocked_attempt', username: log.username, ip, timestamp: timestamp.toLocaleString(), severity: 'high', message: `Blocked IP attempted access: ${ip}` });
        
        saveLog({
            timestamp: timestamp,
            sourceIp: ip,
            username: log.username,
            eventType: 'blocked_attempt',
            severity: 'high',
            message: `Blocked IP attempted access: ${ip}`,
            detectionRule: 'IP Blocked',
            status: 'alerted'
        });
        return;
    }

    // 🟢 SUCCESS LOGIN
    if (log.type === "success_login") {
        console.log(`🟢 ${log.username} | ${ip} | ${timestamp.toLocaleString()} | SUCCESS_LOGIN`);
        detectorEvents.emit('alert', { type: 'success', username: log.username, ip, timestamp: timestamp.toLocaleString(), severity: 'low', message: `Successful login for user ${log.username}` });
        
        saveLog({
            timestamp: timestamp,
            sourceIp: ip,
            username: log.username,
            eventType: 'success_login',
            severity: 'low',
            message: `Successful login for user ${log.username}`,
            status: 'alerted'
        });
        return;
    }

    // 🔴 FAILED LOGIN
    if (log.type === "failed_login") {
        if (!ip) return;

        if (!attempts[ip]) {
            attempts[ip] = [];
        }

        // Add attempt timestamp
        attempts[ip].push(now);

        // Keep only attempts within the time window
        attempts[ip] = attempts[ip].filter(
            t => now - t <= rules.TIME_WINDOW_SECONDS * 1000
        );

        const count = attempts[ip].length;

        console.log(`❌ ${log.username} | ${ip} | ${timestamp.toLocaleString()} | FAILED_LOGIN`);
        detectorEvents.emit('alert', { type: 'failed', username: log.username, ip, timestamp: timestamp.toLocaleString(), severity: 'medium', message: `Failed login for user ${log.username}` });
        
        saveLog({
            timestamp: timestamp,
            sourceIp: ip,
            username: log.username,
            eventType: 'failed_login',
            severity: 'medium',
            message: `Failed login for user ${log.username}`,
            status: 'alerted'
        });

        // 🚨 ALERT when threshold reached
        if (count >= rules.FAILED_LOGIN_THRESHOLD) {
            console.log(`🚨 ALERT: Possible Brute-force Attack from ${ip} | ${count} attempts in ${rules.TIME_WINDOW_SECONDS}s\n`);

            blockIp(ip);
            detectorEvents.emit('alert', { type: 'attack', ip, count, timestamp: new Date().toLocaleString(), severity: 'critical', message: `Brute-force attack detected (${count} attempts in ${rules.TIME_WINDOW_SECONDS}s). IP blocked.`, detectionRule: 'Brute Force SSH' });

            saveLog({
                timestamp: new Date(),
                sourceIp: ip,
                username: log.username,
                eventType: 'attack',
                severity: 'critical',
                message: `Brute-force attack detected (${count} attempts in ${rules.TIME_WINDOW_SECONDS}s). IP blocked.`,
                detectionRule: 'Brute Force SSH',
                status: 'alerted'
            });

            // Reset after alert
            attempts[ip] = [];
        }
    }
}

module.exports = { detect, detectorEvents };
