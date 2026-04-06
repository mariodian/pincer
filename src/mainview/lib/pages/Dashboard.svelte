<script lang="ts">
  import { KpiCard, StatusPieChart } from "$lib/components/dashboard";
  import MetricChart from "$lib/components/dashboard/MetricChart.svelte";
  import { Button } from "$lib/components/ui/button/index.js";
  import * as Empty from "$lib/components/ui/empty/index.js";
  import { ErrorState } from "$lib/components/ui/error-state/index.js";
  import { Icon } from "$lib/components/ui/icon";
  import { PageBody, PageHeader } from "$lib/components/ui/page";
  import { Skeleton } from "$lib/components/ui/skeleton";
  import { getMainRPC, whenReady } from "$lib/services/mainRPC";
  import { currentRoute, previousRoute } from "$lib/services/navigationStore";
  import {
    aggregateByDay,
    fillHourlySlots,
    formatDay,
    formatHour,
    formatMs,
    formatMsKpi,
    formatUptime,
    formatUptimeKpi,
    pivotTimeSeries,
  } from "$lib/utils/dashboard-data";
  import type {
    AgentWithColor,
    DashboardStats,
    TimeRange,
    TimeSeriesPoint,
  } from "$shared/rpc";
  import type { Settings } from "$shared/types";
  import { push } from "@bmlt-enabled/svelte-spa-router";

  type TimeRangeOption = { value: TimeRange; label: string };

  const MAX_RESPONSE_TIMES = {
    ok: 200,
    meh: 500,
  };
  const MIN_UPTIME_THRESHOLDS = {
    ok: 99,
    meh: 50,
  };

  const DEFAULT_TIME_RANGE: TimeRange = "7d";
  const TIME_RANGES: TimeRangeOption[] = [
    { value: "24h", label: "24h" },
    { value: "7d", label: "7d" },
    { value: "30d", label: "30d" },
  ];

  let currentPath = $derived($currentRoute);
  let prevPath = $derived($previousRoute);

  // State
  let loading = $state(true);
  let error = $state<string | null>(null);
  let stats = $state<DashboardStats | null>(null);
  let timeRange = $state<TimeRange>(DEFAULT_TIME_RANGE);
  let showDisabledAgents = $state(false);

  // Per-chart agent filter state
  let selectedUptime = $state<number[]>([]);
  let selectedResponse = $state<number[]>([]);
  let selectedResponseBar = $state<number[]>([]);
  let selectedStatus = $state<number[]>([]);

  let chartAgents = $state<AgentWithColor[]>([]);
  let chartTimeSeries = $state<TimeSeriesPoint[]>([]);

  // Chart data — derived reactively from source state
  let uptimeData = $derived.by(() => {
    let pivoted = pivotTimeSeries(chartTimeSeries, chartAgents, "uptimePct");
    pivoted = fillHourlySlots(pivoted, chartAgents, "uptime");
    if (timeRange !== "24h") pivoted = aggregateByDay(pivoted);
    return pivoted;
  });

  let responseData = $derived.by(() => {
    let pivoted = pivotTimeSeries(
      chartTimeSeries,
      chartAgents,
      "avgResponseMs",
    );
    pivoted = fillHourlySlots(pivoted, chartAgents, "response");
    if (timeRange !== "24h") pivoted = aggregateByDay(pivoted);
    return pivoted;
  });

  // Fetch data
  async function fetchData() {
    loading = true;
    error = null;
    try {
      await whenReady();
      const rpc = getMainRPC();

      // Fetch settings and stats in parallel
      const [settings, result] = await Promise.all([
        rpc.request.getSettings({}) as Promise<Settings>,
        rpc.request.getDashboardStats({ range: timeRange }),
      ]);

      showDisabledAgents = settings.showDisabledAgents;
      stats = result;

      // Filter disabled agents on the client side
      chartAgents = showDisabledAgents
        ? result.agents
        : result.agents.filter((a) => a.enabled !== false);
      chartTimeSeries = showDisabledAgents
        ? result.timeSeries
        : result.timeSeries.filter((p) =>
            chartAgents.some((a) => a.id === p.agentId),
          );

      // Initialize all visible agents as selected if empty
      const allIds = chartAgents.map((a) => a.id);
      if (selectedUptime.length === 0) selectedUptime = allIds;
      if (selectedResponse.length === 0) selectedResponse = allIds;
      if (selectedResponseBar.length === 0) selectedResponseBar = allIds;
      if (selectedStatus.length === 0) selectedStatus = allIds;
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      loading = false;
    }
  }

  // Fetch on mount and when timeRange changes
  $effect(() => {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    timeRange; // reactive dependency
    fetchData();
  });

  // Toggle helper — returns a setter for the given $state array
  function toggleAgent(selected: number[]) {
    return (id: number) => {
      const idx = selected.indexOf(id);
      if (idx === -1) {
        return [...selected, id];
      }
      return selected.filter((sid) => sid !== id);
    };
  }

  // X-axis formatter depends on time range
  let xAxisFormat = $derived(timeRange === "24h" ? formatHour : formatDay);

  function handleTimeRangeChange(range: TimeRange) {
    timeRange = range;
  }
