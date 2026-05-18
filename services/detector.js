// Detector
const rules = require('./rules');
const { blockIp, isBlocked } = require('./blocker');
const EventEmitter = require('events');

const detectorEvents = new EventEmitter();
const attempts = {};

// Deduplication: track recently seen type+username+ip combos (within 3 seconds)
const recentEvents = {};
const DEDUP_WINDOW_MS = 3000;

function isDuplicate(type, username, ip) {
    const key = `${type}|${username}|${ip}`;
    const now = Date.now();
    if (recentEvents[key] && now - recentEvents[key] < DEDUP_WINDOW_MS) {
        return true; // duplicate within window
    }
    recentEvents[key] = now;
    return false;
}

function detect(log) {
    if (!log) return;

    const now = Date.now();
    const ip = log.ip;

    if (ip && ip !== 'localhost' && isBlocked(ip)) {
        console.log(`🚫 Blocked IP Attempt: ${log.username} | ${ip} | ${log.timestamp.toLocaleString()} | DENIED`);
        detectorEvents.emit('alert', { type: 'blocked_attempt', username: log.username, ip, timestamp: log.timestamp.toLocaleString() });
        return; // stop further processing
    }

    // 🟢 SUCCESS LOGIN
    if (log.type === "success_login") {
        if (isDuplicate('success_login', log.username, ip)) return;
        console.log(`🟢 ${log.username} | ${ip} | ${log.timestamp.toLocaleString()} | SUCCESS_LOGIN`);
        detectorEvents.emit('alert', { type: 'success', username: log.username, ip, timestamp: log.timestamp.toLocaleString() });
        return;
    }



    // 🔴 FAILED LOGIN
    if (log.type === "failed_login") {
        if (!ip) return;
        if (isDuplicate('failed_login', log.username, ip)) return;

        if (!attempts[ip]) {
            attempts[ip] = [];
        }

        // Add attempt
        attempts[ip].push(now);

        // Keep only within time window
        attempts[ip] = attempts[ip].filter(
            t => now - t <= rules.TIME_WINDOW_SECONDS * 1000
        );

        const count = attempts[ip].length;

        console.log(`❌ ${log.username} | ${ip} | ${log.timestamp.toLocaleString()} | FAILED_LOGIN`);
        detectorEvents.emit('alert', { type: 'failed', username: log.username, ip, timestamp: log.timestamp.toLocaleString() });

        // 🚨 ALERT when threshold reached
        if (count >= rules.FAILED_LOGIN_THRESHOLD) {
            console.log(`🚨 ALERT possible Brute-force Attack! from ${ip} | ${count} attempts in ${rules.TIME_WINDOW_SECONDS}s\n`);
            
            // Block IP
            blockIp(ip);
            detectorEvents.emit('alert', { type: 'attack', ip, count, timestamp: new Date().toLocaleString() });

            // 🔥 RESET after alert
            attempts[ip] = [];
        }
    }
}

module.exports = { detect, detectorEvents };

