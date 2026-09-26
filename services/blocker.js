const { exec } = require('child_process');
const EventEmitter = require('events');
const BlockedIP = require('../models/BlockedIP');
const SSHLog = require('../models/SSHLog');
const FTPLog = require('../models/FTPLog');
const SMTPLog = require('../models/SMTPLog');

const blockerEvents = new EventEmitter();
const blockedIps = new Set();

/**
 * Initialize / Sync blocked IPs from Database & Historical Logs
 */
async function initBlockedIps() {
    try {
        console.log('🔄 Syncing blocked IPs from Database...');
        
        // 1. Fetch existing BlockedIP collection records
        const records = await BlockedIP.find({}).lean();
        const existingMap = new Map();
        records.forEach(r => {
            existingMap.set(r.ip, r.status);
            if (r.status === 'blocked') {
                blockedIps.add(r.ip);
            }
        });

        // 2. Scan historical SSH, FTP, SMTP logs for blocked / attack IPs
        const [sshAttacks, ftpAttacks, smtpAttacks] = await Promise.all([
            SSHLog.find({ eventType: { $in: ['attack', 'blocked_attempt'] } }).lean(),
            FTPLog.find({
                $or: [
                    { detectionRule: { $regex: /Brute Force|Suspicious Transfers/i } },
                    { message: { $regex: /BLOCKED/i } }
                ]
            }).lean(),
            SMTPLog.find({ eventType: 'attack' }).lean()
        ]);

        const historicalIps = new Map(); // ip -> { reason, service, timestamp }
        sshAttacks.forEach(log => {
            const ip = log.sourceIp;
            if (ip && ip !== 'localhost' && ip !== '127.0.0.1') {
                historicalIps.set(ip, {
                    reason: log.message || 'SSH Brute Force Attack',
                    service: 'SSH',
                    timestamp: log.timestamp || new Date()
                });
            }
        });
        ftpAttacks.forEach(log => {
            const ip = log.sourceIp;
            if (ip && ip !== 'localhost' && ip !== '127.0.0.1') {
                historicalIps.set(ip, {
                    reason: log.message || 'FTP Brute Force / Suspicious Transfer',
                    service: 'FTP',
                    timestamp: log.timestamp || new Date()
                });
            }
        });
        smtpAttacks.forEach(log => {
            const ip = log.sourceIp;
            if (ip && ip !== 'localhost' && ip !== '127.0.0.1') {
                historicalIps.set(ip, {
                    reason: log.message || 'SMTP Brute Force Attack',
                    service: 'SMTP',
                    timestamp: log.timestamp || new Date()
                });
            }
        });

        // 3. For any historical IP not in BlockedIP model, insert it with status: 'blocked'
        for (const [ip, info] of historicalIps.entries()) {
            if (!existingMap.has(ip)) {
                await BlockedIP.create({
                    ip,
                    reason: info.reason,
                    service: info.service,
                    status: 'blocked',
                    blockedAt: info.timestamp
                });
                blockedIps.add(ip);
                existingMap.set(ip, 'blocked');
            }
        }

        console.log(`✅ Loaded ${blockedIps.size} blocked IP(s) from Database:`, Array.from(blockedIps));
        blockerEvents.emit('change');
    } catch (err) {
        console.error('❌ Error initializing blocked IPs from DB:', err.message);
    }
}

async function blockIp(ip, reason = 'Brute force attack detected', service = 'System') {
    if (!ip) return;
    
    blockedIps.add(ip);

    try {
        await BlockedIP.updateOne(
            { ip },
            { 
                ip, 
                reason, 
                service, 
                status: 'blocked', 
                blockedAt: new Date() 
            },
            { upsert: true }
        );
    } catch (err) {
        console.error(`❌ Error saving blocked IP ${ip} to DB:`, err.message);
    }

    console.log(`🛡️  Attempting to block IP: ${ip}...`);

    if (process.platform === 'win32') {
        console.log(`✅ [MOCK] Successfully blocked IP ${ip} on Windows (Firewall simulated)`);
    } else {
        const command = `sudo iptables -A INPUT -s ${ip} -j DROP`;
        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error(`❌ Failed to block IP ${ip}: ${error.message}`);
                return;
            }
            if (stderr) console.error(`❌ iptables stderr: ${stderr}`);
            console.log(`✅ Successfully blocked IP ${ip} using iptables`);
        });
    }

    blockerEvents.emit('change');
}

async function unblockIp(ip) {
    if (!ip) return false;
    
    blockedIps.delete(ip);

    try {
        await BlockedIP.updateOne(
            { ip },
            { 
                status: 'unblocked', 
                unblockedAt: new Date() 
            }
        );
    } catch (err) {
        console.error(`❌ Error unblocking IP ${ip} in DB:`, err.message);
    }

    console.log(`🔓 Attempting to unblock IP: ${ip}...`);

    if (process.platform === 'win32') {
        console.log(`✅ [MOCK] Successfully unblocked IP ${ip} on Windows (Firewall simulated)`);
    } else {
        const command = `sudo iptables -D INPUT -s ${ip} -j DROP`;
        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error(`❌ Failed to unblock IP ${ip}: ${error.message}`);
                return;
            }
            console.log(`✅ Successfully unblocked IP ${ip} from iptables`);
        });
    }

    blockerEvents.emit('change');
    return true;
}

function isBlocked(ip) {
    return blockedIps.has(ip);
}

async function getBlockedIps() {
    try {
        const docs = await BlockedIP.find({ status: 'blocked' }).lean();
        const ipsFromDb = docs.map(d => d.ip);
        ipsFromDb.forEach(ip => blockedIps.add(ip));
        return ipsFromDb;
    } catch (err) {
        return Array.from(blockedIps);
    }
}

async function getBlockedIpDetails() {
    try {
        return await BlockedIP.find({ status: 'blocked' }).sort({ blockedAt: -1 }).lean();
    } catch (err) {
        return Array.from(blockedIps).map(ip => ({ ip, status: 'blocked' }));
    }
}

module.exports = {
    initBlockedIps,
    blockIp,
    unblockIp,
    isBlocked,
    getBlockedIps,
    getBlockedIpDetails,
    blockerEvents
};
