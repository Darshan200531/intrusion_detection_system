// Parser
function parseLog(line) {

    // 🔴 SSH Failed login
    let failed = line.match(/Failed password.*for (invalid user )?(\w+) from (\d+\.\d+\.\d+\.\d+)/);
    if (failed) {
        return {
            type: "failed_login",
            username: failed[2],
            ip: failed[3],
            raw: line,
            timestamp: new Date()
        };
    }

    // 🟢 SSH Successful login
    let success = line.match(/Accepted password for (\w+) from (\d+\.\d+\.\d+\.\d+)/);
    if (success) {
        return {
            type: "success_login",
            username: success[1],
            ip: success[2],
            raw: line,
            timestamp: new Date()
        };
    }

    // 🚪 SSH Logout
    let logout = line.match(/Disconnected from user (\w+) (\d+\.\d+\.\d+\.\d+)/) || line.match(/session closed for user (\w+)/);
    if (logout) {
        let ipMatch = line.match(/(\d+\.\d+\.\d+\.\d+)/);
        return {
            type: "logout",
            username: logout[1],
            ip: ipMatch ? ipMatch[1] : "unknown",
            raw: line,
            timestamp: new Date()
        };
    }

    // ⚠️ SUDO command detection (IMPORTANT FIX)
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
