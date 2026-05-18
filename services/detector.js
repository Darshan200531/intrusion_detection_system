// Detector
const rules = require('./rules');
const { blockIp } = require('./blocker');
const EventEmitter = require('events');

const detectorEvents = new EventEmitter();
const attempts = {};

function detect(log) {
    if (!log) return;

    const now = Date.now();
    const ip = log.ip;

    // 🟢 SUCCESS LOGIN (ADD HERE FIRST)
    if (log.type === "success_login") {
        console.log(`🟢 ${log.username} | ${ip} | ${log.timestamp.toLocaleString()} | SUCCESS_LOGIN`);
        detectorEvents.emit('alert', { type: 'success', username: log.username, ip, timestamp: log.timestamp.toLocaleString() });
        return; // stop further processing
    }

    // 🚪 LOGOUT EVENT
    if (log.type === "logout") {
        console.log(`🚪 ${log.username} | ${ip} | ${log.timestamp.toLocaleString()} | LOGOUT`);
        detectorEvents.emit('alert', { type: 'logout', username: log.username, ip, timestamp: log.timestamp.toLocaleString() });
        return; // stop further processing
    }

    // 🔴 FAILED LOGIN
    if (log.type === "failed_login") {

        if (!ip) return;

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

