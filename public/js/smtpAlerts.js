document.addEventListener('DOMContentLoaded', () => {
    const smtpAlertsContainer = document.getElementById('smtp-alerts-container');
    const smtpEmptyState = document.getElementById('smtp-empty-state');
    const smtpTotalEl = document.getElementById('count-smtp-total');
    const smtpRecentEl = document.getElementById('count-smtp-recent');

    let countTotal = 0;
    let countRecent = 0;

    // Fetch initial stats
    fetch('/api/smtp/stats')
        .then(res => res.json())
        .then(data => {
            countTotal = data.totalAlerts || 0;
            countRecent = data.recentEvents || 0;
            updateSMTPStats();
        })
        .catch(err => console.error('Error fetching SMTP stats', err));

    // Fetch initial history
    fetch('/api/smtp/alerts')
        .then(res => res.json())
        .then(data => {
            data.reverse().forEach(alert => {
                handleNewSMTPAlert({
                    type: alert.eventType,
                    ip: alert.sourceIp,
                    username: alert.username,
                    message: alert.message,
                    severity: alert.severity,
                    timestamp: new Date(alert.timestamp).toLocaleString()
                }, false);
            });
        })
        .catch(err => console.error('Error fetching SMTP alerts', err));


    function updateSMTPStats() {
        if(smtpTotalEl) smtpTotalEl.textContent = countTotal;
        if(smtpRecentEl) smtpRecentEl.textContent = countRecent;
    }

    // Expose handler globally so script.js can call it via socket.io
    window.handleNewSMTPAlert = function(data, incrementStats = true) {
        if (incrementStats) {
            countTotal++;
            countRecent++;
            updateSMTPStats();
        }

        let icon = 'ℹ️';
        if (data.severity === 'critical') icon = '🚨';
        else if (data.severity === 'high') icon = '⚠️';
        else if (data.severity === 'medium') icon = '👀';

        let title = data.type.replace('_', ' ').toUpperCase();
        let details = `IP: <span class="alert-ip">${data.ip}</span>`;
        if (data.username) details += ` | User: ${data.username}`;
        details += `<br><small>${data.message}</small>`;

        const alertEl = document.createElement('div');
        alertEl.className = `alert-item smtp-alert ${data.severity}`;
        alertEl.innerHTML = `
            <div class="alert-content">
                <div class="alert-title">${icon} ${title}</div>
                <div class="alert-details">${details}</div>
            </div>
            <div class="alert-time">${data.timestamp}</div>
        `;

        smtpAlertsContainer.prepend(alertEl);

        if (smtpAlertsContainer.children.length > 50) {
            smtpAlertsContainer.removeChild(smtpAlertsContainer.lastChild);
        }

        if (smtpEmptyState) {
            smtpEmptyState.style.display = 'none';
        }
    };
});
