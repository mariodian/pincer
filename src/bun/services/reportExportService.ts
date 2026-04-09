// Report export service - generates self-contained HTML reports
import packageJson from "../../../package.json";
import { formatDate } from "../../shared/date-helpers";
import type { UptimeReport } from "../../shared/reportTypes";
import { APP_NAME } from "../config";

const appVersion = packageJson.version;

function formatUptime(val: number): string {
  return `${val.toFixed(2)}%`;
}

function formatMs(val: number): string {
  return `${Math.round(val)}ms`;
}

function formatNumber(val: number): string {
  return val.toLocaleString();
}

function getRangeLabel(range: string): string {
  switch (range) {
    case "7d":
      return "Last 7 Days";
    case "30d":
      return "Last 30 Days";
    case "90d":
      return "Last 90 Days";
    default:
      return range;
  }
}

function getUptimeColor(pct: number): string {
  if (pct >= 99) return "#22c55e";
  if (pct >= 95) return "#eab308";
  if (pct >= 50) return "#f97316";
  return "#ef4444";
}

function getUptimeBarWidth(pct: number): string {
  return `${Math.min(pct, 100)}%`;
}

export function generateUptimeReportHTML(report: UptimeReport): string {
  const rows = report.agents
    .map((agent) => {
      const uptimeColor = getUptimeColor(agent.uptimePct);
      const barWidth = getUptimeBarWidth(agent.uptimePct);
      const statusColor = agent.hasData ? uptimeColor : "#6b7280";

      return `
      <tr>
        <td class="agent-name">
          <span class="color-dot" style="background-color: ${agent.color}"></span>
          ${agent.agentName}
        </td>
        <td class="uptime-cell">
          <div class="uptime-bar-container">
            <div class="uptime-bar" style="width: ${barWidth}; background-color: ${statusColor}"></div>
            <span class="uptime-value" style="color: ${statusColor}">
              ${agent.hasData ? formatUptime(agent.uptimePct) : "No data"}
            </span>
          </div>
        </td>
        <td>${formatNumber(agent.totalChecks)}</td>
        <td class="${agent.incidentCount > 0 ? "incident-cell" : ""}">
          ${formatNumber(agent.incidentCount)}
        </td>
        <td>${agent.hasData ? formatMs(agent.avgResponseMs) : "—"}</td>
      </tr>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${APP_NAME} — Uptime Report (${getRangeLabel(report.range)})</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      background: #f9fafb;
      color: #111827;
      line-height: 1.5;
      padding: 2rem;
    }

    @media (max-width: 768px) {
      body { padding: 1rem; }
    }

    .container {
      max-width: 960px;
      margin: 0 auto;
    }

    .header {
      margin-bottom: 2rem;
      padding-bottom: 1.5rem;
      border-bottom: 1px solid #e5e7eb;
    }

    .header h1 {
      font-size: 1.5rem;
      font-weight: 700;
      margin-bottom: 0.25rem;
    }

    .header .subtitle {
      color: #6b7280;
      font-size: 0.875rem;
    }

    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
      margin-bottom: 2rem;
    }

    .kpi-card {
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 0.5rem;
      padding: 1rem 1.25rem;
    }

    .kpi-card .label {
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #6b7280;
      margin-bottom: 0.25rem;
    }

    .kpi-card .value {
      font-size: 1.5rem;
      font-weight: 700;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 0.5rem;
      overflow: hidden;
    }

    thead {
      background: #f3f4f6;
    }

    th {
      text-align: left;
      padding: 0.75rem 1rem;
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #6b7280;
      font-weight: 600;
    }

    td {
      padding: 0.75rem 1rem;
      border-top: 1px solid #e5e7eb;
      font-size: 0.875rem;
    }

    .agent-name {
      font-weight: 500;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .color-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .disabled-badge {
      font-size: 0.65rem;
      background: #f3f4f6;
      color: #6b7280;
      padding: 0.125rem 0.375rem;
      border-radius: 0.25rem;
      text-transform: uppercase;
    }

    .uptime-bar-container {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .uptime-bar {
      height: 8px;
      border-radius: 4px;
      background: #22c55e;
      min-width: 4px;
    }

    .uptime-value {
      font-weight: 600;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }

    .incident-cell {
      color: #ef4444;
      font-weight: 500;
    }

    .footer {
      margin-top: 2rem;
      padding-top: 1rem;
      border-top: 1px solid #e5e7eb;
      text-align: center;
      font-size: 0.75rem;
      color: #9ca3af;
    }

    @media print {
      body { background: white; padding: 0; }
      .container { max-width: 100%; }
      table { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${APP_NAME} — Uptime Report</h1>
      <p class="subtitle">
        ${getRangeLabel(report.range)} · ${formatDate(report.periodStart)} – ${formatDate(report.periodEnd)}
      </p>
    </div>

    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="label">Overall Uptime</div>
        <div class="value" style="color: ${report.overallUptimePct !== null ? getUptimeColor(report.overallUptimePct) : "#6b7280"}">
          ${report.overallUptimePct !== null ? formatUptime(report.overallUptimePct) : "No data"}
        </div>
      </div>
      <div class="kpi-card">
        <div class="label">Total Agents</div>
        <div class="value">${report.agents.length}</div>
      </div>
      <div class="kpi-card">
        <div class="label">Total Incidents</div>
        <div class="value" style="color: ${report.totalIncidents > 0 ? "#ef4444" : "#22c55e"}">
          ${formatNumber(report.totalIncidents)}
        </div>
      </div>
      <div class="kpi-card">
        <div class="label">Generated</div>
        <div class="value" style="font-size: 1rem;">${formatDate(new Date())}</div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Agent</th>
          <th>Uptime</th>
          <th>Total Checks</th>
          <th>Incidents</th>
          <th>Avg Response</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>

    <div class="footer">
      Generated by ${APP_NAME} v${appVersion} · ${new Date().toISOString()}
    </div>
  </div>
</body>
</html>`;
}
