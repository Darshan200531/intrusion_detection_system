// LogReader
const { spawn } = require('child_process');

function readLogs(filePath, callback) {

    console.log("📡 Real-time monitoring started...\n");

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
        console.error("Error:", err.toString());
    });
}

module.exports = readLogs;
