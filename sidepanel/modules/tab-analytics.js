// ============================================================
// tab-analytics.js — Analytics Tab
// ============================================================

async function loadAnalytics() {
    if (!CE.projectAnalytics) return;

    try {
        const days = parseInt(document.getElementById('analytics-period')?.value || '30');
        const projectId = document.getElementById('analytics-project-select')?.value || null;

        let statsToUse;
        let history;
        let score;

        if (projectId && projectId !== 'all') {
            const result = await CE.projectAnalytics.getProjectStats(projectId);
            if (result.success) {
                statsToUse = {
                    totalProjects: 1,
                    totalFiles: result.stats.totalFiles,
                    totalLines: result.stats.totalLines,
                    topLanguages: Object.entries(result.stats.languageBreakdown).map(([lang, d]) => ({ language: lang, lines: d.lines }))
                };
                history = await CE.projectAnalytics.getScanHistory(days);
                score = await CE.projectAnalytics.getProductivityScore();
            }
        } else {
            const allStats = await CE.projectAnalytics.getAllProjectsStats();
            if (allStats.success) {
                statsToUse = allStats.overview;
                history = await CE.projectAnalytics.getScanHistory(days);
                score = await CE.projectAnalytics.getProductivityScore();
            }
        }

        if (statsToUse) {
            const pEl = document.getElementById('analytics-total-projects');
            if (pEl) pEl.textContent = statsToUse.totalProjects || 0;
            const fEl = document.getElementById('analytics-total-files');
            if (fEl) fEl.textContent = statsToUse.totalFiles || 0;
            const lEl = document.getElementById('analytics-total-lines');
            if (lEl) lEl.textContent = (statsToUse.totalLines || 0).toLocaleString();
        }

        if (score && score.success) {
            const productivityEl = document.getElementById('analytics-productivity');
            if (productivityEl) productivityEl.textContent = `${score.score}/100`;
        }

        const ctxLanguages = document.getElementById('languages-chart')?.getContext('2d');
        const langDiv = document.getElementById('analytics-languages');

        if (ctxLanguages && statsToUse && statsToUse.topLanguages && statsToUse.topLanguages.length > 0) {
            const labels = statsToUse.topLanguages.map(l => l.language);
            const data = statsToUse.topLanguages.map(l => l.lines);
            const total = data.reduce((a, b) => a + b, 0);

            const colors = ['#2ea043', '#3fb950', '#58a6ff', '#bc8cff', '#ffa657', '#ff7b72', '#79c0ff', '#d299ff', '#fa7a18', '#484f58'];

            if (CE.chartInstances.languages) CE.chartInstances.languages.destroy();

            CE.chartInstances.languages = new Chart(ctxLanguages, {
                type: 'pie',
                data: { labels: labels, datasets: [{ data: data, backgroundColor: colors.slice(0, labels.length), borderWidth: 0 }] },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
            });

            if (langDiv) {
                langDiv.innerHTML = statsToUse.topLanguages.map((lang, i) => {
                    const color = colors[i % colors.length];
                    const pct = ((lang.lines / total) * 100).toFixed(1);
                    return `<div class="lang-stat"><span class="lang-color-dot" style="background: ${color}"></span><span class="lang-name">${lang.language}</span><span class="lang-value">${lang.lines.toLocaleString()} (${pct}%)</span></div>`;
                }).join('');
            }
        } else if (langDiv) {
            langDiv.innerHTML = '<p class="empty-state">No language data available yet.</p>';
        }

        const ctxTimeline = document.getElementById('timeline-chart')?.getContext('2d');
        if (ctxTimeline && history && history.success && history.timeline && history.timeline.length > 0) {
            const labels = history.timeline.map(d => d.date);
            const scanData = history.timeline.map(d => d.scans);
            const fileData = history.timeline.map(d => d.files);

            if (CE.chartInstances.timeline) CE.chartInstances.timeline.destroy();

            CE.chartInstances.timeline = new Chart(ctxTimeline, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [
                        { label: 'Scans', data: scanData, borderColor: '#2ea043', backgroundColor: 'rgba(46, 160, 67, 0.1)', fill: true, tension: 0.4 },
                        { label: 'Files', data: fileData, borderColor: '#58a6ff', backgroundColor: 'rgba(88, 166, 255, 0.1)', fill: true, tension: 0.4 }
                    ]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    scales: { y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' } }, x: { grid: { display: false } } },
                    plugins: { legend: { position: 'bottom', labels: { color: '#8b949e', boxWidth: 12, padding: 15 } } }
                }
            });
        }
    } catch (e) {
        console.error('[Analytics] load failed:', e);
    }
}
