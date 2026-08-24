// LogReader
const { spawn } = require('child_process');
const fs = require('fs');

function readLogs(filePath, callback) {
    console.log("📡 Real-time SSH monitoring starting...\n");

    if (process.platform === 'win32' || !fs.existsSync(filePath)) {
        console.log(`ℹ️ [NOTICE] SSH log file (${filePath}) not present or OS is Windows. Log tailing disabled (simulations & DB logs active).`);
        return;
    }

    try {
        const tail = spawn('sudo', ['tail', '-F', filePath]);

        tail.stdout.on('data', (data) => {
            const lines = data.toString().split("\n");
            lines.forEach(line => {
                if (line.trim()) {
                    callback(line);
                }
            });
        });

        tail.stderr.on('data', (err) => {
            console.error("SSH LogReader stderr:", err.toString());
        });

        tail.on('error', (err) => {
            console.error("SSH LogReader process error:", err.message);
        });
    } catch (err) {
        console.error("Failed to start SSH log reader:", err.message);
    }
}

module.exports = readLogs;
