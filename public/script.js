// Simulate test events via the API
function simulate(type) {
    fetch('/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type })
    });
}

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

// Initialize Global Socket.IO
const socket = io();

document.addEventListener('DOMContentLoaded', () => {
    // ─── Tab Logic ──────────────────────────────────────────────────────────────
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.style.display = 'none');
            
            btn.classList.add('active');
            const targetId = btn.getAttribute('data-target');
            document.getElementById(targetId).style.display = 'block';
            document.getElementById(targetId).classList.add('active');
        });
    });

    const alertsContainer = document.getElementById('alerts-container');
    const emptyState = document.getElementById('empty-state');

    let currentFilter = null;

    // Counters
    let countSuccess = 0;
    let countFailed = 0;
    let countAttacks = 0;

    const successEl = document.getElementById('count-success');
    const failedEl  = document.getElementById('count-failed');
    const attacksEl = document.getElementById('count-attacks');

    const cardSuccess = document.getElementById('card-success');
    const cardFailed  = document.getElementById('card-failed');
    const cardAttacks = document.getElementById('card-attacks');

    // ─── Filter Logic ───────────────────────────────────────────────────────────
    function toggleFilter(filterType, cardElement) {
        if (currentFilter === filterType) {
            currentFilter = null;
            cardElement.classList.remove('active');
        } else {
            document.querySelector('.card.active')?.classList.remove('active');
            currentFilter = filterType;
            cardElement.classList.add('active');
        }
        applyFilter();
    }

    cardSuccess.addEventListener('click', () => toggleFilter('success', cardSuccess));
    cardFailed.addEventListener('click',  () => toggleFilter('failed',  cardFailed));
    cardAttacks.addEventListener('click', () => toggleFilter('attacks', cardAttacks));

    function applyFilter() {
        const allAlerts = document.querySelectorAll('#ssh-view .alert-item');
        let visibleCount = 0;

        allAlerts.forEach(alert => {
            let isVisible = true;

            if (currentFilter === 'success' && !alert.classList.contains('success')) isVisible = false;
            if (currentFilter === 'failed'  && !alert.classList.contains('failed'))  isVisible = false;
            if (currentFilter === 'attacks'
                && !alert.classList.contains('attack')
                && !alert.classList.contains('blocked_attempt')) isVisible = false;

            if (isVisible) {
                alert.classList.remove('hidden');
                visibleCount++;
            } else {
                alert.classList.add('hidden');
            }
        });

        if (allAlerts.length === 0) {
            emptyState.style.display = 'block';
            emptyState.innerHTML = '<p>No activity recorded yet...</p>';
        } else if (visibleCount === 0) {
            emptyState.style.display = 'block';
            emptyState.innerHTML = '<p>No activity for this filter...</p>';
        } else {
            emptyState.style.display = 'none';
        }
    }

    // ─── Socket.IO Listeners ───────────────────────────────────────────────────
    socket.on('ssh_history', (history) => {
        history.forEach(data => handleNewSSHAlert(data));
    });

    socket.on('alert', (data) => {
        if (data.service === 'SSH') {
            handleNewSSHAlert(data);
        } else if (data.service === 'FTP') {
            if (window.handleNewFTPAlert) window.handleNewFTPAlert(data);
        } else if (data.service === 'SMTP') {
            if (window.handleNewSMTPAlert) window.handleNewSMTPAlert(data);
        }
    });

    // ─── Alert Handler (SSH) ───────────────────────────────────────────────────
    function handleNewSSHAlert(data) {
        if (data.type === 'success') {
            countSuccess++;
            successEl.textContent = countSuccess;
        } else if (data.type === 'failed') {
            countFailed++;
            failedEl.textContent = countFailed;
        } else if (data.type === 'attack') {
            countAttacks++;
            attacksEl.textContent = countAttacks;
        }

        let icon    = 'ℹ️';
        let title   = 'Activity';
        let details = `IP: <span class="alert-ip">${data.ip}</span>`;

        if (data.type === 'success') {
            icon    = '✅';
            title   = 'Successful Login';
            details += ` | User: ${data.username}`;
        } else if (data.type === 'failed') {
            icon    = '⚠️';
            title   = 'Failed Login';
            details += ` | User: ${data.username}`;
        } else if (data.type === 'attack') {
            icon    = '🚨';
            title   = 'BRUTE FORCE BLOCKED';
            details += ` | Attempts: ${data.count} | Action: IP Dropped`;

            document.body.style.animation = 'shake 0.5s';
            setTimeout(() => { document.body.style.animation = ''; }, 500);
        } else if (data.type === 'blocked_attempt') {
            icon    = '🚫';
            title   = 'Blocked IP Denied';
            details += ` | User: ${data.username} | Action: Access Blocked`;
        }

        const alertEl = document.createElement('div');
        alertEl.className = `alert-item ${data.type}`;
        alertEl.innerHTML = `
            <div class="alert-content">
                <div class="alert-title">${icon} ${title}</div>
                <div class="alert-details">${details}</div>
            </div>
            <div class="alert-time">${data.timestamp}</div>
        `;

        let isVisible = true;
        if (currentFilter === 'success' && data.type !== 'success') isVisible = false;
        if (currentFilter === 'failed'  && data.type !== 'failed')  isVisible = false;
        if (currentFilter === 'attacks' && data.type !== 'attack' && data.type !== 'blocked_attempt') isVisible = false;
        if (!isVisible) alertEl.classList.add('hidden');

        alertsContainer.prepend(alertEl);

        if (alertsContainer.children.length > 50) {
            alertsContainer.removeChild(alertsContainer.lastChild);
        }

        applyFilter();
    }
});
