<script lang="ts">
  import { format } from "@layerstack/utils";
  import { formatDate } from "$shared/date-helpers";
  import type { UptimeReport } from "$shared/reportTypes";

  import { KpiCard } from "$lib/components/ui/kpi-card";
  import { NOT_AVAILABLE } from "$lib/constants";
  import { cn } from "$lib/utils";
  import { formatUptime, getUptimeColor } from "$lib/utils/metrics-data";

  interface Props {
    data: UptimeReport | null;
    class?: string;
  }

  let { data, class: className }: Props = $props();
  const uptime = $derived(
    data && data.overallUptimePct !== null ? data.overallUptimePct : 0,
  );
  const totalIncidents = $derived(data ? data.totalIncidents : 0);
</script>

<div class={cn(className)}>
  <KpiCard
    title="Total Agents"
    color={data ? "blue" : "default"}
    gradient
    value={data ? data.agents.length : NOT_AVAILABLE}
    subtitle="Monitored agents"
  />

  <KpiCard
    class={data ? "**:data-[slot=value]:text-sm" : ""}
    title="Period"
    color={data ? "blue" : "default"}
    gradient
    value={data
      ? `${formatDate(data.periodStart)} – ${formatDate(data.periodEnd)}`
      : NOT_AVAILABLE}
    subtitle="Report time range"
  />

  <KpiCard
    title="Overall Uptime"
    color={(data && uptime > 0 && getUptimeColor(uptime)) || "default"}
    gradient
    value={data ? formatUptime(uptime) : NOT_AVAILABLE}
    subtitle="Across all agents"
  />

  <KpiCard
    title="Total Incidents"
    color={(data && (totalIncidents > 0 ? "destructive" : "green")) ||
      "default"}
    gradient
    value={data ? format(totalIncidents, "metric") : NOT_AVAILABLE}
    subtitle="Offline + Error checks"
  />
</div>
