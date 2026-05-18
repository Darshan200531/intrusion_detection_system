const express = require('express');
const path = require('path');
const readLogs = require('./services/logReader');
const parseLog = require('./services/parser');
const { detect, detectorEvents } = require('./services/detector');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let clients = [];
let alertHistory = []; // Keep last 100 alerts in memory

// ─── SSE Stream ──────────────────────────────────────────────────────────────
app.get('/api/alerts/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Send all past alerts immediately on connect
    alertHistory.forEach(alert => {
        res.write(`data: ${JSON.stringify(alert)}\n\n`);
    });

    clients.push(res);

    req.on('close', () => {
        clients = clients.filter(client => client !== res);
    });
});

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
        // Simulate 5 rapid failed logins from same IP
        for (let i = 0; i < 5; i++) {
            detect({ type: 'failed_login', username: 'hacker', ip: '6.6.6.6', timestamp: new Date() });
        }
    }

    res.json({ ok: true });
});

// ─── Broadcast + Store Alerts ────────────────────────────────────────────────
detectorEvents.on('alert', (data) => {
    alertHistory.push(data);
    if (alertHistory.length > 100) alertHistory.shift(); // cap at 100

    clients.forEach(client => {
        client.write(`data: ${JSON.stringify(data)}\n\n`);
    });
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
}, 2000);

readLogs(LOG_FILE, (line) => {
    if (!started) return;

    const parsed = parseLog(line);
    if (parsed) {
        detect(parsed);
    }
});

app.listen(PORT, () => {
    console.log(`Server started on port ${PORT}`);
});
