const fs = require('fs');
const readline = require('readline');

function readLogs(filePath, callback) {
    const stream = fs.createReadStream(filePath);

    const rl = readline.createInterface({
        input: stream,
        crlfDelay: Infinity
    });

    rl.on('line', (line) => {
        callback(line);
    });
}

module.exports = readLogs;