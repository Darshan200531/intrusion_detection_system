const fs = require('fs');
const readline = require('readline');
const { detectSMTP } = require('../detectors/smtpDetector');
const { spawn } = require('child_process');

function parsePostfixLog(line) {
    if (!line) return null;
    
    let log = { raw: line, timestamp: new Date() };
    
    // Postfix / SMTP log parsing (Simplified)
    
    // Auth failure (sasl)
    // Aug  7 10:10:10 mail postfix/smtpd[123]: warning: unknown[192.168.1.1]: SASL LOGIN authentication failed: UGFzc3dvcmQ6
    const authFailMatch = line.match(/warning: .*?\[(.*?)\]: SASL .*? authentication failed/);
    if (authFailMatch) {
        log.type = 'auth_failure';
        log.ip = authFailMatch[1];
        return log;
    }

    // Open Relay (Relay access denied)
    // Aug  7 10:11:11 mail postfix/smtpd[123]: NOQUEUE: reject: RCPT from unknown[192.168.1.1]: 554 5.7.1 <user@example.com>: Relay access denied;
    const relayMatch = line.match(/reject: .*? from .*?\[(.*?)\]: .*? Relay access denied/);
    if (relayMatch) {
        log.type = 'open_relay';
        log.ip = relayMatch[1];
        return log;
    }

    // Successful email send (Queue ID generated)
    // Aug  7 10:12:12 mail postfix/qmgr[123]: A1B2C3D4: from=<user@example.com>, size=1024, nrcpt=1 (queue active)
    const sendMatch = line.match(/: (.*?): from=<(.*?)>, size=(\d+)/);
    if (sendMatch) {
        log.type = 'email_sent';
        log.msgId = sendMatch[1];
        log.username = sendMatch[2];
        log.size = parseInt(sendMatch[3], 10);
        // Postfix doesn't log IP on the same line as size usually, we mock IP for testing
        log.ip = '127.0.0.1'; 
        return log;
    }

    return null;
}

function startSMTPMonitor(logFilePath = '/var/log/mail.log') {
    console.log(`📡 Starting SMTP Log Monitor on: ${logFilePath}`);
    
    if (process.platform === 'win32') {
        if (fs.existsSync(logFilePath)) {
            let fileSize = fs.statSync(logFilePath).size;
            setInterval(() => {
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
                }
            }, 1000);
        } else {
            console.warn(`⚠️ SMTP Log file ${logFilePath} not found.`);
        }
    } else {
        const tail = spawn('sudo', ['tail', '-n', '0', '-F', logFilePath]);
        tail.stdout.on('data', (data) => {
            const lines = data.toString().split("\n");
            lines.forEach(line => {
                if (line.trim()) {
                    const parsed = parsePostfixLog(line);
                    if (parsed) detectSMTP(parsed);
                }
            });
        });
        tail.stderr.on('data', (err) => {
            console.error("SMTP Tail Error:", err.toString());
        });
    }
}

module.exports = { startSMTPMonitor, parsePostfixLog };
