/**
 * script.js
 * Core dashboard script:
 *  - Sidebar navigation
 *  - Socket.IO listener for all services
 *  - SSH live-feed handler
 *  - Delegation to FTP, SMTP, Analytics, and History handlers
 */

// ─── Simulate API ─────────────────────────────────────────────────────────────
function simulate(type) {
    fetch('/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type })
    });
}

// ─── Shake animation (brute-force) ───────────────────────────────────────────
const shakeStyle = document.createElement('style');
shakeStyle.innerHTML = `
@keyframes shake {
  0%,100% { transform: translate(0); }
  10%,50%,90% { transform: translate(-3px, 1px); }
  30%,70% { transform: translate(3px, -1px); }
}`;
document.head.appendChild(shakeStyle);

// ─── Socket.IO ────────────────────────────────────────────────────────────────
const socket = io();

// ─── Page titles per view ─────────────────────────────────────────────────────
const PAGE_TITLES = {
    'dashboard-view': 'Analytics Overview',
    'ssh-view':       'SSH Activity',
    'ftp-view':       'FTP Activity',
    'smtp-view':      'SMTP Activity',
    'history-view':   'History Logs'
};

// ─── Sidebar Navigation ───────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    const navBtns       = document.querySelectorAll('.nav-btn');
    const viewSections  = document.querySelectorAll('.view-section');
    const pageTitleEl   = document.getElementById('page-title');

    navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const target = btn.getAttribute('data-target');

            // Swap active button
            navBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Swap view
            viewSections.forEach(sec => {
                if (sec.id === target) {
                    sec.style.display = 'block';
                } else {
                    sec.style.display = 'none';
                }
            });

            // Update topbar title
            if (pageTitleEl) pageTitleEl.textContent = PAGE_TITLES[target] || 'Dashboard';
        });
    });

    // ─── SSH counters + feed ─────────────────────────────────────────────────
    const alertsContainer = document.getElementById('alerts-container');
    const emptyState      = document.getElementById('empty-state');

    let countSuccess = 0;
    let countFailed  = 0;
    let countAttacks = 0;

    const successEl = document.getElementById('count-success');
    const failedEl  = document.getElementById('count-failed');
    const attacksEl = document.getElementById('count-attacks');

    const cardSuccess = document.getElementById('card-success');
    const cardFailed  = document.getElementById('card-failed');
    const cardAttacks = document.getElementById('card-attacks');

    // SSH card filter
    let currentFilter = null;

    function toggleFilter(filterType, cardEl) {
        if (currentFilter === filterType) {
            currentFilter = null;
            cardEl.classList.remove('active');
        } else {
            document.querySelector('#ssh-view .card.active')?.classList.remove('active');
            currentFilter = filterType;
            cardEl.classList.add('active');
        }
        applySSHFilter();
    }

    cardSuccess?.addEventListener('click', () => toggleFilter('success', cardSuccess));
    cardFailed?.addEventListener('click',  () => toggleFilter('failed',  cardFailed));
    cardAttacks?.addEventListener('click', () => toggleFilter('attacks', cardAttacks));

    function applySSHFilter() {
        const items = document.querySelectorAll('#alerts-container .alert-item');
        let visible = 0;

        items.forEach(item => {
            let show = true;
            if (currentFilter === 'success' && !item.classList.contains('success')) show = false;
            if (currentFilter === 'failed'  && !item.classList.contains('failed'))  show = false;
            if (currentFilter === 'attacks' && !item.classList.contains('attack') && !item.classList.contains('blocked_attempt')) show = false;

            item.classList.toggle('hidden', !show);
            if (show) visible++;
        });

        if (!emptyState) return;
        if (items.length === 0) {
            emptyState.style.display = 'block';
            emptyState.innerHTML = '<p>No activity recorded yet...</p>';
        } else if (visible === 0) {
            emptyState.style.display = 'block';
            emptyState.innerHTML = '<p>No activity for this filter...</p>';
        } else {
            emptyState.style.display = 'none';
        }
    }

    // ─── Socket.IO listeners ──────────────────────────────────────────────────
    socket.on('ssh_history', history => {
        history.forEach(data => handleNewSSHAlert(data));
    });

    socket.on('alert', data => {
        const svc = data.service;

        // Update analytics live
        if (typeof updateAnalyticsOnAlert === 'function') updateAnalyticsOnAlert(svc);

        // Update history live (normalise shape)
        if (typeof window.prependHistoryRow === 'function') {
            window.prependHistoryRow({
                service:       svc,
                timestamp:     new Date().toISOString(),
                sourceIp:      data.ip,
                username:      data.username,
                eventType:     data.type,
                severity:      data.severity || 'low',
                message:       data.message  || '',
                detectionRule: data.detectionRule || null
            });
        }

        if (svc === 'SSH')  handleNewSSHAlert(data);
        if (svc === 'FTP'  && window.handleNewFTPAlert)  window.handleNewFTPAlert(data);
        if (svc === 'SMTP' && window.handleNewSMTPAlert) window.handleNewSMTPAlert(data);
    });

    // ─── SSH alert renderer ───────────────────────────────────────────────────
    function handleNewSSHAlert(data) {
        if (data.type === 'success') { countSuccess++; if (successEl) successEl.textContent = countSuccess; }
        else if (data.type === 'failed') { countFailed++;  if (failedEl)  failedEl.textContent  = countFailed; }
        else if (data.type === 'attack') { countAttacks++; if (attacksEl) attacksEl.textContent = countAttacks; }

        let icon = 'ℹ️', title = 'Activity';
        let details = `IP: <span class="alert-ip">${data.ip}</span>`;

        if (data.type === 'success') {
            icon = '✅'; title = 'Successful Login';
            details += ` | User: ${data.username}`;
        } else if (data.type === 'failed') {
            icon = '⚠️'; title = 'Failed Login';
            details += ` | User: ${data.username}`;
        } else if (data.type === 'attack') {
            icon = '🚨'; title = 'BRUTE FORCE BLOCKED';
            details += ` | Attempts: ${data.count} | IP Blocked`;
            document.body.style.animation = 'shake 0.5s';
            setTimeout(() => { document.body.style.animation = ''; }, 500);
        } else if (data.type === 'blocked_attempt') {
            icon = '🚫'; title = 'Blocked IP Denied';
            details += ` | User: ${data.username}`;
        }

        const el = document.createElement('div');
        el.className = `alert-item ${data.type}`;
        el.innerHTML = `
            <div class="alert-content">
                <div class="alert-title">${icon} ${title}</div>
                <div class="alert-details">${details}</div>
            </div>
            <div class="alert-time">${data.timestamp}</div>
        `;

        // Apply current filter
        let show = true;
        if (currentFilter === 'success' && data.type !== 'success') show = false;
        if (currentFilter === 'failed'  && data.type !== 'failed')  show = false;
        if (currentFilter === 'attacks' && data.type !== 'attack' && data.type !== 'blocked_attempt') show = false;
        if (!show) el.classList.add('hidden');

        if (alertsContainer) {
            alertsContainer.prepend(el);
            // Cap at 50
            if (alertsContainer.children.length > 51) alertsContainer.removeChild(alertsContainer.lastChild);
        }

        applySSHFilter();
    }
});
