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

// ─── Fetch FIM Stats & Events ────────────────────────────────────────────────
async function fetchFIMData() {
    try {
        const [statsRes, eventsRes] = await Promise.all([
            fetch('/api/fim/stats'),
            fetch('/api/fim/events')
        ]);

        if (statsRes.ok) {
            const stats = await statsRes.json();
            renderFIMView(stats);
        }

        if (eventsRes.ok) {
            const events = await eventsRes.json();
            const container = document.getElementById('fim-alerts-container');
            const emptyState = document.getElementById('fim-empty-state');
            if (container) {
                // Clear container except empty state
                container.querySelectorAll('.alert-item').forEach(el => el.remove());
                events.reverse().forEach(ev => handleNewFIMAlert(ev, false));
            }
        }
    } catch (err) {
        console.error('Error loading FIM data:', err);
    }
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
            fetchFIMData();
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
            fetchFIMData();
        }
    } catch (err) {
        console.error('Rebuild all baselines error:', err);
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

    let icon = '⚠️', severity = data.severity || 'HIGH';
    if (eventType === 'FILE_DELETED' || severity === 'CRITICAL') icon = '🚨';

    const el = document.createElement('div');
    el.className = `alert-item fim-alert ${severity.toLowerCase()}`;
    el.innerHTML = `
        <div class="alert-content">
            <div class="alert-title">${icon} [FIM] ${eventType} — ${severity}</div>
            <div class="alert-details">
                File: <code>${filePath}</code>
                ${oldHash}
                ${newHash}
            </div>
        </div>
        <div class="alert-time">${data.timestamp || new Date().toLocaleString()}</div>
    `;

    container.prepend(el);

    // Cap at 50 alerts
    const items = container.querySelectorAll('.alert-item');
    if (items.length > 50) items[items.length - 1].remove();

    if (incrementStats) {
        fetchFIMData();
    }
}

// ─── Init FIM UI Listeners ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    fetchFIMData();

    document.getElementById('fim-refresh')?.addEventListener('click', fetchFIMData);
    document.getElementById('fim-rebuild-all')?.addEventListener('click', rebuildAllBaselines);

    const fimNavBtn = document.querySelector('[data-target="fim-view"]');
    if (fimNavBtn) {
        fimNavBtn.addEventListener('click', fetchFIMData);
    }
});

window.handleNewFIMAlert = handleNewFIMAlert;
window.fetchFIMData = fetchFIMData;
window.rebuildSingleBaseline = rebuildSingleBaseline;
