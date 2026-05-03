<script lang="ts">
  import { push } from "@bmlt-enabled/svelte-spa-router";
  import type { AgentWithColor, TimeSeriesPoint } from "$shared/rpc";
  import type { Settings, TimeRange } from "$shared/types";

  import { StatusPieChart } from "$lib/components/dashboard";
  import KpiSummary from "$lib/components/dashboard/KpiSummary.svelte";
  import MetricChart from "$lib/components/dashboard/MetricChart.svelte";
  import { Button } from "$lib/components/ui/button/index.js";
  import { DataPage } from "$lib/components/ui/data-page";
  import * as Empty from "$lib/components/ui/empty/index.js";
  import { Icon } from "$lib/components/ui/icon";
  import { Skeleton } from "$lib/components/ui/skeleton";
  import { currentRoute, previousRoute } from "$lib/services/navigationStore";
  import { cn } from "$lib/utils";
  import {
    aggregateByDay,
    fillHourlySlots,
    formatDay,
    formatHour,
    formatMs,
    formatUptime,
    pivotTimeSeries,
  } from "$lib/utils/metrics-data";
  import { createPolledPage } from "$lib/utils/polled-page.svelte";

  const TIME_RANGES: { value: TimeRange; label: string }[] = [
    { value: "24h", label: "24h" },
    { value: "7d", label: "7d" },
    { value: "30d", label: "30d" },
  ];

  let showDisabledAgents = $state(false);

  let selectedUptime = $state<number[]>([]);
  let selectedResponse = $state<number[]>([]);
  let selectedResponseBar = $state<number[]>([]);
  let selectedStatus = $state<number[]>([]);

  let chartAgents = $state<AgentWithColor[]>([]);
  let chartTimeSeries = $state<TimeSeriesPoint[]>([]);

  const page = createPolledPage({
    defaultRange: "7d",
    fetch: async (rpc, range) => {
      const [settings, stats] = await Promise.all([
        rpc.getSettings({}) as Promise<Settings>,
        rpc.getDashboardStats({ range }),
      ]);
      return { settings, stats };
    },
    onData: (data) => {
      showDisabledAgents = data.settings.showDisabledAgents;

      chartAgents = showDisabledAgents
        ? data.stats.agents
        : data.stats.agents.filter((a) => a.enabled !== false);
      chartTimeSeries = showDisabledAgents
        ? data.stats.timeSeries
        : data.stats.timeSeries.filter((p) =>
            chartAgents.some((a) => a.id === p.agentId),
          );

      const allIds = chartAgents.map((a) => a.id);
      if (selectedUptime.length === 0) selectedUptime = allIds;
      if (selectedResponse.length === 0) selectedResponse = allIds;
      if (selectedResponseBar.length === 0) selectedResponseBar = allIds;
      if (selectedStatus.length === 0) selectedStatus = allIds;
    },
  });

  let stats = $derived(page.data?.stats ?? null);
  let isEmpty = $derived(stats === null || chartAgents.length === 0);

  let xAxisFormat = $derived(page.timeRange === "24h" ? formatHour : formatDay);

  let uptimeData = $derived.by(() => {
    let pivoted = pivotTimeSeries(chartTimeSeries, chartAgents, "uptimePct");
    pivoted = fillHourlySlots(pivoted, chartAgents, "uptime");
    if (page.timeRange !== "24h") pivoted = aggregateByDay(pivoted);
    return pivoted;
  });

  let responseData = $derived.by(() => {
    let pivoted = pivotTimeSeries(
      chartTimeSeries,
      chartAgents,
      "avgResponseMs",
    );
    pivoted = fillHourlySlots(pivoted, chartAgents, "response");
    if (page.timeRange !== "24h") pivoted = aggregateByDay(pivoted);
    return pivoted;
  });

  function toggleAgent(selected: number[]) {
    return (id: number) => {
      const idx = selected.indexOf(id);
      if (idx === -1) {
        return [...selected, id];
      }
      return selected.filter((sid) => sid !== id);
    };
  }
</script>

<DataPage
  title="Dashboard"
  description="Monitor agent health and performance"
  prevPath={$previousRoute}
  currentPath={$currentRoute}
  errorTitle="Failed to load dashboard"
  error={page.error}
  initialLoading={page.initialLoading}
  refreshing={page.refreshing}
  showRefreshing={page.showRefreshing}
  timeRange={page.timeRange}
  timeRangeOptions={TIME_RANGES}
  onTimeRangeChange={page.handleTimeRangeChange}
  onRefresh={page.refresh}
  lastUpdated={page.shouldShowLastUpdated ? page.anchorDate : undefined}
  onRetry={() => page.retry()}
  {isEmpty}
