function trigger(ip, count) {
    console.log("🚨 ALERT: Possible Brute Force Attack!");
    console.log(`IP: ${ip}`);
    console.log(`Failed Attempts: ${count}`);
    console.log(`Time: ${new Date()}`);
}

module.exports = { trigger };