<script lang="ts">
  import { formatDate } from "$shared/date-helpers";
  import type { UptimeReport } from "$shared/reportTypes";
  import { format } from "@layerstack/utils";
  import { MIN_UPTIME_THRESHOLDS } from "$lib/constants";
  import { formatUptime } from "$lib/utils/metrics-data";

  interface Props {
    report: UptimeReport;
  }

  let { report }: Props = $props();

  function getUptimeColor(pct: number): string {
    if (pct >= MIN_UPTIME_THRESHOLDS.ok)
      return "text-green-600 dark:text-green-500";
    if (pct >= MIN_UPTIME_THRESHOLDS.good)
      return "text-amber-400 dark:text-amber-400";
    if (pct >= MIN_UPTIME_THRESHOLDS.meh) return "text-orange-500";
    return "text-red-600 dark:text-red-500";
  }
</script>

<div class={["grid gap-3 lg:gap-4 mb-6", "grid-cols-2 lg:grid-cols-4"]}>
  <div class="rounded-lg border bg-background p-4">
    <div class="text-xs text-muted-foreground uppercase tracking-wide mb-1">
      Overall Uptime
    </div>
    <div
      class={[
        "text-2xl font-bold",
        report.overallUptimePct !== null
          ? getUptimeColor(report.overallUptimePct)
          : "text-muted-foreground",
      ]}
    >
      {report.overallUptimePct !== null
        ? formatUptime(report.overallUptimePct)
        : "No data"}
    </div>
  </div>

  <div class="rounded-lg border bg-background p-4">
    <div class="text-xs text-muted-foreground uppercase tracking-wide mb-1">
      Total Agents
    </div>
    <div class="text-2xl font-bold">{report.agents.length}</div>
  </div>

  <div class="rounded-lg border bg-background p-4">
    <div class="text-xs text-muted-foreground uppercase tracking-wide mb-1">
      Total Incidents
    </div>
    <div
      class={[
        "text-2xl font-bold",
        report.totalIncidents > 0
          ? "text-red-600 dark:text-red-500"
          : "text-green-600 dark:text-green-500",
      ]}
    >
      {format(report.totalIncidents, "metric")}
    </div>
  </div>

  <div class="rounded-lg border bg-background p-4">
    <div class="text-xs text-muted-foreground uppercase tracking-wide mb-1">
      Period
    </div>
    <div class="text-sm font-medium">
      {formatDate(report.periodStart)} – {formatDate(report.periodEnd)}
    </div>
  </div>
</div>
