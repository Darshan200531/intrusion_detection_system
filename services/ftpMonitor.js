const fs = require('fs');
const { spawn } = require('child_process');
const { detectFTP } = require('../detectors/ftpDetector');

/*
 * Convert IPv6-mapped IPv4 addresses (::ffff:127.0.0.1 -> 127.0.0.1)
 */
function normalizeIP(ip) {
    if (ip && ip.startsWith('::ffff:')) {
        return ip.substring(7);
    }
    return ip;
}

/*
 * Parse vsftpd log entries
 */
function parseVsftpdLog(line) {
    if (!line || !line.trim()) {
        return null;
    }

    const log = {
        raw: line,
        timestamp: new Date()
    };

    // ==========================================
    // 1. FTP LOGIN (OK or FAIL)
    // ==========================================
    const loginMatch = line.match(
        /\[(.*?)\]\s+(OK|FAIL) LOGIN:\s+Client\s+"(.*?)"/i
    );

    if (loginMatch) {
        const username = loginMatch[1];
        const status = loginMatch[2].toUpperCase();
        const ip = normalizeIP(loginMatch[3]);

        log.username = username;
        log.ip = ip;
        log.action = 'LOGIN';

        if (status === 'OK') {
            if (
                username.toLowerCase() === 'anonymous' ||
                username.toLowerCase() === 'ftp'
            ) {
                log.type = 'anonymous_login';
            } else {
                log.type = 'success_login';
            }
        } else {
            log.type = 'failed_login';
        }

        return log;
    }

    // ==========================================
    // 2. FTP UPLOAD (OK or FAIL)
    // ==========================================
    const uploadMatch = line.match(
        /\[(.*?)\]\s+(OK|FAIL) UPLOAD:\s+Client\s+"(.*?)",\s+"(.*?)"(?:,\s+([\d.]+)\s+bytes)?/i
    );

    if (uploadMatch) {
        log.username = uploadMatch[1];
        log.ip = normalizeIP(uploadMatch[3]);
        log.filename = uploadMatch[4];
        log.filesize = uploadMatch[5] ? parseFloat(uploadMatch[5]) : null;
        log.action = 'UPLOAD';

        if (uploadMatch[2].toUpperCase() === 'OK') {
            log.type = 'file_upload';
        } else {
            log.type = 'failed_upload';
        }

        return log;
    }

    // ==========================================
    // 3. FTP DOWNLOAD (OK or FAIL)
    // ==========================================
    const downloadMatch = line.match(
        /\[(.*?)\]\s+(OK|FAIL) DOWNLOAD:\s+Client\s+"(.*?)",\s+"(.*?)"(?:,\s+([\d.]+)\s+(?:bytes|Kbyte))?/i
    );

    if (downloadMatch) {
        log.username = downloadMatch[1];
        log.ip = normalizeIP(downloadMatch[3]);
        log.filename = downloadMatch[4];
        log.filesize = downloadMatch[5] ? parseFloat(downloadMatch[5]) : null;
        log.action = 'DOWNLOAD';

        if (downloadMatch[2].toUpperCase() === 'OK') {
            log.type = 'file_download';
        } else {
            log.type = 'failed_download';
        }

        return log;
    }

    // ==========================================
    // 4. FTP DELETE (OK or FAIL)
    // ==========================================
    const deleteMatch = line.match(
        /\[(.*?)\]\s+(OK|FAIL) DELETE:\s+Client\s+"(.*?)",\s+"(.*?)"/i
    );

    if (deleteMatch) {
        log.username = deleteMatch[1];
        log.ip = normalizeIP(deleteMatch[3]);
        log.filename = deleteMatch[4];
        log.action = 'DELETE';

        if (deleteMatch[2].toUpperCase() === 'OK') {
            log.type = 'file_delete';
        } else {
            log.type = 'failed_delete';
        }

        return log;
    }

    return null;
}

/*
 * Start FTP log monitoring on /var/log/vsftpd.log
 */
function startFTPMonitor(logFilePath = '/var/log/vsftpd.log') {
    console.log(`📡 Starting FTP Log Monitor on: ${logFilePath}`);

    if (!fs.existsSync(logFilePath)) {
        console.error(`❌ FTP log file not found: ${logFilePath}`);
        return;
    }

    const tail = spawn('tail', ['-n', '0', '-F', logFilePath]);

    tail.stdout.on('data', (data) => {
        const lines = data.toString().split('\n');

        lines.forEach((line) => {
            if (!line.trim()) return;

            const parsed = parseVsftpdLog(line);

            if (parsed) {
                console.log('📡 FTP EVENT DETECTED:', parsed);
                detectFTP(parsed);
            }
        });
    });

    tail.stderr.on('data', (data) => {
        console.error('❌ FTP Tail Error:', data.toString());
    });

    tail.on('error', (error) => {
        console.error('❌ FTP Monitor Error:', error.message || error);
    });

    tail.on('close', (code) => {
        console.log(`FTP monitor stopped with code ${code}`);
    });
}

module.exports = {
    startFTPMonitor,
    parseVsftpdLog
};