</script>

<div class="flex flex-col h-full">
  <PageHeader
    title="Dashboard"
    description="Monitor agent health and performance"
    {prevPath}
    {currentPath}
  >
    {#snippet actions()}
      <div class="flex items-center gap-1 rounded-lg border bg-background p-1">
        {#each TIME_RANGES as tr}
          <button
            type="button"
            class={[
              "rounded-md px-3 py-1 text-xs font-medium transition-colors",
              timeRange === tr.value
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted",
            ]}
            onclick={() => handleTimeRangeChange(tr.value)}
          >
            {tr.label}
          </button>
        {/each}
      </div>
    {/snippet}
  </PageHeader>

  <PageBody>
    {#if error}
      <ErrorState
        class="flex-1 py-16"
        title="Failed to load dashboard"
        description={error ?? undefined}
      >
        {#snippet icon()}
          <Icon name="alertCircle" class="size-5 text-destructive" />
        {/snippet}
        {#snippet cta()}
          <Button
            variant="outline"
            disabled={loading}
            onclick={() => fetchData()}
          >
            <Icon name="alertCircle" />
            {loading ? "Retrying..." : "Retry"}
          </Button>
        {/snippet}
      </ErrorState>
    {:else}
      {#if stats && chartAgents.length > 0}
        <!-- KPI Row -->
        <div class={["grid gap-3 lg:gap-4 mb-6", "grid-cols-2 lg:grid-cols-4"]}>
          <KpiCard
            title="Agents"
            color={stats ? "blue" : "default"}
            gradient
            value={stats
              ? `${stats.kpis.activeAgents} / ${stats.kpis.totalAgents}`
              : "—"}
            subtitle="Active / Total"
            {loading}
          />

          <KpiCard
            title="Avg Uptime"
            color={(stats &&
              stats.kpis.avgUptime !== null &&
              stats.kpis.avgUptime > 0 &&
              (stats.kpis.avgUptime < MIN_UPTIME_THRESHOLDS.meh
                ? "destructive"
                : stats.kpis.avgUptime < MIN_UPTIME_THRESHOLDS.ok
                  ? "yellow"
                  : "green")) ||
              "default"}
            gradient
            value={stats && stats.kpis.avgUptime !== null
              ? formatUptimeKpi(stats.kpis.avgUptime)
              : "—"}
            subtitle={showDisabledAgents
              ? "Across all agents"
              : "Across enabled agents"}
            {loading}
          />

          <KpiCard
            title="Avg Response"
            color={(stats &&
              stats.kpis.avgResponseMs > 0 &&
              (stats.kpis.avgResponseMs >= MAX_RESPONSE_TIMES.meh
                ? "destructive"
                : stats.kpis.avgResponseMs >= MAX_RESPONSE_TIMES.ok
                  ? "yellow"
                  : "green")) ||
              "default"}
            gradient
            value={stats ? formatMsKpi(stats.kpis.avgResponseMs) : "—"}
            subtitle={showDisabledAgents
              ? "Across all agents"
              : "Across enabled agents"}
            {loading}
          />

          <KpiCard
            title="Incidents"
            color={(stats &&
              stats.kpis.incidentCount > 0 &&
              (stats.kpis.incidentCount > 0 ? "destructive" : "green")) ||
              "default"}
            gradient
            value={stats ? stats.kpis.incidentCount : "—"}
            subtitle="Offline + Error checks"
            {loading}
          />
        </div>
      {/if}

      <!-- Charts -->
      {#if loading}
        <div class="grid gap-4 lg:gap-6 mt-8 lg:mt-12">
          <Skeleton class="h-75 w-full rounded-lg" />
          <Skeleton class="h-75 w-full rounded-lg" />
          <Skeleton class="h-75 w-full rounded-lg" />
          <Skeleton class="h-75 w-full rounded-lg" />
        </div>
      {:else if stats && chartAgents.length > 0}
        <div
          class={[
            "grid gap-4 lg:gap-6 mt-8 lg:mt-12",
            "grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 3xl:grid-cols-4",
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
              left: 32,
              right: 20,
              bottom: 40,
              top: 20,
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
            description="Compare response times visually"
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
            {timeRange}
          />
        </div>
      {:else}
        <Empty.Root class="border border-dashed">
          <Empty.Header>
            <Empty.Media variant="icon">
              <Icon name="agents" class="text-muted-foreground" />
            </Empty.Media>
            <Empty.Title>No agents yet</Empty.Title>
            <Empty.Description>
              You haven't created any agents yet. Add an agent to start
              collecting stats.
            </Empty.Description>
          </Empty.Header>
          <Empty.Content>
            <div class="flex gap-2">
              <Button onclick={() => push("/agents/add")}>Create Agent</Button>
            </div>
          </Empty.Content>
        </Empty.Root>
      {/if}
    {/if}
  </PageBody>
</div>
