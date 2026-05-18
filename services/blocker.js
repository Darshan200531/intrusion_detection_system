const { exec } = require('child_process');

function blockIp(ip) {
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

module.exports = { blockIp };
