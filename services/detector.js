const rules = require('../config/rules');
const alert = require('./alert');
const { updateTimeWindow } = require('../utils/timeWindow');

let failedAttempts = {};

function detect(log) {
if (!log) return;


const { ip, timestamp, status } = log;

// SUCCESS handling
if (status === 'SUCCESS') {
    console.log(`✅ Successful login from IP: ${ip} at ${timestamp}`);
    failedAttempts[ip] = []; // reset on success
    return;
}

// FAILED handling
if (status === 'FAILED') {

    if (!failedAttempts[ip]) {
        failedAttempts[ip] = [];
    }

    failedAttempts[ip] = updateTimeWindow(
        failedAttempts[ip],
        timestamp,
        rules.TIME_WINDOW_SECONDS
    );

    console.log(`❌ Failed login from IP: ${ip}`);

    // Threshold check
    if (failedAttempts[ip].length >= rules.FAILED_LOGIN_THRESHOLD) {
        alert.trigger(ip, failedAttempts[ip].length);
        failedAttempts[ip] = [];
    } else {
        console.log(`⚠️ ${failedAttempts[ip].length} failed attempts from ${ip}`);
    }
}


}

module.exports = detect;