>
  {#snippet skeleton()}
    <div class={["mb-6 grid gap-3 lg:gap-4", "grid-cols-2 lg:grid-cols-4"]}>
      <Skeleton class="h-25 w-full rounded-lg" />
      <Skeleton class="h-25 w-full rounded-lg" />
      <Skeleton class="h-25 w-full rounded-lg" />
      <Skeleton class="h-25 w-full rounded-lg" />
    </div>
    <div class="mt-8 grid gap-4 lg:mt-12 lg:gap-6">
      <Skeleton class="h-75 w-full rounded-lg" />
      <Skeleton class="h-75 w-full rounded-lg" />
      <Skeleton class="h-75 w-full rounded-lg" />
      <Skeleton class="h-75 w-full rounded-lg" />
    </div>
  {/snippet}

  {#snippet content()}
    <KpiSummary
      class={cn(["mb-6 grid gap-3 lg:gap-4", "grid-cols-2 lg:grid-cols-4"])}
      data={page.data!.stats.kpis}
    />

    <div
      class={[
        "mt-8 grid gap-4 lg:mt-12 lg:gap-6",
        "3xl:grid-cols-4 grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3",
      ]}
    >
      <MetricChart
        chartType="line"
        title="Uptime % Over Time"
        description="Agent availability over the selected period"
        data={uptimeData}
        xKey="hourTimestamp"
        agents={chartAgents}
        selectedIds={selectedUptime}
        onToggleAgent={(id) =>
          (selectedUptime = toggleAgent(selectedUptime)(id))}
        yPrefix="uptime"
        xFormat={xAxisFormat}
        yFormat={formatUptime}
        padding={{
          left: 40,
          right: 20,
          top: 20,
          bottom: 40,
        }}
        gaps={true}
      />

      <MetricChart
        chartType="line"
        title="Response Time"
        description="Average response time per agent"
        data={responseData}
        xKey="hourTimestamp"
        agents={chartAgents}
        selectedIds={selectedResponse}
        onToggleAgent={(id) =>
          (selectedResponse = toggleAgent(selectedResponse)(id))}
        yPrefix="response"
        xFormat={xAxisFormat}
        yFormat={formatMs}
        padding={{
          left: 40,
          right: 20,
          top: 20,
          bottom: 40,
        }}
        gaps={true}
      />

      <StatusPieChart
        title="Status Distribution"
        description="Aggregate ok / offline / error counts"
        timeSeries={chartTimeSeries}
        agents={chartAgents}
        selectedIds={selectedStatus}
        onToggleAgent={(id) =>
          (selectedStatus = toggleAgent(selectedStatus)(id))}
        height={200}
        padding={{ left: 0, right: 80, bottom: 0, top: 0 }}
      />

      <MetricChart
        chartType="bar"
        title="Response Time (Bar)"
        description="Compare response times visually (in ms)"
        data={responseData}
        xKey="hourTimestamp"
        agents={chartAgents}
        selectedIds={selectedResponseBar}
        onToggleAgent={(id) =>
          (selectedResponseBar = toggleAgent(selectedResponseBar)(id))}
        yPrefix="response"
        xFormat={xAxisFormat}
        yFormat={formatMs}
        padding={{
          left: 0,
          right: 0,
          top: 20,
          bottom: 32,
        }}
        gradient={true}
        strokeWidth={0}
        timeRange={page.timeRange}
      />
    </div>
  {/snippet}

  {#snippet empty()}
    {#if stats && stats.agents.length > 0}
      <Empty.Root class="border border-dashed">
        <Empty.Header>
          <Empty.Media variant="icon">
            <Icon name="agents" class="text-muted-foreground" />
          </Empty.Media>
          <Empty.Title>All agents disabled</Empty.Title>
          <Empty.Description>
            All your agents are currently disabled. Enable an agent to start
            collecting stats.
          </Empty.Description>
        </Empty.Header>
        <Empty.Content>
          <div class="flex gap-2">
            <Button onclick={() => push("/agents")}>Manage Agents</Button>
          </div>
        </Empty.Content>
      </Empty.Root>
    {:else}
      <Empty.Root class="border border-dashed">
        <Empty.Header>
          <Empty.Media variant="icon">
            <Icon name="agents" class="text-muted-foreground" />
          </Empty.Media>
          <Empty.Title>No agents yet</Empty.Title>
          <Empty.Description>
            You haven't created any agents yet. Add an agent to start collecting
            stats.
          </Empty.Description>
        </Empty.Header>
        <Empty.Content>
          <div class="flex gap-2">
            <Button onclick={() => push("/agents/add")}>Create Agent</Button>
          </div>
        </Empty.Content>
      </Empty.Root>
    {/if}
  {/snippet}
</DataPage>
