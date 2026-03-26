<script lang="ts">
  import { KpiCard, StatusPieChart } from "$lib/components/dashboard";
  import MetricChart from "$lib/components/dashboard/MetricChart.svelte";
  import { PageBody, PageHeader } from "$lib/components/ui/page";
  import { Skeleton } from "$lib/components/ui/skeleton";
  import { getMainRPC, whenReady } from "$lib/services/mainRPC";
  import { currentRoute, previousRoute } from "$lib/services/navigationStore";
  import type {
    AgentWithColor,
    DashboardStats,
    TimeRange,
    TimeSeriesPoint,
  } from "$shared/rpc";

  type TimeRangeOption = { value: TimeRange; label: string };

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

  // Per-chart agent filter state
  let selectedUptime = $state<number[]>([]);
  let selectedResponse = $state<number[]>([]);
  let selectedResponseBar = $state<number[]>([]);
  let selectedStatus = $state<number[]>([]);

  // Chart data — computed explicitly in fetchData() to avoid
  // Svelte 5 $derived reactivity issues with $state proxy tracking
  let uptimeData = $state<Record<string, unknown>[]>([]);
  let responseData = $state<Record<string, unknown>[]>([]);

  // Fetch data
  async function fetchData() {
    loading = true;
    error = null;
    try {
      await whenReady();
      const rpc = getMainRPC();
      const result = await rpc.request.getDashboardStats({ range: timeRange });
      stats = result;

      // Compute chart data explicitly (avoids $derived reactivity issues)
      let uptimePivoted = pivotTimeSeries(
        result.timeSeries,
        result.agents,
        "uptimePct",
      );
      let responsePivoted = pivotTimeSeries(
        result.timeSeries,
        result.agents,
        "avgResponseMs",
      );

      // Insert null rows for missing hours so chart shows gaps
      uptimePivoted = fillHourlySlots(uptimePivoted, result.agents, "uptime");

      // Aggregate to daily for longer time ranges
      if (timeRange !== "24h") {
        uptimePivoted = aggregateByDay(uptimePivoted);
        responsePivoted = aggregateByDay(responsePivoted);
      }

      uptimeData = uptimePivoted;
      responseData = responsePivoted;

      // Initialize all agents as selected if empty
      const allIds = result.agents.map((a) => a.id);
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

  // Toggle helpers
  function toggleUptime(id: number) {
    const idx = selectedUptime.indexOf(id);
    if (idx === -1) {
      selectedUptime = [...selectedUptime, id];
    } else {
      selectedUptime = selectedUptime.filter((sid) => sid !== id);
    }
  }

  function toggleResponse(id: number) {
    const idx = selectedResponse.indexOf(id);
    if (idx === -1) {
      selectedResponse = [...selectedResponse, id];
    } else {
      selectedResponse = selectedResponse.filter((sid) => sid !== id);
    }
  }

  function toggleResponseBar(id: number) {
    const idx = selectedResponseBar.indexOf(id);
    if (idx === -1) {
      selectedResponseBar = [...selectedResponseBar, id];
    } else {
      selectedResponseBar = selectedResponseBar.filter((sid) => sid !== id);
    }
  }

  function toggleStatus(id: number) {
    const idx = selectedStatus.indexOf(id);
    if (idx === -1) {
      selectedStatus = [...selectedStatus, id];
    } else {
      selectedStatus = selectedStatus.filter((sid) => sid !== id);
    }
  }

  // Pivot time series data for charts
  function pivotTimeSeries(
    series: TimeSeriesPoint[],
    agents: AgentWithColor[],
    valueKey: "uptimePct" | "avgResponseMs",
  ): Record<string, unknown>[] {
    const prefix = valueKey === "uptimePct" ? "uptime" : "response";
    const byHour = new Map<number, Record<string, unknown>>();

    for (const point of series) {
      if (!byHour.has(point.hourTimestamp)) {
        byHour.set(point.hourTimestamp, {
          hourTimestamp: new Date(point.hourTimestamp * 1000),
        });
      }
      const row = byHour.get(point.hourTimestamp)!;
      row[`${prefix}_${point.agentId}`] = point[valueKey];
    }

    // Fill missing agents with null
    for (const row of byHour.values()) {
      for (const agent of agents) {
        const key = `${prefix}_${agent.id}`;
        if (!(key in row)) {
          row[key] = null;
        }
      }
    }

    return Array.from(byHour.values()).sort(
      (a, b) =>
        (a.hourTimestamp as Date).getTime() -
        (b.hourTimestamp as Date).getTime(),
    );
  }

  // Insert null rows for missing hours between first and last data point
  function fillHourlySlots(
    rows: Record<string, unknown>[],
    agents: AgentWithColor[],
    yPrefix: string,
  ): Record<string, unknown>[] {
    if (rows.length <= 1) return rows;

    const HOUR = 3600000;
    const first = (rows[0].hourTimestamp as Date).getTime();
    const last = (rows[rows.length - 1].hourTimestamp as Date).getTime();

    const existing = new Map<number, Record<string, unknown>>();
    for (const row of rows) {
      existing.set((row.hourTimestamp as Date).getTime(), row);
    }

    const filled: Record<string, unknown>[] = [];
    for (let ts = first; ts <= last; ts += HOUR) {
      if (existing.has(ts)) {
        filled.push(existing.get(ts)!);
      } else {
        const row: Record<string, unknown> = { hourTimestamp: new Date(ts) };
        for (const agent of agents) {
          row[`${yPrefix}_${agent.id}`] = null;
        }
        filled.push(row);
      }
    }

    return filled;
  }

  // Aggregate hourly pivoted data to daily averages
  function aggregateByDay(
    rows: Record<string, unknown>[],
  ): Record<string, unknown>[] {
    const DAY_MS = 86400000;
    const byDay = new Map<
      number,
      { values: Record<string, number[]>; ts: number }
    >();

    for (const row of rows) {
      const dayTs =
        Math.floor((row.hourTimestamp as Date).getTime() / DAY_MS) * DAY_MS;
      if (!byDay.has(dayTs)) {
        byDay.set(dayTs, { values: {}, ts: dayTs });
      }
      const bucket = byDay.get(dayTs)!;
      for (const [key, val] of Object.entries(row)) {
        if (key === "hourTimestamp") continue;
        if (typeof val === "number") {
          if (!bucket.values[key]) bucket.values[key] = [];
          bucket.values[key].push(val);
        }
      }
    }

    return Array.from(byDay.values())
      .map(({ values, ts }) => {
        const row: Record<string, unknown> = { hourTimestamp: new Date(ts) };
        for (const [key, vals] of Object.entries(values)) {
          row[key] =
            Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) /
            100;
        }
        return row;
      })
      .sort(
        (a, b) =>
          (a.hourTimestamp as Date).getTime() -
          (b.hourTimestamp as Date).getTime(),
      );
  }

  // X-axis formatters (values are Date objects since pivot converts timestamps)
  function formatHour(val: unknown): string {
    const d = val instanceof Date ? val : new Date(Number(val) * 1000);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  function formatDay(val: unknown): string {
    const d = val instanceof Date ? val : new Date(Number(val) * 1000);
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  }

  let xAxisFormat = $derived(timeRange === "24h" ? formatHour : formatDay);

  function formatUptime(val: unknown): string {
    return `${val}%`;
  }

  function formatMs(val: unknown): string {
    return `${val}ms`;
  }

  function formatUptimeKpi(val: number): string {
    return `${val.toFixed(1)}%`;
  }

  function formatMsKpi(val: number): string {
    return `${Math.round(val)}ms`;
  }

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
      <div class="flex items-center gap-1 rounded-lg border p-1">
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
      <div
        class="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive"
      >
        Failed to load dashboard data: {error}
      </div>
    {:else}
      <!-- KPI Row -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <KpiCard
          title="Avg Uptime"
          value={stats ? formatUptimeKpi(stats.kpis.avgUptime) : "—"}
          subtitle="Across all agents"
          {loading}
        />
        <KpiCard
          title="Agents"
          value={stats
            ? `${stats.kpis.activeAgents} / ${stats.kpis.totalAgents}`
            : "—"}
          subtitle="Active / Total"
          {loading}
        />
        <KpiCard
          title="Incidents"
          value={stats ? stats.kpis.incidentCount : "—"}
          subtitle="Offline + Error checks"
          {loading}
        />
        <KpiCard
          title="Avg Response"
          value={stats ? formatMsKpi(stats.kpis.avgResponseMs) : "—"}
          subtitle="Across all agents"
          {loading}
        />
      </div>

      <!-- Charts -->
      {#if loading}
        <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <Skeleton class="h-75 w-full rounded-lg" />
          <Skeleton class="h-75 w-full rounded-lg" />
          <Skeleton class="h-75 w-full rounded-lg" />
          <Skeleton class="h-75 w-full rounded-lg" />
        </div>
      {:else if stats && stats.agents.length > 0}
        <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <!--
            chartType: change "line" to "bar" or "area" to experiment
            with different visualizations for the same data.
            -->
          <!-- <LineChart
            data={uptimeData}
            series={stats.agents}
            xKey="date"
            xAxis={xAxisFormat}
            yAxis={formatUptime}
          /> -->

          <MetricChart
            chartType="line"
            title="Uptime % Over Time"
            description="Agent availability over the selected period"
            data={uptimeData}
            xKey="hourTimestamp"
            agents={stats.agents}
            selectedIds={selectedUptime}
            onToggleAgent={toggleUptime}
            yPrefix="uptime"
            xFormat={xAxisFormat}
            yFormat={formatUptime}
            gaps={true}
            gradient={true}
            strokeWidth={3}
          />

          <MetricChart
            chartType="line"
            title="Response Time"
            description="Average response time per agent"
            data={responseData}
            xKey="hourTimestamp"
            agents={stats.agents}
            selectedIds={selectedResponse}
            onToggleAgent={toggleResponse}
            yPrefix="response"
            xFormat={xAxisFormat}
            yFormat={formatMs}
          />

          <StatusPieChart
            title="Status Distribution"
            description="Aggregate ok / offline / error counts"
            timeSeries={stats.timeSeries}
            agents={stats.agents}
            selectedIds={selectedStatus}
            onToggleAgent={toggleStatus}
          />

          <!-- <MetricChart
            chartType="bar"
            title="Response Time (Bar)"
            description="Compare response times visually"
            data={responseData}
            xKey="hourTimestamp"
            agents={stats.agents}
            selectedIds={selectedResponseBar}
            onToggleAgent={toggleResponseBar}
            yPrefix="response"
            xFormat={xAxisFormat}
            yFormat={formatMs}
          /> -->
        </div>
      {:else}
        <div
          class="rounded-lg border p-8 text-center text-sm text-muted-foreground"
        >
          No agents configured yet. Add an agent to start collecting stats.
        </div>
      {/if}
    {/if}
  </PageBody>
</div>
