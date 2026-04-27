/**
 * Parse custom IDS log format:
 * 2024-01-01 10:00:00 ... IP:192.168.1.1 ... USER:admin ... STATUS:FAILED
 */
function parseCustomLog(line) {
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

/**
 * Parse real Linux auth.log / secure log lines (sshd, sudo, etc.)
 * Supports formats like:
 *   Apr 27 10:15:32 server sshd[12345]: Failed password for invalid user admin from 192.168.1.100 port 54321 ssh2
 *   Apr 27 10:15:38 server sshd[12345]: Accepted password for user from 192.168.1.50 port 54323 ssh2
 *   Apr 27 10:15:32 server sshd[12345]: authentication failure; logname= uid=0 euid=0 tty=ssh ruser= rhost=192.168.1.100
 */
function parseLinuxAuthLog(line) {
    // Extract timestamp (e.g., "Apr 27 10:15:32") - Linux auth logs omit the year
    const timestampRegex = /^([A-Z][a-z]{2}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2})/;
    const tsMatch = line.match(timestampRegex);
    if (!tsMatch) return null;

    // Append current year since auth.log doesn't include it
    const year = new Date().getFullYear();
    const timestamp = new Date(`${tsMatch[1]} ${year}`);

    // sshd "Failed password" lines
    // Failed password for invalid user <user> from <ip> port <port> ssh2
    // Failed password for <user> from <ip> port <port> ssh2
    const failedPasswordRegex = /Failed password for(?: invalid user)?\s+(\S+) from (\S+) port/;
    const failedMatch = line.match(failedPasswordRegex);
    if (failedMatch) {
        return {
            timestamp,
            ip: failedMatch[2],
            username: failedMatch[1],
            status: 'FAILED',
            raw: line
        };
    }

    // sshd "Accepted password" lines
    const acceptedPasswordRegex = /Accepted password for\s+(\S+) from (\S+) port/;
    const acceptedMatch = line.match(acceptedPasswordRegex);
    if (acceptedMatch) {
        return {
            timestamp,
            ip: acceptedMatch[2],
            username: acceptedMatch[1],
            status: 'SUCCESS',
            raw: line
        };
    }

    // PAM authentication failure lines
    // authentication failure; logname= uid=0 euid=0 tty=ssh ruser= rhost=192.168.1.100
    const pamFailRegex = /authentication failure;.*rhost=(\S+)/;
    const pamMatch = line.match(pamFailRegex);
    if (pamMatch) {
        // Try to extract user from logname= or user=
        const userRegex = /(?:logname|user)=(\S+)/;
        const userMatch = line.match(userRegex);
        return {
            timestamp,
            ip: pamMatch[1],
            username: userMatch ? userMatch[1] : 'unknown',
            status: 'FAILED',
            raw: line
        };
    }

    return null;
}

/**
 * Main parse function - tries Linux auth log first, falls back to custom format
 */
function parseLog(line) {
    if (!line || typeof line !== 'string') return null;

    // Try Linux auth log format first
    const linuxParsed = parseLinuxAuthLog(line);
    if (linuxParsed) return linuxParsed;

    // Fall back to custom IDS log format
    return parseCustomLog(line);
}

module.exports = parseLog;