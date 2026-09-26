const express = require('express');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');

const connectDB = require('./config/db');

// SSH modules
const readLogs = require('./services/logReader');
const parseLog = require('./services/parser');
const { detect, detectorEvents } = require('./services/detector');
const { unblockIp, getBlockedIps, blockerEvents } = require('./services/blocker');
const SSHLog = require('./models/SSHLog');

// FTP modules
const { startFTPMonitor } = require('./services/ftpMonitor');
const { ftpDetectorEvents } = require('./detectors/ftpDetector');
const ftpRoutes = require('./routes/ftpRoutes');

// SMTP modules
const { startSMTPMonitor } = require('./services/smtpMonitor');
const { smtpDetectorEvents } = require('./detectors/smtpDetector');
const smtpRoutes = require('./routes/smtpRoutes');

// Analytics modules
const analyticsRoutes = require('./routes/analyticsRoutes');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// Connect to Database
connectDB();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// SSH routes
const sshRoutes = require('./routes/sshRoutes');

// FIM modules
const { initializeFIM, fimEvents } = require('./services/fileIntegrityMonitor');
const fimRoutes = require('./routes/fimRoutes');

// Routes for services
app.use('/api/ssh', sshRoutes);
app.use('/api/ftp', ftpRoutes);
app.use('/api/smtp', smtpRoutes);
app.use('/api/fim', fimRoutes);
app.use('/api/analytics', analyticsRoutes);

let alertHistory = []; // Keep last 100 SSH alerts in memory

// ─── History API (in-memory, SSH only) ────────────────────────────────────────────
app.get('/api/alerts/history', (req, res) => {
    res.json(alertHistory);
});

