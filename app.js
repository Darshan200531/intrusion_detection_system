const readLogs = require('./services/logReader');
const parseLog = require('./services/parser');
const detect = require('./services/detector');

const LOG_FILE = '/var/log/auth.log';


let started = false;

// ⏳ Delay start to ignore old logs
setTimeout(() => {
    started = true;

    console.log("✅ Now monitoring ONLY new logs...\n");
    
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
