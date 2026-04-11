<script lang="ts">
  import { KpiCard } from "$lib/components/ui/kpi-card";
  import { NOT_AVAILABLE } from "$lib/constants";
  import { cn } from "$lib/utils";
  import {
    formatMs,
    formatUptime,
    getResponseColor,
    getUptimeColor,
  } from "$lib/utils/metrics-data";
  import type { DashboardKpis } from "$shared/rpc";
  import { format } from "@layerstack/utils";

  interface Props {
    data: DashboardKpis | null;
    class?: string;
  }

  let { data, class: className }: Props = $props();
  const uptime = $derived(data && data.avgUptime !== null ? data.avgUptime : 0);
  const avgResponse = $derived(
    data && data.avgResponseMs !== null ? data.avgResponseMs : 0,
  );
  const incidentCount = $derived(data ? data.incidentCount : 0);
</script>

<div class={cn(className)}>
  <KpiCard
    title="Agents"
    color={data ? "blue" : "default"}
    gradient
    value={data ? `${data.activeAgents} / ${data.totalAgents}` : NOT_AVAILABLE}
    subtitle="Active / Total"
  />

  <KpiCard
    title="Avg Uptime"
    color={data && uptime > 0 ? getUptimeColor(uptime) : "default"}
    gradient
    value={data ? formatUptime(uptime) : NOT_AVAILABLE}
    subtitle="Across enabled agents"
  />

  <KpiCard
    title="Avg Response"
    color={data && avgResponse > 0 ? getResponseColor(avgResponse) : "default"}
    gradient
    value={data ? formatMs(avgResponse) : NOT_AVAILABLE}
    subtitle="Across enabled agents"
  />

  <KpiCard
    title="Incidents"
    color={data ? (incidentCount > 0 ? "destructive" : "green") : "default"}
    gradient
    value={data ? format(incidentCount, "metric") : NOT_AVAILABLE}
    subtitle="Offline + Error checks"
  />
</div>
