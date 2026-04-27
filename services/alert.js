const Alert = require('../models/Alert');
const rules = require('../config/rules');

function getSeverity(count) {
    if (count >= 20) return 'CRITICAL';
    if (count >= 10) return 'HIGH';
    if (count >= 5) return 'MEDIUM';
    return 'LOW';
}

async function saveAlert(ip, count) {
    if (!rules.ENABLE_DB_STORAGE) return;

    try {
        const alertDoc = new Alert({
            ip,
            failedAttemptsCount: count,
            timeWindowSeconds: rules.TIME_WINDOW_SECONDS,
            severity: getSeverity(count)
        });
        await alertDoc.save();
        console.log(`Alert saved to database for IP: ${ip}`);
    } catch (err) {
        console.error('Failed to save alert:', err.message);
    }
}

function trigger(ip, count) {
    console.log("🚨 ALERT: Possible Brute Force Attack!");
    console.log(`IP: ${ip}`);
    console.log(`Failed Attempts: ${count}`);
    console.log(`Time: ${new Date()}`);

    // Persist alert to MongoDB (fire and forget)
    saveAlert(ip, count);
}

module.exports = { trigger };