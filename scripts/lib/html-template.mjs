/**
 * Generates the complete, self-contained HTML dashboard document.
 * @param {object} stats - Output from git analyzer.
 * @returns {string} Fully rendered HTML file content.
 */
export function generateHtmlDashboard(stats) {
  const jsonPayload = JSON.stringify(stats);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Repository Statistics & Code Growth</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
  <style>
    :root {
      --bg: #f8fafc;
      --card: #ffffff;
      --card-border: #e2e8f0;
      --card-hover: #f1f5f9;
      --text-main: #0f172a;
      --text-muted: #64748b;
      --text-subtle: #94a3b8;
      --primary: #2563eb;
      --primary-light: #eff6ff;
      --success: #10b981;
      --success-light: #ecfdf5;
      --danger: #ef4444;
      --danger-light: #fef2f2;
      --warning: #f59e0b;
      --warning-light: #fffbeb;
      --purple: #8b5cf6;
      --purple-light: #f5f3ff;
      --teal: #0d9488;
      --teal-light: #f0fdfa;
      --radius-sm: 6px;
      --radius-md: 10px;
      --radius-lg: 16px;
      --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
      --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.06), 0 2px 4px -2px rgb(0 0 0 / 0.06);
      --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      --font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      background-color: var(--bg);
      color: var(--text-main);
      font-family: var(--font-sans);
      line-height: 1.5;
      padding: 2rem 1.5rem 4rem;
      -webkit-font-smoothing: antialiased;
    }

    .container {
      max-width: 1280px;
      margin: 0 auto;
    }

    /* Header */
    header {
      margin-bottom: 2rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    @media (min-width: 768px) {
      header {
        flex-direction: row;
        align-items: center;
        justify-content: space-between;
      }
    }
    .header-titles h1 {
      font-size: 1.75rem;
      font-weight: 700;
      letter-spacing: -0.025em;
      color: var(--text-main);
    }
    .header-titles p {
      font-size: 0.875rem;
      color: var(--text-muted);
      margin-top: 0.25rem;
    }
    .header-actions {
      display: flex;
      gap: 0.75rem;
      align-items: center;
    }
    .badge-pill {
      font-size: 0.75rem;
      font-weight: 500;
      padding: 0.35rem 0.75rem;
      border-radius: 9999px;
      background: var(--primary-light);
      color: var(--primary);
      border: 1px solid #bfdbfe;
    }
    .btn {
      font-size: 0.8125rem;
      font-weight: 500;
      padding: 0.45rem 0.85rem;
      border-radius: var(--radius-sm);
      border: 1px solid var(--card-border);
      background: var(--card);
      color: var(--text-main);
      cursor: pointer;
      transition: all 0.15s ease;
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
    }
    .btn:hover {
      background: var(--card-hover);
      border-color: #cbd5e1;
    }

    /* KPI Cards */
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 1rem;
      margin-bottom: 2rem;
    }
    @media (min-width: 768px) {
      .kpi-grid { grid-template-columns: repeat(3, 1fr); }
    }
    @media (min-width: 1024px) {
      .kpi-grid { grid-template-columns: repeat(6, 1fr); }
    }
    .kpi-card {
      background: var(--card);
      border: 1px solid var(--card-border);
      border-radius: var(--radius-md);
      padding: 1.15rem;
      box-shadow: var(--shadow-sm);
      transition: transform 0.15s ease, box-shadow 0.15s ease;
    }
    .kpi-card:hover {
      transform: translateY(-2px);
      box-shadow: var(--shadow-md);
    }
    .kpi-label {
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-muted);
    }
    .kpi-value {
      font-size: 1.5rem;
      font-weight: 700;
      letter-spacing: -0.02em;
      margin: 0.35rem 0 0.2rem;
    }
    .kpi-sub {
      font-size: 0.75rem;
      color: var(--text-muted);
      display: flex;
      align-items: center;
      gap: 0.25rem;
    }
    .text-success { color: var(--success); }
    .text-danger { color: var(--danger); }
    .text-primary { color: var(--primary); }

    /* Chart Layout */
    .charts-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 1.5rem;
      margin-bottom: 2rem;
    }
    @media (min-width: 900px) {
      .charts-grid-2 {
        display: grid;
        grid-template-columns: 2fr 1fr;
        gap: 1.5rem;
        margin-bottom: 1.5rem;
      }
      .charts-grid-equal {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1.5rem;
        margin-bottom: 1.5rem;
      }
    }
    .chart-card {
      background: var(--card);
      border: 1px solid var(--card-border);
      border-radius: var(--radius-lg);
      padding: 1.25rem 1.5rem;
      box-shadow: var(--shadow-sm);
    }
    .chart-header {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      margin-bottom: 1rem;
    }
    .chart-title {
      font-size: 1rem;
      font-weight: 600;
      color: var(--text-main);
    }
    .chart-desc {
      font-size: 0.75rem;
      color: var(--text-muted);
    }
    .chart-container {
      position: relative;
      width: 100%;
      height: 280px;
    }

    /* Tables & Search */
    .table-section {
      background: var(--card);
      border: 1px solid var(--card-border);
      border-radius: var(--radius-lg);
      padding: 1.25rem 1.5rem;
      box-shadow: var(--shadow-sm);
      margin-bottom: 2rem;
    }
    .table-controls {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      margin-bottom: 1rem;
    }
    @media (min-width: 640px) {
      .table-controls {
        flex-direction: row;
        justify-content: space-between;
        align-items: center;
      }
    }
    .search-box {
      position: relative;
      flex: 1;
      max-width: 380px;
    }
    .search-input {
      width: 100%;
      font-size: 0.8125rem;
      padding: 0.5rem 0.75rem 0.5rem 2rem;
      border: 1px solid var(--card-border);
      border-radius: var(--radius-sm);
      outline: none;
      background: var(--bg);
      color: var(--text-main);
    }
    .search-input:focus {
      border-color: var(--primary);
      background: #ffffff;
    }
    .search-icon {
      position: absolute;
      left: 0.65rem;
      top: 50%;
      transform: translateY(-50%);
      font-size: 0.8125rem;
      color: var(--text-subtle);
    }
    .type-filter-select {
      font-size: 0.8125rem;
      padding: 0.5rem 0.75rem;
      border: 1px solid var(--card-border);
      border-radius: var(--radius-sm);
      background: var(--card);
      color: var(--text-main);
      outline: none;
    }

    .table-wrapper {
      overflow-x: auto;
      max-height: 480px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
      font-size: 0.8125rem;
    }
    thead th {
      background: var(--bg);
      color: var(--text-muted);
      font-weight: 600;
      padding: 0.65rem 0.85rem;
      position: sticky;
      top: 0;
      z-index: 10;
      border-bottom: 1px solid var(--card-border);
      white-space: nowrap;
    }
    tbody tr {
      border-bottom: 1px solid var(--card-border);
      transition: background 0.1s ease;
    }
    tbody tr:hover {
      background: var(--card-hover);
    }
    tbody td {
      padding: 0.65rem 0.85rem;
      vertical-align: middle;
    }
    .hash-badge {
      font-family: var(--font-mono);
      font-size: 0.75rem;
      background: var(--bg);
      border: 1px solid var(--card-border);
      padding: 0.15rem 0.4rem;
      border-radius: var(--radius-sm);
      color: var(--text-main);
    }
    .type-badge {
      font-size: 0.7rem;
      font-weight: 600;
      padding: 0.15rem 0.45rem;
      border-radius: var(--radius-sm);
      text-transform: uppercase;
      display: inline-block;
    }
    .type-feat { background: var(--primary-light); color: var(--primary); border: 1px solid #bfdbfe; }
    .type-fix { background: var(--warning-light); color: var(--warning); border: 1px solid #fde68a; }
    .type-test { background: var(--purple-light); color: var(--purple); border: 1px solid #ddd6fe; }
    .type-chore { background: #f1f5f9; color: var(--text-muted); border: 1px solid #e2e8f0; }
    .type-docs { background: var(--teal-light); color: var(--teal); border: 1px solid #99f6e4; }
    .type-other { background: #f8fafc; color: var(--text-subtle); border: 1px solid #e2e8f0; }

    .diff-pill {
      font-family: var(--font-mono);
      font-size: 0.75rem;
      font-weight: 600;
    }

    /* Progress bar in extension table */
    .bar-bg {
      background: #e2e8f0;
      height: 6px;
      border-radius: 9999px;
      overflow: hidden;
      width: 100px;
      display: inline-block;
      vertical-align: middle;
      margin-left: 0.5rem;
    }
    .bar-fill {
      height: 100%;
      background: var(--primary);
      border-radius: 9999px;
    }

    footer {
      margin-top: 3rem;
      text-align: center;
      font-size: 0.75rem;
      color: var(--text-subtle);
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="header-titles">
        <h1>Repository Statistics & Code Growth</h1>
        <p>Comprehensive git churn, line counts, commit volume, and codebase distribution</p>
      </div>
      <div class="header-actions">
        <span class="badge-pill" id="genBadge">Live Analytics</span>
        <button class="btn" onclick="window.print()">
          <span>🖨️</span> Print / Export
        </button>
      </div>
    </header>

    <!-- Top KPI Grid -->
    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-label">Total Commits</div>
        <div class="kpi-value text-primary" id="kpiCommits">0</div>
        <div class="kpi-sub" id="kpiDateSpan">Span</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Net Code Volume</div>
        <div class="kpi-value" id="kpiNetLoc">0</div>
        <div class="kpi-sub">Additions − Deletions</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Total Additions</div>
        <div class="kpi-value text-success" id="kpiAdditions">+0</div>
        <div class="kpi-sub" id="kpiAvgAdd">Avg / commit</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Total Deletions</div>
        <div class="kpi-value text-danger" id="kpiDeletions">-0</div>
        <div class="kpi-sub" id="kpiAvgDel">Avg / commit</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Tracked Files</div>
        <div class="kpi-value" id="kpiFiles">0</div>
        <div class="kpi-sub" id="kpiCurrentLines">0 total lines</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Avg Blast Radius</div>
        <div class="kpi-value" id="kpiBlastRadius">0</div>
        <div class="kpi-sub">Files changed / commit</div>
      </div>
    </div>

    <!-- Chart Grid Row 1: Code Growth & Extensions -->
    <div class="charts-grid-2">
      <div class="chart-card">
        <div class="chart-header">
          <div>
            <div class="chart-title">Cumulative Code Growth & Trajectory</div>
            <div class="chart-desc">Net lines of code added to the codebase over consecutive commits</div>
          </div>
        </div>
        <div class="chart-container">
          <canvas id="growthChart"></canvas>
        </div>
      </div>
      <div class="chart-card">
        <div class="chart-header">
          <div>
            <div class="chart-title">Codebase Composition</div>
            <div class="chart-desc">Line distribution by file extension</div>
          </div>
        </div>
        <div class="chart-container">
          <canvas id="extChart"></canvas>
        </div>
      </div>
    </div>

    <!-- Chart Grid Row 2: Per-Commit Churn & Files Changed -->
    <div class="charts-grid-equal">
      <div class="chart-card">
        <div class="chart-header">
          <div>
            <div class="chart-title">Commit Churn (Insertions vs Deletions)</div>
            <div class="chart-desc">Code additions (green) vs deletions (red) and net impact (line)</div>
          </div>
        </div>
        <div class="chart-container">
          <canvas id="churnChart"></canvas>
        </div>
      </div>
      <div class="chart-card">
        <div class="chart-header">
          <div>
            <div class="chart-title">Files Modified per Commit</div>
            <div class="chart-desc">Blast radius and scope of each commit</div>
          </div>
        </div>
        <div class="chart-container">
          <canvas id="filesChart"></canvas>
        </div>
      </div>
    </div>

    <!-- Chart Grid Row 3: Commit Types & Author Velocity -->
    <div class="charts-grid-equal">
      <div class="chart-card">
        <div class="chart-header">
          <div>
            <div class="chart-title">Commit Classification</div>
            <div class="chart-desc">Breakdown by Conventional Commit types</div>
          </div>
        </div>
        <div class="chart-container">
          <canvas id="typesChart"></canvas>
        </div>
      </div>
      <div class="chart-card">
        <div class="chart-header">
          <div>
            <div class="chart-title">Top Languages / Extensions Summary</div>
            <div class="chart-desc">Tracked files and line percentage breakdown</div>
          </div>
        </div>
        <div class="table-wrapper" style="max-height: 280px;">
          <table id="extSummaryTable">
            <thead>
              <tr>
                <th>Extension</th>
                <th>Files</th>
                <th>Lines</th>
                <th>Code Share</th>
              </tr>
            </thead>
            <tbody id="extSummaryBody"></tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Commit Explorer Table Section -->
    <div class="table-section">
      <div class="table-controls">
        <div class="search-box">
          <span class="search-icon">🔍</span>
          <input type="text" id="commitSearch" class="search-input" placeholder="Filter commits by message, hash, or author..." />
        </div>
        <div>
          <select id="typeFilter" class="type-filter-select">
            <option value="ALL">All Commit Types</option>
          </select>
        </div>
      </div>
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Hash</th>
              <th>Date</th>
              <th>Type</th>
              <th>Subject</th>
              <th>Files</th>
              <th>Additions</th>
              <th>Deletions</th>
              <th>Net LOC</th>
            </tr>
          </thead>
          <tbody id="commitTableBody"></tbody>
        </table>
      </div>
    </div>

    <footer>
      Link Stash Git Analytics • Regenerate anytime with <code>pnpm stats</code> or <code>node scripts/generate-repo-stats.mjs</code>
    </footer>
  </div>

  <script>
    const DATA = ${jsonPayload};

    // Format numbers with commas
    function fmt(n) {
      return (n || 0).toLocaleString();
    }

    // Populate Top KPIs
    document.getElementById("kpiCommits").textContent = fmt(DATA.summary.totalCommits);
    document.getElementById("kpiNetLoc").textContent = fmt(DATA.summary.netLines);
    document.getElementById("kpiAdditions").textContent = "+" + fmt(DATA.summary.totalAdditions);
    document.getElementById("kpiDeletions").textContent = "-" + fmt(DATA.summary.totalDeletions);
    document.getElementById("kpiFiles").textContent = fmt(DATA.summary.totalFiles);
    document.getElementById("kpiCurrentLines").textContent = fmt(DATA.summary.totalTrackedLines) + " lines in repo";
    document.getElementById("kpiBlastRadius").textContent = DATA.summary.avgFilesPerCommit;
    document.getElementById("kpiAvgAdd").textContent = "+" + fmt(DATA.summary.avgInsertionsPerCommit) + " / commit";
    document.getElementById("kpiAvgDel").textContent = "-" + fmt(DATA.summary.avgDeletionsPerCommit) + " / commit";
    document.getElementById("kpiDateSpan").textContent = DATA.summary.firstCommitDate + " → " + DATA.summary.latestCommitDate;
    document.getElementById("genBadge").textContent = "Updated: " + DATA.summary.latestCommitDate;

    // Extension Summary Table
    const extTbody = document.getElementById("extSummaryBody");
    DATA.extensions.slice(0, 10).forEach(e => {
      const tr = document.createElement("tr");
      tr.innerHTML = \`
        <td><strong>\${e.extension}</strong></td>
        <td>\${fmt(e.count)} (\${e.filePercent}%)</td>
        <td>\${fmt(e.lines)}</td>
        <td>
          <span>\${e.linePercent}%</span>
          <div class="bar-bg">
            <div class="bar-fill" style="width: \${Math.min(parseFloat(e.linePercent), 100)}%;"></div>
          </div>
        </td>
      \`;
      extTbody.appendChild(tr);
    });

    // Commit Types Filter options
    const typeSelect = document.getElementById("typeFilter");
    DATA.summary.commitTypes.forEach(t => {
      const opt = document.createElement("option");
      opt.value = t.type;
      opt.textContent = t.type.toUpperCase() + " (" + t.count + ")";
      typeSelect.appendChild(opt);
    });

    // Populate Commit Table
    function renderCommitTable(filterText = "", typeFilter = "ALL") {
      const tbody = document.getElementById("commitTableBody");
      tbody.innerHTML = "";
      const search = filterText.toLowerCase();

      // Show in reverse chronological order (newest first)
      const reversed = [...DATA.commits].reverse();

      reversed.forEach(c => {
        const matchesSearch = !search || 
          c.shortHash.toLowerCase().includes(search) ||
          c.subject.toLowerCase().includes(search) ||
          c.author.toLowerCase().includes(search);

        const matchesType = typeFilter === "ALL" || c.type === typeFilter;

        if (matchesSearch && matchesType) {
          const tr = document.createElement("tr");
          const netClass = c.net >= 0 ? "text-success" : "text-danger";
          const netPrefix = c.net > 0 ? "+" : "";

          tr.innerHTML = \`
            <td style="color: var(--text-subtle);">\${c.index}</td>
            <td><code class="hash-badge">\${c.shortHash}</code></td>
            <td style="white-space: nowrap; color: var(--text-muted);">\${c.date}</td>
            <td><span class="type-badge type-\${c.type}">\${c.type}</span></td>
            <td><strong>\${c.subject}</strong></td>
            <td>\${c.filesChanged}</td>
            <td class="diff-pill text-success">+\${fmt(c.insertions)}</td>
            <td class="diff-pill text-danger">-\${fmt(c.deletions)}</td>
            <td class="diff-pill \${netClass}">\${netPrefix}\${fmt(c.net)}</td>
          \`;
          tbody.appendChild(tr);
        }
      });
    }

    renderCommitTable();

    document.getElementById("commitSearch").addEventListener("input", e => {
      renderCommitTable(e.target.value, document.getElementById("typeFilter").value);
    });
    document.getElementById("typeFilter").addEventListener("change", e => {
      renderCommitTable(document.getElementById("commitSearch").value, e.target.value);
    });

    // Render Charts using Chart.js
    if (typeof Chart !== "undefined") {
      const labels = DATA.commits.map(c => "#" + c.index + " " + c.shortHash);

      // 1. Growth Chart (Cumulative Net LOC)
      new Chart(document.getElementById("growthChart"), {
        type: "line",
        data: {
          labels,
          datasets: [{
            label: "Net Lines of Code",
            data: DATA.commits.map(c => c.cumulativeNet),
            borderColor: "#2563eb",
            backgroundColor: "rgba(37, 99, 235, 0.08)",
            borderWidth: 2.5,
            fill: true,
            tension: 0.2,
            pointRadius: 3,
            pointHoverRadius: 6,
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                title: (items) => {
                  const idx = items[0].dataIndex;
                  return "#" + DATA.commits[idx].index + " (" + DATA.commits[idx].shortHash + "): " + DATA.commits[idx].subject;
                },
                label: (ctx) => "Net LOC: " + fmt(ctx.raw)
              }
            }
          },
          scales: {
            x: { grid: { display: false }, ticks: { font: { size: 10 } } },
            y: { grid: { color: "#f1f5f9" }, ticks: { callback: v => fmt(v) } }
          }
        }
      });

      // 2. Extension Doughnut
      const topExt = DATA.extensions.slice(0, 6);
      const otherLines = DATA.extensions.slice(6).reduce((acc, curr) => acc + curr.lines, 0);
      const extLabels = topExt.map(e => e.extension);
      const extData = topExt.map(e => e.lines);
      if (otherLines > 0) {
        extLabels.push("others");
        extData.push(otherLines);
      }

      new Chart(document.getElementById("extChart"), {
        type: "doughnut",
        data: {
          labels: extLabels,
          datasets: [{
            data: extData,
            backgroundColor: [
              "#2563eb", "#10b981", "#8b5cf6", "#f59e0b", "#ec4899", "#06b6d4", "#94a3b8"
            ],
            borderWidth: 2,
            borderColor: "#ffffff"
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: "right", labels: { boxWidth: 12, font: { size: 11 } } },
            tooltip: {
              callbacks: {
                label: (ctx) => " " + ctx.label + ": " + fmt(ctx.raw) + " lines"
              }
            }
          },
          cutout: "65%"
        }
      });

      // 3. Churn Chart (Additions vs Deletions per commit)
      new Chart(document.getElementById("churnChart"), {
        type: "bar",
        data: {
          labels,
          datasets: [
            {
              label: "Additions (+)",
              data: DATA.commits.map(c => c.insertions),
              backgroundColor: "rgba(16, 185, 129, 0.75)",
              borderRadius: 4,
            },
            {
              label: "Deletions (-)",
              data: DATA.commits.map(c => -c.deletions),
              backgroundColor: "rgba(239, 68, 68, 0.75)",
              borderRadius: 4,
            },
            {
              type: "line",
              label: "Net Change",
              data: DATA.commits.map(c => c.net),
              borderColor: "#2563eb",
              borderWidth: 2,
              pointRadius: 2,
              tension: 0.1
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: "top", labels: { boxWidth: 12, font: { size: 11 } } },
            tooltip: {
              callbacks: {
                title: (items) => {
                  const idx = items[0].dataIndex;
                  return "#" + DATA.commits[idx].index + " (" + DATA.commits[idx].shortHash + "): " + DATA.commits[idx].subject;
                },
                label: (ctx) => ctx.dataset.label + ": " + fmt(Math.abs(ctx.raw))
              }
            }
          },
          scales: {
            x: { stacked: true, grid: { display: false }, ticks: { font: { size: 10 } } },
            y: {
              stacked: false,
              grid: { color: "#f1f5f9" },
              ticks: { callback: v => fmt(v) }
            }
          }
        }
      });

      // 4. Files Changed per commit
      new Chart(document.getElementById("filesChart"), {
        type: "bar",
        data: {
          labels,
          datasets: [{
            label: "Files Modified",
            data: DATA.commits.map(c => c.filesChanged),
            backgroundColor: "rgba(99, 102, 241, 0.75)",
            borderRadius: 4,
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                title: (items) => {
                  const idx = items[0].dataIndex;
                  return "#" + DATA.commits[idx].index + " (" + DATA.commits[idx].shortHash + "): " + DATA.commits[idx].subject;
                },
                label: (ctx) => "Files Modified: " + ctx.raw
              }
            }
          },
          scales: {
            x: { grid: { display: false }, ticks: { font: { size: 10 } } },
            y: { grid: { color: "#f1f5f9" }, beginAtZero: true }
          }
        }
      });

      // 5. Types Chart
      new Chart(document.getElementById("typesChart"), {
        type: "bar",
        data: {
          labels: DATA.summary.commitTypes.map(t => t.type.toUpperCase()),
          datasets: [{
            label: "Commits",
            data: DATA.summary.commitTypes.map(t => t.count),
            backgroundColor: "#3b82f6",
            borderRadius: 6,
          }]
        },
        options: {
          indexAxis: "y",
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { color: "#f1f5f9" }, beginAtZero: true, ticks: { stepSize: 1 } },
            y: { grid: { display: false } }
          }
        }
      });
    }
  </script>
</body>
</html>`;
}
