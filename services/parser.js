// Parser
function parseLog(line) {

    // 🔴 Failed login (SSH)
    let failed = line.match(/Failed password.*for (invalid user )?(\w+) from (\d+\.\d+\.\d+\.\d+)/);
    // 🔴 Failed login (Local GUI/TTY)
    let localFailed = line.match(/authentication failure;.*user=([a-zA-Z0-9_-]+)/);

    if (failed) {
        return {
            type: "failed_login",
            username: failed[2],
            ip: failed[3],
            raw: line,
            timestamp: new Date()
        };
    } else if (localFailed) {
        return {
            type: "failed_login",
            username: localFailed[1],
            ip: "localhost",
            raw: line,
            timestamp: new Date()
        };
    }

    // 🟢 Successful login (SSH)
    let sshSuccess = line.match(/Accepted password for (\w+) from (\d+\.\d+\.\d+\.\d+)/);
    // 🟢 Successful login (Local GUI/TTY)
    let sessionOpened = line.match(/pam_unix\((.*?):session\): session opened for user (\w+)/);
    
    if (sshSuccess) {
        return {
            type: "success_login",
            username: sshSuccess[1],
            ip: sshSuccess[2],
            raw: line,
            timestamp: new Date()
        };
    } else if (sessionOpened) {
        let service = sessionOpened[1];
        let username = sessionOpened[2];
        
        // Ignore cron, sshd (already handled), and systemd-user (background processes)
        if (service !== 'cron' && service !== 'sshd' && service !== 'systemd-user') {
            return {
                type: "success_login",
                username: username,
                ip: "localhost",
                raw: line,
                timestamp: new Date()
            };
        }
    }

    // 🚪 Logout (SSH & Local)
    let sessionClosed = line.match(/pam_unix\((.*?):session\): session closed for user (\w+)/);
    let sshDisconnect = line.match(/Disconnected from user (\w+) (\d+\.\d+\.\d+\.\d+)/);

    if (sshDisconnect) {
        return {
            type: "logout",
            username: sshDisconnect[1],
            ip: sshDisconnect[2],
            raw: line,
            timestamp: new Date()
        };
    } else if (sessionClosed) {
        let service = sessionClosed[1];
        let username = sessionClosed[2];
        
        // Ignore cron and systemd-user
        if (service !== 'cron' && service !== 'systemd-user') {
            let ipMatch = line.match(/(\d+\.\d+\.\d+\.\d+)/);
            return {
                type: "logout",
                username: username,
                ip: ipMatch ? ipMatch[1] : "localhost",
                raw: line,
                timestamp: new Date()
            };
        }
    }

    // ⚠️ SUDO command detection
    let sudo = line.match(/sudo:.*USER=(\w+)\s*;\s*COMMAND=(.*)/);
    if (sudo) {
        return {
            type: "sudo",
            username: sudo[1],
            command: sudo[2],
            raw: line,
            timestamp: new Date()
        };
    }

    return null;
}

module.exports = parseLog;
