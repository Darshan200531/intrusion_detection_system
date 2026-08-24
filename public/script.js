/**
 * script.js
 * Core dashboard script:
 *  - Sidebar navigation
 *  - Socket.IO listener for all services
 *  - SSH live-feed handler
 *  - Delegation to FTP, SMTP, Analytics, and History handlers
 */


// ─── Socket.IO ────────────────────────────────────────────────────────────────
const socket = io();

// ─── Page titles per view ─────────────────────────────────────────────────────
const PAGE_TITLES = {
    'dashboard-view': 'Analytics Overview',
    'ssh-view':       'SSH Activity',
    'iptable-view':   'IPTable — Blocked IPs',
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

        // empty-state is now a sibling of alerts-container, not inside it
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

    // ─── SSH Stats & History ────────────────────────────────────────────────
    async function loadSSHStats() {
        try {
            const res = await fetch('/api/ssh/stats');
            if (!res.ok) return;
            const data = await res.json();
            countSuccess = data.successCount || 0;
            countFailed  = data.failedCount  || 0;
            countAttacks = data.attackCount  || 0;
            if (successEl) successEl.textContent = countSuccess;
            if (failedEl)  failedEl.textContent  = countFailed;
            if (attacksEl) attacksEl.textContent = countAttacks;
        } catch (err) {
            console.error('SSH stats load error:', err);
        }
    }

    async function loadSSHHistory() {
        try {
            const res = await fetch('/api/ssh/history');
            if (!res.ok) return;
            const history = await res.json();
            if (alertsContainer) alertsContainer.innerHTML = '';
            // Render oldest first so prepending leaves newest at top
            [...history].reverse().forEach(data => handleNewSSHAlert(data, false));
            applySSHFilter();
        } catch (err) {
            console.error('SSH history load error:', err);
        }
    }

    loadSSHStats();
    loadSSHHistory();

    // ─── Socket.IO listeners ──────────────────────────────────────────────────
    socket.on('alert', data => {
        const svc = data.service;

        // Update analytics live
        if (typeof updateAnalyticsOnAlert === 'function') updateAnalyticsOnAlert(svc);

        // Update history live (normalise shape)
        if (typeof window.prependHistoryRow === 'function') {
            window.prependHistoryRow({
                service:       svc,
                timestamp:     data.timestamp ? new Date(data.timestamp).toISOString() : new Date().toISOString(),
                sourceIp:      data.ip,
                username:      data.username,
                eventType:     data.eventType || data.type,
                severity:      data.severity || 'low',
                message:       data.message  || '',
                detectionRule: data.detectionRule || null
            });
        }

        if (svc === 'SSH')  handleNewSSHAlert(data, true);
        if (svc === 'FTP'  && window.handleNewFTPAlert)  window.handleNewFTPAlert(data);
        if (svc === 'SMTP' && window.handleNewSMTPAlert) window.handleNewSMTPAlert(data);
    });

    // Real-time blocked IPs list update
    socket.on('blocked_ips_update', (ips) => {
        if (typeof window.handleBlockedIpsUpdate === 'function') {
            window.handleBlockedIpsUpdate(ips);
        }
    });

    // ─── SSH alert renderer ─────────────────────────────────────────────────────
    function handleNewSSHAlert(data, incrementStats = true) {
        // Normalise type: DB stores 'failed_login'/'success_login',
        // live events use 'failed'/'success'. Map to the short form.
        const typeMap = {
            'failed_login':    'failed',
            'success_login':   'success',
            'attack':          'attack',
            'blocked_attempt': 'blocked_attempt'
        };
        const type = typeMap[data.type] || data.type;

        // Count by normalised type (only for live events, not initial history load)
        if (incrementStats) {
            if (type === 'success') { countSuccess++; if (successEl) successEl.textContent = countSuccess; }
            else if (type === 'failed')  { countFailed++;  if (failedEl)  failedEl.textContent  = countFailed; }
            else if (type === 'attack' || type === 'blocked_attempt') {
                countAttacks++;
                if (attacksEl) attacksEl.textContent = countAttacks;
            }
        }

        let icon = 'ℹ️', title = 'Activity';
        let details = `IP: <span class="alert-ip">${data.ip || '—'}</span>`;

        if (type === 'success') {
            icon = '✅'; title = 'Successful Login';
            details += data.username ? ` | User: ${data.username}` : '';
        } else if (type === 'failed') {
            icon = '⚠️'; title = 'Failed Login';
            details += data.username ? ` | User: ${data.username}` : '';
        } else if (type === 'attack') {
            icon = '🚨'; title = 'BRUTE FORCE BLOCKED';
            details += data.count ? ` | Attempts: ${data.count} | IP Blocked` : ' | IP Blocked';
            document.body.style.animation = 'shake 0.5s';
            setTimeout(() => { document.body.style.animation = ''; }, 500);
        } else if (type === 'blocked_attempt') {
            icon = '🚫'; title = 'Blocked IP Denied';
            details += data.username ? ` | User: ${data.username}` : '';
        }

        const el = document.createElement('div');
        el.className = `alert-item ${type}`;

        // Safely format timestamp (may be a Date object, ISO string, or localised string)
        let displayTime = data.timestamp;
        if (data.timestamp && !isNaN(Date.parse(data.timestamp))) {
            displayTime = new Date(data.timestamp).toLocaleString();
        }

        el.innerHTML = `
            <div class="alert-content">
                <div class="alert-title">${icon} ${title}</div>
                <div class="alert-details">${details}</div>
            </div>
            <div class="alert-time">${displayTime}</div>
        `;

        // Apply current filter using the normalised type
        let show = true;
        if (currentFilter === 'success' && type !== 'success') show = false;
        if (currentFilter === 'failed'  && type !== 'failed')  show = false;
        if (currentFilter === 'attacks' && type !== 'attack' && type !== 'blocked_attempt') show = false;
        if (!show) el.classList.add('hidden');

        // Hide empty state immediately on first item
        if (emptyState) emptyState.style.display = 'none';

        if (alertsContainer) {
            alertsContainer.prepend(el);
            // Cap at 50 alert items (use querySelectorAll to exclude non-item children)
            const allItems = alertsContainer.querySelectorAll('.alert-item');
            if (allItems.length > 50) allItems[allItems.length - 1].remove();
        }

        applySSHFilter();
    }
});
