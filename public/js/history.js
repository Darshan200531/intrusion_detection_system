/**
 * history.js
 * Fetches the unified history from the backend and renders a filterable, searchable table.
 */

let allLogs = [];

const SERVICE_BADGE = {
    SSH:  'badge-ssh',
    FTP:  'badge-ftp',
    SMTP: 'badge-smtp'
};

const SEVERITY_BADGE = {
    low:      'badge-low',
    medium:   'badge-medium',
    high:     'badge-high',
    critical: 'badge-critical'
};

function formatTimestamp(ts) {
    return new Date(ts).toLocaleString('en-IN', {
        day:    '2-digit',
        month:  'short',
        year:   'numeric',
        hour:   '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}

function renderTable(logs) {
    const tbody = document.getElementById('history-tbody');
    if (!tbody) return;

    if (!logs || logs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="no-results">No records found.</td></tr>`;
        return;
    }

    tbody.innerHTML = logs.map(log => {
        const svcBadge = SERVICE_BADGE[log.service] || 'badge-low';
        const sevBadge = SEVERITY_BADGE[log.severity] || 'badge-low';
        const user = log.username ? `<span style="color:#94a3b8;font-size:0.78rem;">/ ${log.username}</span>` : '';
        const ip = log.sourceIp || '—';
        const eventType = (log.eventType || '—').replace(/_/g, ' ').toUpperCase();
        const rule = log.detectionRule ? `<span style="color:#64748b;font-size:0.78rem;">${log.detectionRule}</span>` : '';
        const msg = log.message || '—';

        return `
            <tr>
                <td>${formatTimestamp(log.timestamp)}</td>
                <td><span class="badge ${svcBadge}">${log.service}</span></td>
                <td><span class="badge ${sevBadge}">${log.severity || 'low'}</span></td>
                <td>
                    <span class="alert-ip" style="font-size:0.8rem;">${ip}</span> ${user}
                </td>
                <td>${eventType}</td>
                <td>
                    <span style="font-size:0.82rem;color:#cbd5e1;">${msg}</span><br>
                    ${rule}
                </td>
            </tr>
        `;
    }).join('');
}

function applyFilters() {
    const search   = (document.getElementById('history-search')?.value || '').toLowerCase().trim();
    const service  = document.getElementById('history-service-filter')?.value  || 'ALL';
    const severity = document.getElementById('history-severity-filter')?.value || 'ALL';

    const filtered = allLogs.filter(log => {
        if (service  !== 'ALL' && log.service  !== service)  return false;
        if (severity !== 'ALL' && log.severity !== severity) return false;

        if (search) {
            const haystack = [
                log.sourceIp, log.username, log.eventType,
                log.detectionRule, log.message, log.service
            ].join(' ').toLowerCase();
            if (!haystack.includes(search)) return false;
        }
        return true;
    });

    renderTable(filtered);
}

async function loadHistory() {
    const tbody = document.getElementById('history-tbody');
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="6" class="no-results" style="font-style:normal;">⏳ Loading...</td></tr>`;

    try {
        const res = await fetch('/api/analytics/history');
        allLogs = await res.json();
        applyFilters();
    } catch (err) {
        console.error('History fetch error:', err);
        tbody.innerHTML = `<tr><td colspan="6" class="no-results">⚠️ Could not load history. Is MongoDB running?</td></tr>`;
    }
}

// Prepend a new log row in real-time when a live alert comes in (from Socket.IO)
function prependHistoryRow(log) {
    allLogs.unshift(log);
    if (allLogs.length > 500) allLogs.pop();
    applyFilters();
}

document.addEventListener('DOMContentLoaded', () => {
    // Wire up filter/search inputs
    document.getElementById('history-search')?.addEventListener('input', applyFilters);
    document.getElementById('history-service-filter')?.addEventListener('change', applyFilters);
    document.getElementById('history-severity-filter')?.addEventListener('change', applyFilters);

    // Load when user navigates to history view
    const historyBtn = document.querySelector('[data-target="history-view"]');
    if (historyBtn) {
        historyBtn.addEventListener('click', loadHistory);
    }
});

// Expose globally for Socket.IO handler
window.prependHistoryRow = prependHistoryRow;
