// Detector
const rules = require('./rules');

const attempts = {};

function detect(log) {
    if (!log) return;

    const now = Date.now();
    const ip = log.ip;

    // 🟢 SUCCESS LOGIN (ADD HERE FIRST)
    if (log.type === "success_login") {
        console.log(`🟢 ${log.username} | ${ip} | ${log.timestamp.toLocaleString()} | SUCCESS_LOGIN`);
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

        // 🚨 ALERT when threshold reached
        if (count >= rules.FAILED_LOGIN_THRESHOLD) {
            console.log(`🚨 ALERT possible Brute-force Attack! from ${ip} | ${count} attempts in ${rules.TIME_WINDOW_SECONDS}s\n`);

            // 🔥 RESET after alert
            attempts[ip] = [];
        }
    }
}

module.exports = detect;

