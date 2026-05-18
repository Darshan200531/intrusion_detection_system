const express = require('express');
const path = require('path');
const readLogs = require('./services/logReader');
const parseLog = require('./services/parser');
const { detect, detectorEvents } = require('./services/detector');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

let clients = [];

app.get('/api/alerts/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    clients.push(res);

    req.on('close', () => {
        clients = clients.filter(client => client !== res);
    });
});

detectorEvents.on('alert', (data) => {
    clients.forEach(client => {
        client.write(`data: ${JSON.stringify(data)}\n\n`);
    });
});

const LOG_FILE = '/var/log/auth.log';

let started = false;

setTimeout(() => {
    started = true;

    console.log("✅ Now monitoring ONLY new logs...\n");
    console.log(`✅ Web Dashboard available at http://localhost:${PORT}\n`);
    console.log("USER        | IP          | TIME-STAMP                 | LOGIN-TYPE");
    console.log("--------------------------------------------------------------------\n");

}, 5000);

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