// ─── SSH History from MongoDB ─────────────────────────────────────────────────
app.get('/api/ssh/history', async (req, res) => {
    try {
        const logs = await SSHLog.find()
            .sort({ timestamp: -1 })
            .limit(100)
            .lean();

        // Map DB fields to the shape handleNewSSHAlert expects
        const mapped = logs.map(log => ({
            type:      log.eventType,   // 'failed_login', 'success_login', 'attack', 'blocked_attempt'
            ip:        log.sourceIp,
            username:  log.username,
            timestamp: log.timestamp,
            severity:  log.severity,
            message:   log.message,
            count:     undefined,
            service:   'SSH'
        }));

        res.json(mapped);
    } catch (err) {
        console.error('SSH history fetch error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ─── IPTable / Blocked IPs API ────────────────────────────────────────────────
app.get('/api/blocked-ips', async (req, res) => {
    try {
        const ips = await getBlockedIps();
        res.json(ips);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/blocked-ips/:ip', async (req, res) => {
    const ip = req.params.ip;
    const success = await unblockIp(ip);
    if (success) {
        res.json({ ok: true, message: `IP ${ip} unblocked successfully` });
    } else {
        res.status(404).json({ ok: false, message: `IP ${ip} not found in block list` });
    }
});

// Broadcast real-time blocked IPs list update whenever blockerEvents emits a change
blockerEvents.on('change', async () => {
    try {
        const ips = await getBlockedIps();
        io.emit('blocked_ips_update', ips);
    } catch (err) {
        console.error('Error broadcasting blocked IPs update:', err);
    }
});

const { detectSMTP } = require('./detectors/smtpDetector');
const { detectFTP } = require('./detectors/ftpDetector');

// ─── Simulate API (for testing) ──────────────────────────────────────────────
app.post('/api/simulate', (req, res) => {
    const { type } = req.body;

    if (type === 'success') {
        detect({ type: 'success_login', username: 'testuser', ip: '1.2.3.4', timestamp: new Date() });
    } else if (type === 'failed') {
        detect({ type: 'failed_login', username: 'hacker', ip: '9.8.7.6', timestamp: new Date() });
    } else if (type === 'attack') {
        for (let i = 0; i < 5; i++) {
            detect({ type: 'failed_login', username: 'hacker', ip: '6.6.6.6', timestamp: new Date() });
        }
    } else if (type === 'smtp_auth_failed' || type === 'smtp_failed') {
        detectSMTP({ type: 'auth_failure', ip: '192.168.1.50', username: 'mailhacker', raw: 'warning: unknown[192.168.1.50]: SASL LOGIN authentication failed' });
    } else if (type === 'smtp_auth_success' || type === 'smtp_success') {
        detectSMTP({ type: 'auth_success', ip: '192.168.1.50', username: 'smtpuser', raw: 'postfix/smtpd: client=unknown[192.168.1.50], sasl_username=smtpuser' });
    } else if (type === 'smtp_open_relay') {
        detectSMTP({ type: 'open_relay', ip: '192.168.1.88', raw: 'NOQUEUE: reject: RCPT from unknown[192.168.1.88]: Relay access denied' });
    } else if (type === 'smtp_attack') {
        for (let i = 0; i < 10; i++) {
            detectSMTP({ type: 'auth_failure', ip: '172.16.0.99', username: 'spammer', raw: 'warning: unknown[172.16.0.99]: SASL LOGIN authentication failed' });
        }
    } else if (type === 'ftp_failed') {
        detectFTP({ type: 'failed_login', ip: '192.168.1.40', username: 'ftphacker', raw: '[ftphacker] FAIL LOGIN: Client "192.168.1.40"' });
    } else if (type === 'ftp_attack') {
        for (let i = 0; i < 5; i++) {
            detectFTP({ type: 'failed_login', ip: '192.168.1.44', username: 'ftphacker', raw: '[ftphacker] FAIL LOGIN: Client "192.168.1.44"' });
        }
    }

    res.json({ ok: true, message: `Simulated event triggered for type: ${type}` });
});

// ─── Socket.IO Real-Time Alerts ──────────────────────────────────────────────
io.on('connection', async (socket) => {
    console.log('✅ Client connected to Socket.IO');
    // Send history of SSH alerts to new clients to maintain previous functionality
    socket.emit('ssh_history', alertHistory);
    // Send current blocked IPs list on connect
    try {
        const ips = await getBlockedIps();
        socket.emit('blocked_ips_update', ips);
    } catch (err) {
        console.error('Error emitting blocked IPs on connection:', err);
    }
});

// Broadcast SSH Alerts
detectorEvents.on('alert', async (data) => {
    // Add a service flag for the dashboard
    data.service = 'SSH';
    
    alertHistory.push(data);
    if (alertHistory.length > 100) alertHistory.shift();

    io.emit('alert', data);
});

// Broadcast FTP Alerts
ftpDetectorEvents.on('alert', (data) => {
    io.emit('alert', data);
});

// Broadcast SMTP Alerts
smtpDetectorEvents.on('alert', (data) => {
    io.emit('alert', data);
});

// Broadcast FIM Alerts
fimEvents.on('alert', (data) => {
    io.emit('alert', data);
});


// ─── Log & System Monitoring ──────────────────────────────────────────────────
const LOG_FILE = '/var/log/auth.log';

let started = false;

setTimeout(async () => {
    started = true;
    console.log("✅ Now monitoring ONLY new logs...\n");
    console.log(`✅ Web Dashboard available at http://localhost:${PORT}\n`);
    console.log("USER        | IP          | TIME-STAMP                 | LOGIN-TYPE");
    console.log("--------------------------------------------------------------------\n");
    
    // Start FTP and SMTP Monitors (paths can be configured if needed)
    startFTPMonitor();
    startSMTPMonitor();
    
    // Initialize File Integrity Monitoring (FIM)
    try {
        await initializeFIM();
    } catch (err) {
        console.error('Error initializing FIM:', err.message);
    }
}, 2000);

readLogs(LOG_FILE, (line) => {
    if (!started) return;

    const parsed = parseLog(line);
    if (parsed) {
        detect(parsed);
    }
});

server.listen(PORT, () => {
    console.log(`Server started on port ${PORT}`);
});
