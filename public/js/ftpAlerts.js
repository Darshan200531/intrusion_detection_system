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

    // Fetch initial history
    fetch('/api/ftp/alerts')
        .then(res => res.json())
        .then(data => {
            // Data is sorted descending, so we need to reverse if we append or just append correctly
            data.reverse().forEach(alert => {
                // mock the required fields for handleNewFTPAlert
                handleNewFTPAlert({
                    type: alert.eventType,
                    ip: alert.sourceIp,
                    username: alert.username,
                    message: alert.message,
                    severity: alert.severity,
                    timestamp: new Date(alert.timestamp).toLocaleString()
                }, false);
            });
        })
        .catch(err => console.error('Error fetching FTP alerts', err));


    function updateFTPStats() {
        if(ftpTotalEl) ftpTotalEl.textContent = countTotal;
        if(ftpRecentEl) ftpRecentEl.textContent = countRecent;
    }

    // Expose handler globally so script.js can call it via socket.io
    window.handleNewFTPAlert = function(data, incrementStats = true) {
        if (incrementStats) {
            countTotal++;
            countRecent++;
            updateFTPStats();
        }

        const eventType = data.type || data.eventType || 'unknown';
        let icon = 'ℹ️';
        if (data.severity === 'critical') icon = '🚨';
        else if (data.severity === 'high') icon = '⚠️';
        else if (data.severity === 'medium') icon = '👀';

        let title = eventType.replace(/_/g, ' ').toUpperCase();
        let details = `IP: <span class="alert-ip">${data.ip || '—'}</span>`;
        if (data.username) details += ` | User: ${data.username}`;
        if (data.message) details += `<br><small>${data.message}</small>`;

        const alertEl = document.createElement('div');
        alertEl.className = `alert-item ftp-alert ${data.severity || 'low'}`;
        alertEl.innerHTML = `
            <div class="alert-content">
                <div class="alert-title">${icon} ${title}</div>
                <div class="alert-details">${details}</div>
            </div>
            <div class="alert-time">${data.timestamp || ''}</div>
        `;

        // Hide empty state and move it out before prepending
        if (ftpEmptyState) ftpEmptyState.style.display = 'none';

        ftpAlertsContainer.prepend(alertEl);

        // Cap at 50 alert items (exclude the empty-state element)
        const alertItems = ftpAlertsContainer.querySelectorAll('.alert-item');
        if (alertItems.length > 50) {
            alertItems[alertItems.length - 1].remove();
        }
    };
});
