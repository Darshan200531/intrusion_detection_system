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

function unblockIp(ip) {
    if (!blockedIps.has(ip)) return false;
    blockedIps.delete(ip);

    console.log(`🔓 Attempting to unblock IP: ${ip}...`);

    if (process.platform === 'win32') {
        console.log(`✅ [MOCK] Successfully unblocked IP ${ip} on Windows (Firewall simulated)`);
    } else {
        // Remove the iptables DROP rule for this IP
        const command = `sudo iptables -D INPUT -s ${ip} -j DROP`;
        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error(`❌ Failed to unblock IP ${ip}: ${error.message}`);
                // Re-add to set since removal failed
                blockedIps.add(ip);
                return;
            }
            console.log(`✅ Successfully unblocked IP ${ip} from iptables`);
        });
    }

    return true;
}

function isBlocked(ip) {
    return blockedIps.has(ip);
}

function getBlockedIps() {
    return Array.from(blockedIps);
}

module.exports = { blockIp, unblockIp, isBlocked, getBlockedIps };
