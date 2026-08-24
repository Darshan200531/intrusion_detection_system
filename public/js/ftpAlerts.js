document.addEventListener('DOMContentLoaded', () => {
    const ftpAlertsContainer = document.getElementById('ftp-alerts-container');
    const ftpEmptyState = document.getElementById('ftp-empty-state');
    const ftpTotalEl = document.getElementById('count-ftp-total');
    const ftpRecentEl = document.getElementById('count-ftp-recent');

    let countTotal = 0;
    let countRecent = 0;

    // Fetch initial stats
    fetch('/api/ftp/stats')
        .then(res => res.json())
        .then(data => {
            countTotal = data.totalAlerts || 0;
            countRecent = data.recentEvents || 0;
            updateFTPStats();
        })
        .catch(err => console.error('Error fetching FTP stats', err));

    // Fetch initial history from MongoDB
    fetch('/api/ftp/alerts')
        .then(res => res.json())
        .then(data => {
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
        })
        .catch(err => console.error('Error fetching FTP alerts', err));

    function updateFTPStats() {
        if (ftpTotalEl) ftpTotalEl.textContent = countTotal;
        if (ftpRecentEl) ftpRecentEl.textContent = countRecent;
    }

    // Expose handler globally so script.js / Socket.IO can call it
    window.handleNewFTPAlert = function(data, incrementStats = true) {
        if (incrementStats) {
            countTotal++;
            countRecent++;
            updateFTPStats();
        }

        const eventType = data.type || data.eventType || 'unknown';
        const ip = data.ip || data.sourceIp || '—';
        const filename = data.filename ? ` | File: <code>${data.filename}</code>` : '';
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
        details += action + filename + reason + message;

        const alertEl = document.createElement('div');
        alertEl.className = `alert-item ftp-alert ${data.severity || 'low'}`;
        alertEl.innerHTML = `
            <div class="alert-content">
                <div class="alert-title">${icon} ${title}</div>
                <div class="alert-details">${details}</div>
            </div>
            <div class="alert-time">${data.timestamp || ''}</div>
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
});
