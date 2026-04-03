const rules = require('../config/rules');
const alert = require('./alert');

let failedAttempts = {};

function detect(log) {
    if (!log) return;

    const { ip, timestamp, status } = log;

    if (status === 'FAILED') {

        if (!failedAttempts[ip]) {
            failedAttempts[ip] = [];
        }

        failedAttempts[ip].push(timestamp);

        // Filter within time window
        const windowStart = new Date(timestamp - rules.TIME_WINDOW_SECONDS * 1000);

        failedAttempts[ip] = failedAttempts[ip].filter(t => t >= windowStart);

        if (failedAttempts[ip].length >= rules.FAILED_LOGIN_THRESHOLD) {
            alert.trigger(ip, failedAttempts[ip].length);
            failedAttempts[ip] = []; // reset after alert
        }
    }
}

module.exports = detect;