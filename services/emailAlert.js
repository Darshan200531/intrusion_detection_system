/**
 * Email Alert Service for Critical/High HIDS Events (FIM, Brute Force, etc.)
 */
async function sendEmailAlert(alertData) {
    const { filePath, eventType, severity, oldHash, newHash, timestamp } = alertData;

    const subject = `[HIDS] ${severity || 'HIGH'} File Integrity Alert: ${eventType || 'FILE_MODIFIED'}`;
    
    const body = `
==================================================
HIDS File Integrity Alert
==================================================

A file integrity violation has been detected on the system.

File:        ${filePath}
Event:       ${eventType}
Severity:    ${severity}
Timestamp:   ${timestamp || new Date().toLocaleString()}

Old SHA-256: ${oldHash || 'N/A (New or Untracked)'}
New SHA-256: ${newHash || 'N/A (Deleted)'}

==================================================
This is an automated alert from your Host-Based Intrusion Detection System.
`;

    console.log(`\n📧 [EMAIL ALERT TRIGGERED]`);
    console.log(`Subject: ${subject}`);
    console.log(body);
    console.log(`--------------------------------------------------\n`);

    return true;
}

module.exports = { sendEmailAlert };
