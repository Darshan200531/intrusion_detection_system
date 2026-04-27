const mongoose = require('mongoose');
const { readLogs, tailLogs } = require('./services/logReader');
const parseLog = require('./services/parser');
const detect = require('./services/detector');
const rules = require('./config/rules');

// Determine log file and mode from config
const MODE = rules.MODE || 'batch';
const LOG_FILE = rules.LINUX_AUTH_LOG_PATH || rules.CUSTOM_LOG_PATH || './logs/auth.log';

async function connectDatabase() {
    if (!rules.ENABLE_DB_STORAGE) {
        console.log('Database storage is disabled. Running in memory-only mode.\n');
        return false;
    }

    try {
        await mongoose.connect(rules.MONGODB_URI);
        console.log('Connected to MongoDB successfully.\n');
        return true;
    } catch (err) {
        console.error('MongoDB connection failed:', err.message);
        console.log('Continuing without database storage...\n');
        return false;
    }
}

async function startIDS() {
    const dbConnected = await connectDatabase();

    console.log(`IDS Starting in ${MODE.toUpperCase()} mode`);
    console.log(`Monitoring log file: ${LOG_FILE}`);
    console.log(`Failed login threshold: ${rules.FAILED_LOGIN_THRESHOLD} attempts in ${rules.TIME_WINDOW_SECONDS} seconds`);
    console.log(`Database storage: ${dbConnected ? 'ENABLED' : 'DISABLED'}\n`);

    const processLine = (line) => {
        const parsed = parseLog(line);
        if (parsed) {
            detect(parsed);
        }
    };

    if (MODE === 'realtime') {
        tailLogs(LOG_FILE, processLine);
    } else {
        readLogs(LOG_FILE, processLine);
    }
}

startIDS();