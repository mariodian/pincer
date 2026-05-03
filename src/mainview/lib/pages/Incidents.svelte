<script lang="ts">
  import type { IncidentTimeline } from "$bun/rpc/incidentRPC";
  import type { AdvancedSettings, TimeRange } from "$shared/types";

  import { Timeline } from "$lib/components/incidents";
  import { Button } from "$lib/components/ui/button";
  import * as Empty from "$lib/components/ui/empty";
  import { ErrorState } from "$lib/components/ui/error-state";
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
  import { createDebouncedVisibility } from "$lib/utils/debounced-visibility.svelte";
  import { createFetchState } from "$lib/utils/fetch-state.svelte";

  type TimeRangeOption = { value: TimeRange; label: string };

  const DEFAULT_TIME_RANGE: TimeRange = "24h";
  const TIME_RANGES: TimeRangeOption[] = [
    { value: "24h", label: "24h" },
    { value: "7d", label: "7d" },
  ];

  let timeline = $state<IncidentTimeline | null>(null);
  let timeRange = $state<TimeRange>(DEFAULT_TIME_RANGE);
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

  let isEmpty = $derived(
    timeline !== null &&
      timeline.recent7d.events.length === 0 &&
      timeline.older.events.length === 0 &&
      timeline.recent7d.checkBuckets.length === 0,
  );

  let allEvents = $derived(
    timeline ? [...timeline.recent7d.events, ...timeline.older.events] : [],
  );

  let checkBuckets = $derived(timeline?.recent7d.checkBuckets ?? []);

  async function fetchData(range: TimeRange, silent: boolean = false) {
    await fetchState.run(
      async () => {
        await whenReady();
        const rpc = getMainRPC();

        const [nextTimeline, advancedSettings] = await Promise.all([
          rpc.request.getIncidentTimeline({ range }),
          rpc.request.getAdvancedSettings({}) as Promise<AdvancedSettings>,
        ]);

        timeline = nextTimeline;
        pollingIntervalMs = advancedSettings.pollingInterval;
        anchorDate = new Date(); // snapshot "now" at the moment data arrived
      },
      { silent },
    );
  }

  function handleTimeRangeChange(range: TimeRange) {
    if (range === timeRange) return; // No change (prevents re-clicking same)
    fetchState.clearError();
    fetchState.beginInitialLoading(); // Show skeletons immediately on range change
    timeline = null; // Clear old data
    timeRange = range;
  }

  // Fetch on mount and when timeRange changes
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
    title="Incidents"
    description="Incident timeline and raw check history"
    {prevPath}
    {currentPath}
  >
    {#snippet actions()}
      <div class="flex items-center gap-3">
        {#if showRefreshing}
          <span class="text-muted-foreground text-xs"> updating... </span>
        {/if}
        <TimeRangePicker
          value={timeRange}
          options={TIME_RANGES}
          onchange={handleTimeRangeChange}
          onrefresh={() => fetchData(timeRange, true)}
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
        title="Failed to load incidents"
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
        <Skeleton class="mb-6 h-29 w-120 rounded-lg" />
        <Skeleton class="mb-6 h-8 w-full rounded-lg" />
        <Skeleton class="h-3 w-20 rounded-lg" />
        <Skeleton class="mb-6 h-40 w-full rounded-lg" />
        <Skeleton class="h-3 w-12 rounded-lg" />
        <Skeleton class="h-44 w-full rounded-lg" />
      </div>
    {:else if timeline && !isEmpty}
      <Timeline
        events={allEvents}
        {checkBuckets}
        agents={timeline.agents}
        range={timeRange}
        {anchorDate}
      />
    {:else}
      <Empty.Root class="border border-dashed">
        <Empty.Header>
          <Empty.Media variant="icon">
            <Icon name="pulse" class="text-muted-foreground" />
          </Empty.Media>
          <Empty.Title>No data</Empty.Title>
          <Empty.Description>
            No events and incidents have been recorded for the selected time
            period.
          </Empty.Description>
        </Empty.Header>
      </Empty.Root>
    {/if}
  </PageBody>
</div>
