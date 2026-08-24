/**
 * iptable.js
 * Manages the IPTable / Blocked IPs view:
 *  - Fetches current blocked IPs on load
 *  - Listens for real-time `blocked_ips_update` events via Socket.IO
 *  - Renders blocked IP cards with an Unblock button
 *  - Handles unblock DELETE requests with confirmation and feedback
 */

let blockedIpsList = [];

// ─── Render ───────────────────────────────────────────────────────────────────
function renderIPTable(ips) {
    blockedIpsList = ips;

    const grid      = document.getElementById('iptable-grid');
    const empty     = document.getElementById('iptable-empty');
    const countBadge = document.getElementById('iptable-count');

    if (!grid) return;

    // Update badge count
    if (countBadge) {
        countBadge.textContent = `${ips.length} blocked`;
        countBadge.classList.toggle('has-blocked', ips.length > 0);
    }

    if (!ips || ips.length === 0) {
        grid.innerHTML  = '';
        if (empty) empty.style.display = 'flex';
        return;
    }

    if (empty) empty.style.display = 'none';

    grid.innerHTML = ips.map(ip => `
        <div class="ip-card" id="ipcard-${ip.replace(/\./g, '-')}" data-ip="${ip}">
            <div class="ip-card-header">
                <span class="ip-card-icon">🚫</span>
                <span class="ip-card-label">Blocked IP</span>
                <span class="ip-card-status">DROPPED</span>
            </div>
            <div class="ip-address">${ip}</div>
            <div class="ip-card-rule">
                <span class="ip-rule-tag">iptables -A INPUT -s ${ip} -j DROP</span>
            </div>
            <button class="btn-unblock" onclick="unblockIp('${ip}')" id="unblock-${ip.replace(/\./g, '-')}">
                🔓 Unblock IP
            </button>
        </div>
    `).join('');
}

// ─── Unblock ──────────────────────────────────────────────────────────────────
async function unblockIp(ip) {
    const btn   = document.getElementById(`unblock-${ip.replace(/\./g, '-')}`);
    const card  = document.getElementById(`ipcard-${ip.replace(/\./g, '-')}`);

    if (!btn) return;

    // Confirm
    if (!confirm(`Remove ${ip} from the block list?\n\nThis will delete the iptables DROP rule for this IP.`)) return;

    btn.disabled    = true;
    btn.textContent = '⏳ Unblocking...';

    try {
        const res  = await fetch(`/api/blocked-ips/${encodeURIComponent(ip)}`, { method: 'DELETE' });
        const data = await res.json();

        if (res.ok && data.ok) {
            if (card) {
                card.classList.add('ip-card-removing');
                card.style.animation = 'ipCardOut 0.4s ease forwards';
                setTimeout(() => {
                    // Remove from local list and re-render
                    blockedIpsList = blockedIpsList.filter(b => b !== ip);
                    renderIPTable(blockedIpsList);
                    showToast(`✅ ${ip} has been unblocked`, 'success');
                }, 400);
            }
        } else {
            btn.disabled    = false;
            btn.textContent = '🔓 Unblock IP';
            showToast(`❌ Failed: ${data.message}`, 'error');
        }
    } catch (err) {
        console.error('Unblock error:', err);
        btn.disabled    = false;
        btn.textContent = '🔓 Unblock IP';
        showToast('❌ Network error while unblocking', 'error');
    }
}

// ─── Toast Notification ───────────────────────────────────────────────────────
function showToast(message, type = 'success') {
    const existing = document.getElementById('ids-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'ids-toast';
    toast.className = `ids-toast ids-toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    // Trigger animation
    requestAnimationFrame(() => toast.classList.add('ids-toast-show'));

    setTimeout(() => {
        toast.classList.remove('ids-toast-show');
        setTimeout(() => toast.remove(), 400);
    }, 3000);
}

// ─── Fetch from API ───────────────────────────────────────────────────────────
async function fetchBlockedIps() {
    const countBadge = document.getElementById('iptable-count');
    if (countBadge) countBadge.textContent = '⏳ Loading...';

    try {
        const res  = await fetch('/api/blocked-ips');
        const data = await res.json();
        renderIPTable(data);
    } catch (err) {
        console.error('Failed to fetch blocked IPs:', err);
        showToast('❌ Could not load blocked IPs', 'error');
    }
}

// ─── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    // Refresh button
    document.getElementById('iptable-refresh')?.addEventListener('click', fetchBlockedIps);

    // Load when navigating to IPTable view
    const iptableBtn = document.querySelector('[data-target="iptable-view"]');
    if (iptableBtn) {
        iptableBtn.addEventListener('click', fetchBlockedIps);
    }
});

// ─── Socket.IO real-time updates ─────────────────────────────────────────────
// This hook is called from script.js after socket is initialised
window.handleBlockedIpsUpdate = function(ips) {
    renderIPTable(ips);
};

// Expose for external call
window.fetchBlockedIps = fetchBlockedIps;
window.unblockIp = unblockIp;
