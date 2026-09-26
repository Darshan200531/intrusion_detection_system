const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { detectSMTP } = require('../detectors/smtpDetector');
const { spawn } = require('child_process');

/*
 * Helper to normalize IPv6 mapped IPv4 addresses
 */
function normalizeIP(ip) {
    if (!ip) return '127.0.0.1';
    if (ip.startsWith('::ffff:')) return ip.substring(7);
    return ip;
}

/*
 * Enhanced Postfix / SMTP log parsing
 */
function parsePostfixLog(line) {
    if (!line || !line.trim()) return null;
    
    let log = { raw: line.trim(), timestamp: new Date() };

    // 1. SASL Auth failure
    // Example: warning: unknown[192.168.1.1]: SASL LOGIN authentication failed: ...
    // Example: warning: mail.server.com[10.0.0.5]: SASL PLAIN authentication failed
    const authFailMatch = line.match(/(?:warning:)?\s*(?:.*?\b(\d{1,3}(?:\.\d{1,3}){3}|[a-f0-9:]+)\b.*?)?\s*SASL\s+.*?\s*authentication\s+failed/i);
    if (authFailMatch) {
        log.type = 'auth_failure';
        // Extract IP if present in brackets or text
        const ipInBrackets = line.match(/\[(\d{1,3}(?:\.\d{1,3}){3}|[a-f0-9:]+)\]/);
        log.ip = ipInBrackets ? normalizeIP(ipInBrackets[1]) : (authFailMatch[1] ? normalizeIP(authFailMatch[1]) : '127.0.0.1');
        const userMatch = line.match(/sasl_username=(.*?)(?:[\s,:]|$)/i) || line.match(/user\s+([^\s]+)/i);
        log.username = userMatch ? userMatch[1] : '';
        return log;
    }

    // 2. SASL Auth success
    // Example: postfix/smtpd[123]: client=unknown[192.168.1.1], sasl_method=LOGIN, sasl_username=user@example.com
    // Example: SASL LOGIN authentication succeeded for user@example.com from [192.168.1.1]
    const authSuccessMatch = line.match(/sasl_username=([^\s,]+)|SASL\s+.*?\s*authentication\s+succeeded\s+for\s+([^\s]+)/i);
    if (authSuccessMatch) {
        log.type = 'auth_success';
        log.username = authSuccessMatch[1] || authSuccessMatch[2] || '';
        const ipInBrackets = line.match(/\[(\d{1,3}(?:\.\d{1,3}){3}|[a-f0-9:]+)\]/);
        log.ip = ipInBrackets ? normalizeIP(ipInBrackets[1]) : '127.0.0.1';
        return log;
    }

    // 3. Open Relay (Relay access denied)
    // Example: NOQUEUE: reject: RCPT from unknown[192.168.1.1]: 554 5.7.1 <user@example.com>: Relay access denied
    const relayMatch = line.match(/reject: .*? from .*?\[(.*?)\]: .*? Relay access denied/i);
    if (relayMatch) {
        log.type = 'open_relay';
        log.ip = normalizeIP(relayMatch[1]);
        return log;
    }

    // 4. Successful email send
    // Example: postfix/qmgr[123]: A1B2C3D4: from=<user@example.com>, size=1024, nrcpt=1 (queue active)
    const sendMatch = line.match(/: (.*?): from=<(.*?)>,\s*size=(\d+)/i);
    if (sendMatch) {
        log.type = 'email_sent';
        log.msgId = sendMatch[1];
        log.username = sendMatch[2];
        log.size = parseInt(sendMatch[3], 10);
        const ipInBrackets = line.match(/\[(\d{1,3}(?:\.\d{1,3}){3}|[a-f0-9:]+)\]/);
        log.ip = ipInBrackets ? normalizeIP(ipInBrackets[1]) : '127.0.0.1';
        return log;
    }

    // 5. Generic postfix connection error or rejection
    const connectMatch = line.match(/(?:connect|disconnect|lost connection)\s+from\s+.*?\[(.*?)\]/i);
    if (connectMatch) {
        log.type = 'smtp_connection';
        log.ip = normalizeIP(connectMatch[1]);
        return log;
    }

    return null;
}

/**
 * Locate best available SMTP log file
 */
function resolveSMTPLogFile(customPath) {
    if (customPath && fs.existsSync(customPath)) {
        return customPath;
    }

    const candidatePaths = [
        '/var/log/mail.log',
        '/var/log/maillog',
        '/var/log/syslog',
        path.join(__dirname, '../logs/mail.log')
    ];

    for (const p of candidatePaths) {
        if (fs.existsSync(p)) return p;
    }

    // Create local fallback if none found
    const fallbackPath = path.join(__dirname, '../logs/mail.log');
    try {
        const logsDir = path.dirname(fallbackPath);
        if (!fs.existsSync(logsDir)) {
            fs.mkdirSync(logsDir, { recursive: true });
        }
        if (!fs.existsSync(fallbackPath)) {
            fs.writeFileSync(fallbackPath, '# SMTP Mail Log Initialized\n');
        }
        return fallbackPath;
    } catch (e) {
        return customPath || '/var/log/mail.log';
    }
}

function startSMTPMonitor(customPath = '/var/log/mail.log') {
    const logFilePath = resolveSMTPLogFile(customPath);
    console.log(`📡 Starting SMTP Log Monitor on: ${logFilePath}`);

    if (process.platform === 'win32' || fs.existsSync(logFilePath)) {
        let fileSize = 0;
        try {
            fileSize = fs.statSync(logFilePath).size;
        } catch (e) {}

        setInterval(() => {
            try {
                if (!fs.existsSync(logFilePath)) return;
                const newSize = fs.statSync(logFilePath).size;
                if (newSize > fileSize) {
                    const stream = fs.createReadStream(logFilePath, { start: fileSize, end: newSize });
                    const rl = readline.createInterface({ input: stream });
                    rl.on('line', (line) => {
                        if (line.trim()) {
                            const parsed = parsePostfixLog(line);
                            if (parsed) detectSMTP(parsed);
                        }
                    });
                    fileSize = newSize;
                } else if (newSize < fileSize) {
                    fileSize = newSize; // Log rotated
                }
            } catch (err) {
                console.error('Error polling SMTP log file:', err.message);
            }
        }, 1000);
    }

    if (process.platform !== 'win32' && fs.existsSync(logFilePath)) {
        try {
            const tail = spawn('tail', ['-n', '0', '-F', logFilePath]);
            tail.stdout.on('data', (data) => {
                const lines = data.toString().split('\n');
                lines.forEach(line => {
                    if (line.trim()) {
                        const parsed = parsePostfixLog(line);
                        if (parsed) detectSMTP(parsed);
                    }
                });
            });
            tail.stderr.on('data', (err) => {
                console.error('SMTP Tail Error:', err.toString());
            });
        } catch (err) {
            console.error('Failed to spawn tail for SMTP monitor:', err.message);
        }
    }
}

module.exports = { startSMTPMonitor, parsePostfixLog };
