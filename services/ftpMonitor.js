const fs = require('fs');
const readline = require('readline');
const { detectFTP } = require('../detectors/ftpDetector');
const { spawn } = require('child_process');

function parseVsftpdLog(line) {
    if (!line) return null;
    
    // Example vsftpd log:
    // Mon Aug  7 10:10:10 2026 [pid 123] [user] OK LOGIN: Client "192.168.1.1"
    // Mon Aug  7 10:11:11 2026 [pid 123] [user] FAIL LOGIN: Client "192.168.1.1"
    // Mon Aug  7 10:12:12 2026 [pid 123] [anonymous] OK LOGIN: Client "192.168.1.1"
    // Mon Aug  7 10:13:13 2026 [pid 123] [user] OK UPLOAD: Client "192.168.1.1", "/path/to/file.php", 1024 bytes
    
    let log = { raw: line, timestamp: new Date() };
    
    // FAIL LOGIN
    const failMatch = line.match(/\[(.*?)\] FAIL LOGIN: Client "(.*?)"/);
    if (failMatch) {
        log.type = 'failed_login';
        log.username = failMatch[1];
        log.ip = failMatch[2];
        return log;
    }
    
    // OK LOGIN
    const okMatch = line.match(/\[(.*?)\] OK LOGIN: Client "(.*?)"/);
    if (okMatch) {
        if (okMatch[1] === 'anonymous' || okMatch[1] === 'ftp') {
            log.type = 'anonymous_login';
        } else {
            log.type = 'success_login';
        }
        log.username = okMatch[1];
        log.ip = okMatch[2];
        return log;
    }
    
    // UPLOAD
    const uploadMatch = line.match(/\[(.*?)\] OK UPLOAD: Client "(.*?)", "(.*?)", (\d+) bytes/);
    if (uploadMatch) {
        log.type = 'file_upload';
        log.username = uploadMatch[1];
        log.ip = uploadMatch[2];
        log.filename = uploadMatch[3];
        log.filesize = parseInt(uploadMatch[4], 10);
        return log;
    }
    
    // DOWNLOAD
    const downloadMatch = line.match(/\[(.*?)\] OK DOWNLOAD: Client "(.*?)", "(.*?)", (\d+) bytes/);
    if (downloadMatch) {
        log.type = 'file_download';
        log.username = downloadMatch[1];
        log.ip = downloadMatch[2];
        log.filename = downloadMatch[3];
        log.filesize = parseInt(downloadMatch[4], 10);
        return log;
    }

    // DELETE (vsftpd usually logs this via DELETE command)
    const deleteMatch = line.match(/\[(.*?)\] OK DELETE: Client "(.*?)", "(.*?)"/);
    if (deleteMatch) {
        log.type = 'file_delete';
        log.username = deleteMatch[1];
        log.ip = deleteMatch[2];
        log.filename = deleteMatch[3];
        return log;
    }

    return null;
}

function startFTPMonitor(logFilePath = '/var/log/vsftpd.log') {
    console.log(`📡 Starting FTP Log Monitor on: ${logFilePath}`);
    
    // In production, we'd use tail -F like logReader.js. For cross-compatibility we might want to check OS.
    if (process.platform === 'win32') {
        // Simple fallback for windows if testing locally (poll file changes)
        if (fs.existsSync(logFilePath)) {
            let fileSize = fs.statSync(logFilePath).size;
            setInterval(() => {
                const newSize = fs.statSync(logFilePath).size;
                if (newSize > fileSize) {
                    const stream = fs.createReadStream(logFilePath, { start: fileSize, end: newSize });
                    const rl = readline.createInterface({ input: stream });
                    rl.on('line', (line) => {
                        if (line.trim()) {
                            const parsed = parseVsftpdLog(line);
                            if (parsed) detectFTP(parsed);
                        }
                    });
                    fileSize = newSize;
                }
            }, 1000);
        } else {
            console.warn(`⚠️ FTP Log file ${logFilePath} not found.`);
        }
    } else {
        const tail = spawn('sudo', ['tail', '-n', '0', '-F', logFilePath]);
        tail.stdout.on('data', (data) => {
            const lines = data.toString().split("\n");
            lines.forEach(line => {
                if (line.trim()) {
                    const parsed = parseVsftpdLog(line);
                    if (parsed) detectFTP(parsed);
                }
            });
        });
        tail.stderr.on('data', (err) => {
            console.error("FTP Tail Error:", err.toString());
        });
    }
}

module.exports = { startFTPMonitor, parseVsftpdLog };
