const rules = require('../config/rules');
const alert = require('./alert');
const { updateTimeWindow } = require('../utils/timeWindow');

let failedAttempts = {};

function detect(log) {
if (!log) return;


const { ip, timestamp, status } = log;

if (status === 'FAILED') {

    // Initialize array if not exists
    if (!failedAttempts[ip]) {
        failedAttempts[ip] = [];
    }

    // Update timestamps using timeWindow utility
    failedAttempts[ip] = updateTimeWindow(
        failedAttempts[ip],
        timestamp,
        rules.TIME_WINDOW_SECONDS
    );

    // Check threshold
    if (failedAttempts[ip].length >= rules.FAILED_LOGIN_THRESHOLD) {
        alert.trigger(ip, failedAttempts[ip].length);

        // Reset after alert (optional strategy)
        failedAttempts[ip] = [];
    }
}


}

module.exports = detect;