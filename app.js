const { readLogs, tailLogs } = require('./services/logReader');
const parseLog = require('./services/parser');
const detect = require('./services/detector');
const rules = require('./config/rules');

// Determine log file and mode from config
const MODE = rules.MODE || 'batch';
const LOG_FILE = rules.LINUX_AUTH_LOG_PATH || rules.CUSTOM_LOG_PATH || './logs/auth.log';

console.log(`IDS Starting in ${MODE.toUpperCase()} mode`);
console.log(`Monitoring log file: ${LOG_FILE}`);
console.log(`Failed login threshold: ${rules.FAILED_LOGIN_THRESHOLD} attempts in ${rules.TIME_WINDOW_SECONDS} seconds\n`);

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