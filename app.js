const express = require('express');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');

const connectDB = require('./config/db');

// SSH modules
const readLogs = require('./services/logReader');
const parseLog = require('./services/parser');
const { detect, detectorEvents } = require('./services/detector');

// FTP modules
const { startFTPMonitor } = require('./services/ftpMonitor');
const { ftpDetectorEvents } = require('./detectors/ftpDetector');
const ftpRoutes = require('./routes/ftpRoutes');

// SMTP modules
const { startSMTPMonitor } = require('./services/smtpMonitor');
const { smtpDetectorEvents } = require('./detectors/smtpDetector');
const smtpRoutes = require('./routes/smtpRoutes');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// Connect to Database
connectDB();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Routes for new services
app.use('/api/ftp', ftpRoutes);
app.use('/api/smtp', smtpRoutes);

let alertHistory = []; // Keep last 100 SSH alerts in memory

// ─── History API ─────────────────────────────────────────────────────────────
app.get('/api/alerts/history', (req, res) => {
    res.json(alertHistory);
});

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
    }

    res.json({ ok: true });
});

// ─── Socket.IO Real-Time Alerts ──────────────────────────────────────────────
io.on('connection', (socket) => {
    console.log('✅ Client connected to Socket.IO');
    // Send history of SSH alerts to new clients to maintain previous functionality
    socket.emit('ssh_history', alertHistory);
});

// Broadcast SSH Alerts
detectorEvents.on('alert', (data) => {
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


// ─── Log Monitoring ──────────────────────────────────────────────────────────
const LOG_FILE = '/var/log/auth.log';

let started = false;

setTimeout(() => {
    started = true;
    console.log("✅ Now monitoring ONLY new logs...\n");
    console.log(`✅ Web Dashboard available at http://localhost:${PORT}\n`);
    console.log("USER        | IP          | TIME-STAMP                 | LOGIN-TYPE");
    console.log("--------------------------------------------------------------------\n");
    
    // Start FTP and SMTP Monitors (paths can be configured if needed)
    startFTPMonitor();
    startSMTPMonitor();
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
