const fs = require('fs');
const readline = require('readline');
const { spawn } = require('child_process');
const path = require('path');

/**
 * Read log file in batch mode (existing file)
 */
function readLogs(filePath, callback) {
    const stream = fs.createReadStream(filePath);

    const rl = readline.createInterface({
        input: stream,
        crlfDelay: Infinity
    });

    rl.on('line', (line) => {
        callback(line);
    });

    rl.on('error', (err) => {
        console.error(`Error reading log file ${filePath}:`, err.message);
    });
}

/**
 * Tail log file in real-time using `tail -F` (Linux/Unix)
 * Automatically handles log rotation
 */
function tailLogsLinux(filePath, callback) {
    console.log(`Starting real-time log tail on: ${filePath}`);

    const tail = spawn('tail', ['-F', '-n', '0', filePath]);

    const rl = readline.createInterface({
        input: tail.stdout,
        crlfDelay: Infinity
    });

    rl.on('line', (line) => {
        callback(line);
    });

    tail.stderr.on('data', (data) => {
        console.error(`Tail error: ${data.toString().trim()}`);
    });

    tail.on('error', (err) => {
        console.error(`Failed to start tail process: ${err.message}`);
        console.log('Falling back to cross-platform file watcher...');
        tailLogsCrossPlatform(filePath, callback);
    });

    tail.on('close', (code) => {
        console.log(`Tail process exited with code ${code}`);
    });

    // Graceful shutdown
    process.on('SIGINT', () => {
        console.log('\nStopping log tail...');
        tail.kill();
        process.exit(0);
    });

    return tail;
}

/**
 * Cross-platform fallback for real-time log tailing using fs.watchFile
 * Works on Windows and systems without `tail` command
 */
function tailLogsCrossPlatform(filePath, callback) {
    console.log(`Starting cross-platform log watcher on: ${filePath}`);

    let fileSize = 0;

    if (fs.existsSync(filePath)) {
        fileSize = fs.statSync(filePath).size;
    }

    fs.watchFile(filePath, { interval: 1000 }, (curr, prev) => {
        if (curr.size > prev.size) {
            const stream = fs.createReadStream(filePath, {
                start: prev.size,
                end: curr.size
            });

            const rl = readline.createInterface({
                input: stream,
                crlfDelay: Infinity
            });

            rl.on('line', (line) => {
                if (line.trim()) {
                    callback(line);
                }
            });
        }
    });

    console.log('Watching for new log entries... (Press Ctrl+C to stop)');
}

/**
 * Auto-detect platform and choose best real-time tailing method
 */
function tailLogs(filePath, callback) {
    if (process.platform === 'win32') {
        tailLogsCrossPlatform(filePath, callback);
    } else {
        tailLogsLinux(filePath, callback);
    }
}

module.exports = { readLogs, tailLogs, tailLogsLinux, tailLogsCrossPlatform };