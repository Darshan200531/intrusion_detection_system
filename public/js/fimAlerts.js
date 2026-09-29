/**
 * fimAlerts.js
 * Manages the File Integrity Monitoring (FIM) view:
 *  - Fetches FIM status cards, baseline table, and event history
 *  - Listens for real-time FIM alerts via Socket.IO
 *  - Handles manual baseline rebuild button
 */

let fimBaselinesList = [];

// ─── Render FIM View ─────────────────────────────────────────────────────────
function renderFIMView(stats) {
    if (!stats) return;

    // Stat cards
    const monitoredEl = document.getElementById('count-fim-monitored');
    const unchangedEl = document.getElementById('count-fim-unchanged');
    const modifiedEl  = document.getElementById('count-fim-modified');
    const deletedEl   = document.getElementById('count-fim-deleted');
    const criticalEl  = document.getElementById('count-fim-critical');

    if (monitoredEl) monitoredEl.textContent = stats.monitoredCount || 0;
    if (unchangedEl) unchangedEl.textContent = stats.unchangedCount || 0;
    if (modifiedEl)  modifiedEl.textContent  = stats.modifiedCount  || 0;
    if (deletedEl)   deletedEl.textContent   = stats.deletedCount   || 0;
    if (criticalEl)  criticalEl.textContent  = stats.criticalAlerts || 0;

    // Status table
    const tableBody = document.getElementById('fim-status-table-body');
    if (tableBody && stats.fileStatuses) {
        tableBody.innerHTML = stats.fileStatuses.map(item => {
            const statusClass = item.status === 'UNCHANGED' ? 'status-ok' : item.status === 'MODIFIED' ? 'status-warn' : 'status-danger';
            const badgeIcon   = item.status === 'UNCHANGED' ? '✅' : item.status === 'MODIFIED' ? '⚠️' : '🚨';
            const currentHash = item.hash || item.newHash || (item.status === 'DELETED' ? 'DELETED' : 'N/A');
            const displayHash = currentHash.length > 20 ? `${currentHash.substring(0, 16)}...` : currentHash;
            const fullHash    = currentHash !== 'DELETED' && currentHash !== 'N/A' ? currentHash : '';

            return `
                <tr>
                    <td class="fim-filepath"><code>${item.filePath}</code></td>
                    <td><span class="badge ${statusClass}">${badgeIcon} ${item.status}</span></td>
                    <td><span class="hash-code" title="${fullHash}">${displayHash}</span></td>
                    <td>
                        <button class="btn-rebuild-single" onclick="rebuildSingleBaseline('${item.filePath}')">
                            🔄 Rebuild Baseline
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    }
}

// ─── Fetch FIM Stats Only (does not touch alert feed) ────────────────────────
async function fetchFIMStats() {
    try {
        const res = await fetch('/api/fim/stats');
        if (res.ok) {
            const stats = await res.json();
            renderFIMView(stats);
        }
    } catch (err) {
        console.error('Error fetching FIM stats:', err);
    }
}

// ─── Fetch Initial FIM Events on Page Load ──────────────────────────────────
async function loadInitialFIMEvents() {
    try {
        const res = await fetch('/api/fim/events');
        if (res.ok) {
            const events = await res.json();
            const container = document.getElementById('fim-alerts-container');
            const emptyState = document.getElementById('fim-empty-state');
            if (container) {
                container.querySelectorAll('.alert-item').forEach(el => el.remove());
                if (events && events.length > 0) {
                    if (emptyState) emptyState.style.display = 'none';
                    // Render oldest first so prepending leaves newest at top
                    [...events].reverse().forEach(ev => handleNewFIMAlert(ev, false));
                } else {
                    if (emptyState) emptyState.style.display = 'block';
                }
            }
        }
    } catch (err) {
        console.error('Error loading FIM events:', err);
    }
}

// ─── Full Data Refresh (Stats + Baselines + Feed) ───────────────────────────
async function fetchFIMData() {
    await Promise.all([fetchFIMStats(), loadInitialFIMEvents()]);
}

// ─── Rebuild Baselines ──────────────────────────────────────────────────────
async function rebuildSingleBaseline(filePath) {
    if (!confirm(`Are you sure you want to rebuild the trusted SHA-256 baseline for:\n${filePath}?`)) {
        return;
    }

    try {
        const res = await fetch('/api/fim/baseline/rebuild', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filePath })
        });
        const data = await res.json();
        if (data.ok) {
            if (typeof showToast === 'function') showToast(`✅ Baseline rebuilt for ${filePath}`, 'success');
            fetchFIMStats();
        } else {
            if (typeof showToast === 'function') showToast(`❌ ${data.error}`, 'error');
        }
    } catch (err) {
        console.error('Rebuild baseline error:', err);
    }
}

async function rebuildAllBaselines() {
    if (!confirm('Are you sure you want to rebuild trusted baselines for ALL monitored files?')) {
        return;
    }

    try {
        const res = await fetch('/api/fim/baseline/rebuild', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });
        const data = await res.json();
        if (data.ok) {
            if (typeof showToast === 'function') showToast(`✅ Rebuilt baselines for ${data.baselines ? data.baselines.length : 0} file(s)`, 'success');
            fetchFIMStats();
        }
    } catch (err) {
        console.error('Rebuild all baselines error:', err);
    }
}

// ─── Simulate FIM Event (for testing) ───────────────────────────────────────
async function simulateFIMViolation() {
    try {
        const res = await fetch('/api/fim/simulate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ eventType: 'FILE_MODIFIED' })
        });
        const data = await res.json();
        if (data.ok) {
            console.log('⚡ Simulated FIM event triggered:', data);
        }
    } catch (err) {
        console.error('Simulate FIM error:', err);
    }
}

// ─── Handle New Real-time FIM Alert ──────────────────────────────────────────
function handleNewFIMAlert(data, incrementStats = true) {
    const container = document.getElementById('fim-alerts-container');
    const emptyState = document.getElementById('fim-empty-state');
    if (!container) return;

    if (emptyState) emptyState.style.display = 'none';

    const eventType = data.eventType || data.type || 'FILE_MODIFIED';
    const filePath  = data.filePath  || '—';
    const oldHash   = data.oldHash   ? `<br><small style="color:#94a3b8;">Old SHA-256: <code>${data.oldHash.substring(0, 16)}...</code></small>` : '';
    const newHash   = data.newHash   ? `<br><small style="color:#f87171;">New SHA-256: <code>${data.newHash.substring(0, 16)}...</code></small>` : '';
    const message   = data.message   ? `<br><small style="color:#cbd5e1;font-size:0.8rem;">${data.message}</small>` : '';

    let icon = '⚠️', severity = data.severity || 'HIGH';
    if (eventType === 'FILE_DELETED' || severity === 'CRITICAL' || severity === 'critical') {
        icon = '🚨';
        severity = 'CRITICAL';
    }

    const el = document.createElement('div');
    el.className = `alert-item fim-alert ${severity.toLowerCase()}`;
    el.innerHTML = `
        <div class="alert-content">
            <div class="alert-title">${icon} [FIM] ${eventType} — ${severity}</div>
            <div class="alert-details">
                File: <code>${filePath}</code>
                ${oldHash}
                ${newHash}
                ${message}
            </div>
        </div>
        <div class="alert-time">${data.timestamp || new Date().toLocaleString()}</div>
    `;

    container.prepend(el);

    // Cap at 50 alerts
    const items = container.querySelectorAll('.alert-item');
    if (items.length > 50) items[items.length - 1].remove();

    // Only update stats, NEVER wipe the alerts feed!
    if (incrementStats) {
        // Optimistically increment cards
        const modEl = document.getElementById('count-fim-modified');
        const delEl = document.getElementById('count-fim-deleted');
        const critEl = document.getElementById('count-fim-critical');

        if (eventType === 'FILE_DELETED' && delEl) {
            delEl.textContent = (parseInt(delEl.textContent) || 0) + 1;
        } else if (modEl) {
            modEl.textContent = (parseInt(modEl.textContent) || 0) + 1;
        }

        if ((severity === 'CRITICAL' || severity === 'HIGH') && critEl) {
            critEl.textContent = (parseInt(critEl.textContent) || 0) + 1;
        }

        // Fetch fresh stats from backend (without clearing alert feed)
        fetchFIMStats();
    }
}

// ─── Init FIM UI Listeners ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    fetchFIMData();

    document.getElementById('fim-refresh')?.addEventListener('click', fetchFIMData);
    document.getElementById('fim-rebuild-all')?.addEventListener('click', rebuildAllBaselines);
    document.getElementById('fim-simulate-btn')?.addEventListener('click', simulateFIMViolation);

    const fimNavBtn = document.querySelector('[data-target="fim-view"]');
    if (fimNavBtn) {
        fimNavBtn.addEventListener('click', fetchFIMStats);
    }
});

window.handleNewFIMAlert = handleNewFIMAlert;
window.fetchFIMData = fetchFIMData;
window.fetchFIMStats = fetchFIMStats;
window.rebuildSingleBaseline = rebuildSingleBaseline;
window.simulateFIMViolation = simulateFIMViolation;
