const path = require('path');
const os = require('os');

const isWindows = process.platform === 'win32';
const tempDir = os.tmpdir();

module.exports = {
    algorithm: 'sha256',
    debounceMs: 500,
    emailAlertsEnabled: true,
    alertRecipients: process.env.FIM_ALERT_EMAIL || 'admin@localhost',
    
    // Default list of system and test files to monitor
    monitoredFiles: [
        '/etc/passwd',
        '/etc/hosts',
        '/etc/hostname',
        '/etc/ssh/sshd_config',
        '/etc/vsftpd.conf',
        // Cross-platform test paths for easy testing
        isWindows ? path.join(tempDir, 'fim-test.txt') : '/tmp/fim-test.txt'
    ]
};
