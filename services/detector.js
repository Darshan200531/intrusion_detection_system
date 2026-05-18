// Detector
const rules = require('./rules');
const { blockIp, isBlocked } = require('./blocker');
const EventEmitter = require('events');

const detectorEvents = new EventEmitter();
const attempts = {};

function detect(log) {
    if (!log) return;

    const now = Date.now();
    const ip = log.ip;

    // 🚫 Check if IP is already blocked
    if (ip && ip !== 'localhost' && isBlocked(ip)) {
        console.log(`🚫 Blocked IP Attempt: ${log.username} | ${ip} | ${log.timestamp.toLocaleString()} | DENIED`);
        detectorEvents.emit('alert', { type: 'blocked_attempt', username: log.username, ip, timestamp: log.timestamp.toLocaleString() });
        return;
    }

    // 🟢 SUCCESS LOGIN
    if (log.type === "success_login") {
        console.log(`🟢 ${log.username} | ${ip} | ${log.timestamp.toLocaleString()} | SUCCESS_LOGIN`);
        detectorEvents.emit('alert', { type: 'success', username: log.username, ip, timestamp: log.timestamp.toLocaleString() });
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

        console.log(`❌ ${log.username} | ${ip} | ${log.timestamp.toLocaleString()} | FAILED_LOGIN`);
        detectorEvents.emit('alert', { type: 'failed', username: log.username, ip, timestamp: log.timestamp.toLocaleString() });

        // 🚨 ALERT when threshold reached
        if (count >= rules.FAILED_LOGIN_THRESHOLD) {
            console.log(`🚨 ALERT: Possible Brute-force Attack from ${ip} | ${count} attempts in ${rules.TIME_WINDOW_SECONDS}s\n`);

            blockIp(ip);
            detectorEvents.emit('alert', { type: 'attack', ip, count, timestamp: new Date().toLocaleString() });

            // Reset after alert
            attempts[ip] = [];
        }
    }
}

module.exports = { detect, detectorEvents };
