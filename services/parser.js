function parseLog(line) {
    const regex = /(\d+-\d+-\d+ \d+:\d+:\d+).*IP:(\S+).*USER:(\S+).*STATUS:(\S+)/;

    const match = line.match(regex);

    if (!match) return null;

    return {
        timestamp: new Date(match[1]),
        ip: match[2],
        username: match[3],
        status: match[4]
    };
}

module.exports = parseLog;