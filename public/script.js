document.addEventListener('DOMContentLoaded', () => {
    const alertsContainer = document.getElementById('alerts-container');
    const emptyState = document.getElementById('empty-state');
    
    let countSuccess = 0;
    let countFailed = 0;
    let countLogout = 0;
    let countAttacks = 0;

    const successEl = document.getElementById('count-success');
    const failedEl = document.getElementById('count-failed');
    const logoutEl = document.getElementById('count-logout');
    const attacksEl = document.getElementById('count-attacks');

    // Setup SSE Connection
    const evtSource = new EventSource('/api/alerts/stream');

    evtSource.onmessage = function(event) {
        const data = JSON.parse(event.data);
        handleNewAlert(data);
    };

    evtSource.onerror = function(err) {
        console.error("EventSource failed:", err);
    };

    function handleNewAlert(data) {
        if (emptyState) {
            emptyState.style.display = 'none';
        }

        // Update counters
        if (data.type === 'success') {
            countSuccess++;
            successEl.textContent = countSuccess;
        } else if (data.type === 'failed') {
            countFailed++;
            failedEl.textContent = countFailed;
        } else if (data.type === 'logout') {
            countLogout++;
            if (logoutEl) logoutEl.textContent = countLogout;
        } else if (data.type === 'attack') {
            countAttacks++;
            attacksEl.textContent = countAttacks;
        }

        // Create alert element
        const alertEl = document.createElement('div');
        alertEl.className = `alert-item ${data.type}`;
        
        let icon = 'ℹ️';
        let title = 'Activity';
        let details = `IP: <span class="alert-ip">${data.ip}</span>`;

        if (data.type === 'success') {
            icon = '✅';
            title = 'Successful Login';
            details += ` | User: ${data.username}`;
        } else if (data.type === 'failed') {
            icon = '⚠️';
            title = 'Failed Login';
            details += ` | User: ${data.username}`;
        } else if (data.type === 'logout') {
            icon = '🚪';
            title = 'User Logout';
            details += ` | User: ${data.username}`;
        } else if (data.type === 'attack') {
            icon = '🚨';
            title = 'BRUTE FORCE BLOCKED';
            details += ` | Attempts: ${data.count} | Action: IP Dropped`;
            
            // Add a shake effect to the container or screen for critical alerts
            document.body.style.animation = 'shake 0.5s';
            setTimeout(() => { document.body.style.animation = ''; }, 500);
        }

        alertEl.innerHTML = `
            <div class="alert-content">
                <div class="alert-title">${icon} ${title}</div>
                <div class="alert-details">${details}</div>
            </div>
            <div class="alert-time">${data.timestamp}</div>
        `;

        // Add to the top of the container
        alertsContainer.prepend(alertEl);

        // Limit the number of alerts shown (e.g., max 50)
        if (alertsContainer.children.length > 50) {
            alertsContainer.removeChild(alertsContainer.lastChild);
        }
    }
});

// Add keyframes for shake effect dynamically
const style = document.createElement('style');
style.innerHTML = `
@keyframes shake {
  0% { transform: translate(1px, 1px) rotate(0deg); }
  10% { transform: translate(-1px, -2px) rotate(-1deg); }
  20% { transform: translate(-3px, 0px) rotate(1deg); }
  30% { transform: translate(3px, 2px) rotate(0deg); }
  40% { transform: translate(1px, -1px) rotate(1deg); }
  50% { transform: translate(-1px, 2px) rotate(-1deg); }
  60% { transform: translate(-3px, 1px) rotate(0deg); }
  70% { transform: translate(3px, 1px) rotate(-1deg); }
  80% { transform: translate(-1px, -1px) rotate(1deg); }
  90% { transform: translate(1px, 2px) rotate(0deg); }
  100% { transform: translate(1px, -2px) rotate(-1deg); }
}
`;
document.head.appendChild(style);
