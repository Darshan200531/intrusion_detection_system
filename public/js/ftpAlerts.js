document.addEventListener('DOMContentLoaded', () => {
    const ftpAlertsContainer = document.getElementById('ftp-alerts-container');
    const ftpEmptyState = document.getElementById('ftp-empty-state');
    const ftpMaliciousContainer = document.getElementById('ftp-malicious-alerts-container');
    const ftpMaliciousEmptyState = document.getElementById('ftp-malicious-empty-state');
    const ftpTotalEl = document.getElementById('count-ftp-total');
    const ftpRecentEl = document.getElementById('count-ftp-recent');
    const ftpMaliciousEl = document.getElementById('count-ftp-malicious');

    let countTotal = 0;
    let countRecent = 0;
    let countMalicious = 0;

    // Fetch initial stats
    fetch('/api/ftp/stats')
        .then(res => res.json())
        .then(data => {
            countTotal = data.totalAlerts || 0;
            countRecent = data.recentEvents || 0;
            countMalicious = data.maliciousCount || 0;
            updateFTPStats();
        })
        .catch(err => console.error('Error fetching FTP stats', err));

    // Fetch initial malicious alerts specifically
    fetch('/api/ftp/malicious')
        .then(res => res.json())
        .then(data => {
            if (data && data.length > 0) {
                if (ftpMaliciousEmptyState) ftpMaliciousEmptyState.style.display = 'none';
                data.reverse().forEach(alert => {
                    renderMaliciousAlertItem({
                        type: alert.eventType,
                        eventType: alert.eventType,
                        ip: alert.sourceIp,
                        sourceIp: alert.sourceIp,
                        username: alert.username,
                        filename: alert.filename,
                        action: alert.action,
                        reason: alert.reason,
                        message: alert.message,
                        severity: alert.severity,
                        detectionRule: alert.detectionRule,
                        timestamp: new Date(alert.timestamp).toLocaleString()
                    });
                });
            } else {
                if (ftpMaliciousEmptyState) ftpMaliciousEmptyState.style.display = 'block';
            }
        })
        .catch(err => console.error('Error fetching FTP malicious alerts', err));

    // Fetch initial history from MongoDB for general feed
    fetch('/api/ftp/alerts')
        .then(res => res.json())
        .then(data => {
            if (data && data.length > 0) {
                if (ftpEmptyState) ftpEmptyState.style.display = 'none';
                data.reverse().forEach(alert => {
                    handleNewFTPAlert({
                        type: alert.eventType,
                        eventType: alert.eventType,
                        ip: alert.sourceIp,
                        sourceIp: alert.sourceIp,
                        username: alert.username,
                        filename: alert.filename,
                        action: alert.action,
                        reason: alert.reason,
                        message: alert.message,
                        severity: alert.severity,
                        detectionRule: alert.detectionRule,
                        timestamp: new Date(alert.timestamp).toLocaleString()
                    }, false);
                });
            }
        })
        .catch(err => console.error('Error fetching FTP alerts', err));

    function updateFTPStats() {
        if (ftpTotalEl) ftpTotalEl.textContent = countTotal;
        if (ftpRecentEl) ftpRecentEl.textContent = countRecent;
        if (ftpMaliciousEl) ftpMaliciousEl.textContent = countMalicious;
    }

    // Render specialized alert card into Malicious File Detection section
    function renderMaliciousAlertItem(data) {
        if (!ftpMaliciousContainer) return;
        if (ftpMaliciousEmptyState) ftpMaliciousEmptyState.style.display = 'none';

        const filename = data.filename ? (data.filename.split('/').pop().split('\\').pop()) : 'unknown_file';
        const ip = data.ip || data.sourceIp || '—';
        const user = data.username || 'unknown';
        const reason = data.reason || data.message || 'Suspicious payload / script detected';
        const severity = (data.severity || 'critical').toLowerCase();

        const itemEl = document.createElement('div');
        itemEl.className = `alert-item ftp-malicious-alert ${severity}`;
        itemEl.innerHTML = `
            <div class="malicious-header-row">
                <div class="malicious-threat-title">
                    <span class="malicious-badge">☣️ MALICIOUS PAYLOAD</span>
                    <strong class="malicious-filename"><code>${filename}</code></strong>
                </div>
                <span class="badge ${severity === 'critical' ? 'status-danger' : 'status-warn'}">${severity.toUpperCase()}</span>
            </div>
            <div class="malicious-details-row">
                <span class="detail-tag"><strong>Target/Action:</strong> ${data.action || 'UPLOAD'}</span>
                <span class="detail-tag"><strong>Attacker IP:</strong> <span class="alert-ip">${ip}</span></span>
                <span class="detail-tag"><strong>User:</strong> ${user}</span>
            </div>
            <div class="malicious-reason">
                ⚠️ <strong>Threat Analysis:</strong> ${reason}
            </div>
            <div class="alert-time" style="margin-top:0.4rem;">${data.timestamp || new Date().toLocaleString()}</div>
        `;

        ftpMaliciousContainer.prepend(itemEl);

        // Cap at 30 items in malicious container
        const items = ftpMaliciousContainer.querySelectorAll('.alert-item');
        if (items.length > 30) {
            items[items.length - 1].remove();
        }
    }

    // Expose handler globally so script.js / Socket.IO can call it
    window.handleNewFTPAlert = function(data, incrementStats = true) {
        const isMalicious = data.isMaliciousFile || 
            (data.detectionRule && /malicious|suspicious/i.test(data.detectionRule)) ||
            (data.filename && (data.severity === 'critical' || data.severity === 'high'));

        if (incrementStats) {
            countTotal++;
            countRecent++;
            if (isMalicious) {
                countMalicious++;
            }
            updateFTPStats();
        }

        // If it's a malicious file alert, render into the dedicated section!
        if (isMalicious) {
            renderMaliciousAlertItem(data);
        }

        // Also render into the general FTP Live Feed
        const eventType = data.type || data.eventType || 'unknown';
        const ip = data.ip || data.sourceIp || '—';
        const cleanFilename = data.filename ? (data.filename.split('/').pop().split('\\').pop()) : '';
        const filenameTag = cleanFilename ? ` | File: <code>${cleanFilename}</code>` : '';
        const action = data.action ? ` | Action: <strong>${data.action}</strong>` : '';
        const reason = data.reason ? `<br><small style="color:#fca5a5;font-weight:600;">Reason: ${data.reason}</small>` : '';
        const message = data.message ? `<br><small style="color:#94a3b8;">${data.message}</small>` : '';

        let icon = 'ℹ️';
        if (data.severity === 'critical') icon = '🚨';
        else if (data.severity === 'high') icon = '⚠️';
        else if (data.severity === 'medium') icon = '👀';

        let title = data.detectionRule || eventType.replace(/_/g, ' ').toUpperCase();
        let details = `IP: <span class="alert-ip">${ip}</span>`;
        if (data.username) details += ` | User: ${data.username}`;
        details += action + filenameTag + reason + message;

        const alertEl = document.createElement('div');
        alertEl.className = `alert-item ftp-alert ${data.severity || 'low'}`;
        alertEl.innerHTML = `
            <div class="alert-content">
                <div class="alert-title">${icon} ${title}</div>
                <div class="alert-details">${details}</div>
            </div>
            <div class="alert-time">${data.timestamp || new Date().toLocaleString()}</div>
        `;

        if (ftpEmptyState) ftpEmptyState.style.display = 'none';

        if (ftpAlertsContainer) {
            ftpAlertsContainer.prepend(alertEl);

            // Cap at 50 alert items
            const alertItems = ftpAlertsContainer.querySelectorAll('.alert-item');
            if (alertItems.length > 50) {
                alertItems[alertItems.length - 1].remove();
            }
        }
    };

    // Wire simulation button for test malicious file upload
    document.getElementById('btn-sim-ftp-malicious')?.addEventListener('click', async () => {
        try {
            const res = await fetch('/api/simulate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'ftp_malicious' })
            });
            const data = await res.json();
            console.log('⚡ Simulated FTP malicious upload triggered:', data);
        } catch (err) {
            console.error('Error simulating FTP malicious upload:', err);
        }
    });
});
