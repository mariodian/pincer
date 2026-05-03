<script lang="ts">
  import type { UptimeReport } from "$shared/reportTypes";
  import {
    RANGE_SHORT_LABELS,
    REPORT_RANGES,
  } from "$shared/time-range-helpers";
  import type { AdvancedSettings, TimeRange } from "$shared/types";
  import { toast } from "svelte-sonner";

  import { AgentTable } from "$lib/components/reports";
  import KpiSummary from "$lib/components/reports/KpiSummary.svelte";
  import { Button } from "$lib/components/ui/button";
  import * as Empty from "$lib/components/ui/empty/index.js";
  import { ErrorState } from "$lib/components/ui/error-state/index.js";
  import { Icon } from "$lib/components/ui/icon";
  import { PageBody, PageHeader } from "$lib/components/ui/page";
  import { Skeleton } from "$lib/components/ui/skeleton";
  import { TimeRangePicker } from "$lib/components/ui/time-range-picker";
  import { MIN_POLLING_INTERVAL_MS } from "$lib/constants";
  import {
    getMainRPC,
    offAgentSync,
    onAgentSync,
    whenReady,
  } from "$lib/services/mainRPC";
  import { currentRoute, previousRoute } from "$lib/services/navigationStore";
  import { cn } from "$lib/utils";
  import { createDebouncedVisibility } from "$lib/utils/debounced-visibility.svelte";
  import { createFetchState } from "$lib/utils/fetch-state.svelte";

  const REPORT_RANGE_OPTIONS = REPORT_RANGES.map((r) => ({
    value: r,
    label: RANGE_SHORT_LABELS[r],
  }));

  type SortKey = "name" | "uptime" | "checks" | "incidents" | "avgResponse";

  let sortKey = $state<SortKey>("uptime");
  let sortAsc = $state(false);
  let report = $state<UptimeReport | null>(null);
  let timeRange = $state<TimeRange>("30d");
  let exporting = $state(false);
  let anchorDate = $state(new Date());
  let pollingIntervalMs = $state<number | null>(null);
  let syncKey: string;

  const fetchState = createFetchState();

  let currentPath = $derived($currentRoute);
  let prevPath = $derived($previousRoute);

  let error = $derived(fetchState.error);
  let initialLoading = $derived(fetchState.initialLoading);
  let refreshing = $derived(fetchState.refreshing);

  const refreshingIndicator = createDebouncedVisibility(
    () => refreshing && !initialLoading,
    1000,
  );

  let showRefreshing = $derived(refreshingIndicator.visible);
  let shouldShowLastUpdated = $derived(
    pollingIntervalMs !== null && pollingIntervalMs >= MIN_POLLING_INTERVAL_MS,
  );

  const reportWithData = $derived(
    report !== null && report.agents.some((agent) => agent.hasData)
      ? report
      : null,
  );

  async function fetchData(range: TimeRange, silent: boolean = false) {
    await fetchState.run(
      async () => {
        await whenReady();
        const rpc = getMainRPC();

        const [data, advancedSettings] = await Promise.all([
          rpc.request.getUptimeReport({ range }),
          rpc.request.getAdvancedSettings({}) as Promise<AdvancedSettings>,
        ]);

        report = data;
        pollingIntervalMs = advancedSettings.pollingInterval;
        anchorDate = new Date(); // snapshot "now" at the moment data arrived
      },
      { silent },
    );
  }

  async function handleExportHtml(range: TimeRange) {
    exporting = true;
    try {
      await whenReady();
      const rpc = getMainRPC();
      const html = await rpc.request.exportHtmlReport({ range });

      const fileName = `pincer-uptime-${range}.html`;

      if (typeof window !== "undefined") {
        const blob = new Blob([html], { type: "text/html" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        const downloadsPath = (await rpc.request.getDownloadsPath({})).path;
        toast.success("HTML report exported", {
          description: `Saved to ${downloadsPath}`,
          action: {
            label: "Show in Folder",
            onClick: async () => {
              await rpc.request.openFolder({ path: downloadsPath });
            },
          },
        });
      }
    } catch (e) {
      console.error("Failed to export report:", e);
    } finally {
      exporting = false;
    }
  }

  function handleTimeRangeChange(range: TimeRange) {
    fetchState.clearError();
    fetchState.beginInitialLoading(); // Show skeletons immediately on range change
    timeRange = range;
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      sortAsc = !sortAsc;
    } else {
      sortKey = key;
      sortAsc = key !== "uptime" && key !== "checks";
    }
  }

  $effect(() => {
    fetchData(timeRange, true);
  });

  // Subscribe to agent sync events to refresh data
  $effect(() => {
    syncKey = onAgentSync(() => fetchData(timeRange, true));
    return () => offAgentSync(syncKey); // cleanup on unmount
  });
</script>

<div class="flex h-full flex-col">
  <PageHeader
    title="Uptime Reports"
    description="Agent performance overview"
    {prevPath}
    {currentPath}
  >
    {#snippet actions()}
      <div class="flex items-center gap-2">
        {#if showRefreshing}
          <span class="text-muted-foreground text-xs">updating...</span>
        {/if}
        <TimeRangePicker
          value={timeRange}
          options={REPORT_RANGE_OPTIONS}
          onchange={handleTimeRangeChange}
          onrefresh={shouldShowLastUpdated
            ? () => fetchData(timeRange, true)
            : undefined}
          {refreshing}
          lastUpdated={shouldShowLastUpdated ? anchorDate : undefined}
        />
      </div>
    {/snippet}
  </PageHeader>

  <PageBody>
    {#if error}
      <ErrorState
        class="flex-1 py-16"
        title="Failed to load report"
        description={error ?? undefined}
      >
        {#snippet icon()}
          <Icon name="alertCircle" class="text-destructive size-5" />
        {/snippet}
        {#snippet cta()}
          <Button
            variant="outline"
            disabled={refreshing}
            onclick={() => fetchData(timeRange)}
          >
            <Icon name="alertCircle" />
            {refreshing ? "Retrying..." : "Retry"}
          </Button>
        {/snippet}
      </ErrorState>
    {:else if initialLoading}
      <div class="space-y-4">
        <div class={["mb-6 grid gap-3 lg:gap-4", "grid-cols-2 lg:grid-cols-4"]}>
          <Skeleton class="h-25 w-full rounded-lg" />
          <Skeleton class="h-25 w-full rounded-lg" />
          <Skeleton class="h-25 w-full rounded-lg" />
          <Skeleton class="h-25 w-full rounded-lg" />
        </div>
        <div>
          <Skeleton class="h-8 w-32 rounded-lg" />
        </div>
        <Skeleton class="h-48 w-full rounded-lg" />
      </div>
    {:else if reportWithData}
      <!-- KPI Row -->
      <KpiSummary
        class={cn(["mb-6 grid gap-3 lg:gap-4", "grid-cols-2 lg:grid-cols-4"])}
        data={reportWithData}
      />

      <div class="mb-4 flex items-center justify-between">
        <div class="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={exporting || refreshing || initialLoading}
            onclick={() => handleExportHtml(timeRange)}
          >
            <Icon name="download" />
            {exporting ? "Exporting..." : "Export HTML"}
          </Button>
        </div>
      </div>

      <AgentTable
        agents={reportWithData.agents}
        {sortKey}
        {sortAsc}
        onSort={toggleSort}
      />
    {:else}
      <Empty.Root class="border border-dashed">
        <Empty.Header>
          <Empty.Media variant="icon">
            <Icon name="barChart" class="text-muted-foreground" />
          </Empty.Media>
          <Empty.Title>No report data</Empty.Title>
          <Empty.Description>
            There isn't enough data yet to generate a report.
          </Empty.Description>
        </Empty.Header>
      </Empty.Root>
    {/if}
  </PageBody>
</div>
