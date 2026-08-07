/**
 * analytics.js
 * Fetches the analytics summary from the backend and renders Chart.js charts.
 * Also updates charts dynamically when new Socket.IO alerts arrive.
 */

let alertsLineChart = null;
let servicesDoughnutChart = null;

// Track real-time counts per service for live chart updates
const liveCounts = { SSH: 0, FTP: 0, SMTP: 0 };

async function initAnalytics() {
    const overviewCards = document.getElementById('overview-cards');

    try {
        const res = await fetch('/api/analytics/summary');
        const data = await res.json();

        const { totalLogs, criticalAlerts } = data;
        const totalSSH = totalLogs.SSH || 0;
        const totalFTP = totalLogs.FTP || 0;
        const totalSMTP = totalLogs.SMTP || 0;
        const totalAll = totalSSH + totalFTP + totalSMTP;
        const critAll = (criticalAlerts.SSH || 0) + (criticalAlerts.FTP || 0) + (criticalAlerts.SMTP || 0);

        // Seed live counts
        liveCounts.SSH = totalSSH;
        liveCounts.FTP = totalFTP;
        liveCounts.SMTP = totalSMTP;

        // Render summary cards
        if (overviewCards) {
            overviewCards.innerHTML = `
                <div class="card">
                    <h3>Total Events</h3>
                    <p class="value" id="ov-total" style="color:#60a5fa;">${totalAll}</p>
                    <span class="card-icon">📋</span>
                </div>
                <div class="card">
                    <h3>SSH Events</h3>
                    <p class="value" id="ov-ssh" style="color:#3b82f6;">${totalSSH}</p>
                    <span class="card-icon">🔑</span>
                </div>
                <div class="card">
                    <h3>FTP Events</h3>
                    <p class="value" id="ov-ftp" style="color:#a78bfa;">${totalFTP}</p>
                    <span class="card-icon">📁</span>
                </div>
                <div class="card">
                    <h3>SMTP Events</h3>
                    <p class="value" id="ov-smtp" style="color:#f59e0b;">${totalSMTP}</p>
                    <span class="card-icon">✉️</span>
                </div>
                <div class="card alert-card">
                    <h3>Critical Alerts</h3>
                    <p class="value" id="ov-critical" style="color:#ef4444;">${critAll}</p>
                    <span class="card-icon">🚨</span>
                </div>
            `;
        }

        renderCharts(totalSSH, totalFTP, totalSMTP);

    } catch (err) {
        console.error('Analytics fetch error:', err);
        if (overviewCards) {
            overviewCards.innerHTML = `<div class="card"><h3>Analytics</h3><p style="color:#64748b;font-size:0.85rem;">Could not load data. Is MongoDB running?</p></div>`;
        }
    }
}

function renderCharts(ssh, ftp, smtp) {
    // ── Doughnut: Alerts by Service ──────────────────────────
    const ctxDoughnut = document.getElementById('servicesChart');
    if (ctxDoughnut) {
        if (servicesDoughnutChart) servicesDoughnutChart.destroy();
        servicesDoughnutChart = new Chart(ctxDoughnut, {
            type: 'doughnut',
            data: {
                labels: ['SSH', 'FTP', 'SMTP'],
                datasets: [{
                    data: [ssh, ftp, smtp],
                    backgroundColor: [
                        'rgba(59,130,246,0.75)',
                        'rgba(167,139,250,0.75)',
                        'rgba(245,158,11,0.75)'
                    ],
                    borderColor: [
                        'rgba(59,130,246,1)',
                        'rgba(167,139,250,1)',
                        'rgba(245,158,11,1)'
                    ],
                    borderWidth: 2,
                    hoverOffset: 10
                }]
            },
            options: {
                responsive: true,
                cutout: '65%',
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { color: '#94a3b8', font: { family: 'Inter', size: 12 }, padding: 16 }
                    },
                    title: {
                        display: true,
                        text: 'Events by Service',
                        color: '#64748b',
                        font: { family: 'Inter', size: 11, weight: '600' },
                        padding: { bottom: 10 }
                    }
                }
            }
        });
    }

    // ── Bar: Breakdown of events ─────────────────────────────
    const ctxBar = document.getElementById('alertsChart');
    if (ctxBar) {
        if (alertsLineChart) alertsLineChart.destroy();
        alertsLineChart = new Chart(ctxBar, {
            type: 'bar',
            data: {
                labels: ['SSH', 'FTP', 'SMTP'],
                datasets: [{
                    label: 'Total Events',
                    data: [ssh, ftp, smtp],
                    backgroundColor: [
                        'rgba(59,130,246,0.4)',
                        'rgba(167,139,250,0.4)',
                        'rgba(245,158,11,0.4)'
                    ],
                    borderColor: [
                        'rgba(59,130,246,1)',
                        'rgba(167,139,250,1)',
                        'rgba(245,158,11,1)'
                    ],
                    borderWidth: 2,
                    borderRadius: 8,
                    borderSkipped: false
                }]
            },
            options: {
                responsive: true,
                animation: { duration: 800, easing: 'easeInOutQuart' },
                plugins: {
                    legend: { display: false },
                    title: {
                        display: true,
                        text: 'Events per Service',
                        color: '#64748b',
                        font: { family: 'Inter', size: 11, weight: '600' },
                        padding: { bottom: 10 }
                    }
                },
                scales: {
                    x: {
                        grid: { color: 'rgba(255,255,255,0.05)' },
                        ticks: { color: '#94a3b8', font: { family: 'Inter' } }
                    },
                    y: {
                        grid: { color: 'rgba(255,255,255,0.05)' },
                        ticks: { color: '#94a3b8', font: { family: 'Inter' } },
                        beginAtZero: true
                    }
                }
            }
        });
    }
}

// Called when a new live alert arrives via Socket.IO — update overview counts and charts
function updateAnalyticsOnAlert(service) {
    if (!liveCounts[service] && liveCounts[service] !== 0) return;

    liveCounts[service]++;

    // Update individual count cards if visible
    const elMap = { SSH: 'ov-ssh', FTP: 'ov-ftp', SMTP: 'ov-smtp' };
    const el = document.getElementById(elMap[service]);
    if (el) el.textContent = liveCounts[service];

    const totalEl = document.getElementById('ov-total');
    if (totalEl) {
        const cur = parseInt(totalEl.textContent) || 0;
        totalEl.textContent = cur + 1;
    }

    // Update charts
    if (servicesDoughnutChart) {
        const idx = { SSH: 0, FTP: 1, SMTP: 2 }[service];
        servicesDoughnutChart.data.datasets[0].data[idx] = liveCounts[service];
        servicesDoughnutChart.update('none');
    }
    if (alertsLineChart) {
        const idx = { SSH: 0, FTP: 1, SMTP: 2 }[service];
        alertsLineChart.data.datasets[0].data[idx] = liveCounts[service];
        alertsLineChart.update('none');
    }
}

// Init when DOM ready
document.addEventListener('DOMContentLoaded', initAnalytics);
