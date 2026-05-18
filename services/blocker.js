const { exec } = require('child_process');

const blockedIps = new Set();

function blockIp(ip) {
    if (blockedIps.has(ip)) return;
    blockedIps.add(ip);

    console.log(`🛡️  Attempting to block IP: ${ip}...`);

    if (process.platform === 'win32') {
        // Mock blocking for Windows development
        console.log(`✅ [MOCK] Successfully blocked IP ${ip} on Windows (Firewall simulated)`);
    } else {
        // Linux iptables command
        const command = `sudo iptables -A INPUT -s ${ip} -j DROP`;
        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error(`❌ Failed to block IP ${ip}: ${error.message}`);
                blockedIps.delete(ip);
                return;
            }
            if (stderr) {
                console.error(`❌ iptables stderr: ${stderr}`);
                return;
            }
            console.log(`✅ Successfully blocked IP ${ip} using iptables`);
        });
    }
}

function isBlocked(ip) {
    return blockedIps.has(ip);
}

module.exports = { blockIp, isBlocked };
