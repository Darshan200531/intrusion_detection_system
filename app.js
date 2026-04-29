const readLogs = require('./services/logReader');
const parseLog = require('./services/parser');
const detect = require('./services/detector');

const LOG_FILE = './logs/auth.log';

readLogs(LOG_FILE, (line) => {
    const parsed = parseLog(line);
    detect(parsed);
});