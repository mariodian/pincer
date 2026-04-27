<script lang="ts">
  import type { IncidentTimeline } from "$bun/rpc/incidentRPC";
  import type { TimeRange } from "$shared/types";

  import { Timeline } from "$lib/components/incidents";
  import { Button } from "$lib/components/ui/button";
  import * as Empty from "$lib/components/ui/empty";
  import { ErrorState } from "$lib/components/ui/error-state";
  import { Icon } from "$lib/components/ui/icon";
  import { PageBody, PageHeader } from "$lib/components/ui/page";
  import { Skeleton } from "$lib/components/ui/skeleton";
  import { TimeRangePicker } from "$lib/components/ui/time-range-picker";
  import { getMainRPC, whenReady } from "$lib/services/mainRPC";
  import { currentRoute, previousRoute } from "$lib/services/navigationStore";

  type TimeRangeOption = { value: TimeRange; label: string };

  const DEFAULT_TIME_RANGE: TimeRange = "24h";
  const TIME_RANGES: TimeRangeOption[] = [
    { value: "24h", label: "24h" },
    { value: "7d", label: "7d" },
  ];

  let currentPath = $derived($currentRoute);
  let prevPath = $derived($previousRoute);

  // State
  let loading = $state(true);
  let error = $state<string | null>(null);
  let timeline = $state<IncidentTimeline | null>(null);
  let timeRange = $state<TimeRange>(DEFAULT_TIME_RANGE);

  async function fetchData() {
    try {
      await whenReady();
      const rpc = getMainRPC();
      timeline = await rpc.request.getIncidentTimeline({ range: timeRange });
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

  function handleTimeRangeChange(range: TimeRange) {
    if (range === timeRange) return; // No change (prevents re-clicking same)
    loading = true; // Immediate skeleton feedback
    error = null;
    timeline = null; // Clear old data
    timeRange = range;
  }

  // Derived state for empty check - ensures proper reactivity
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
</script>

<div class="flex h-full flex-col">
  <PageHeader
    title="Incidents"
    description="Incident timeline and raw check history"
    {prevPath}
    {currentPath}
  >
    {#snippet actions()}
      <TimeRangePicker
        value={timeRange}
        options={TIME_RANGES}
        onchange={handleTimeRangeChange}
      />
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
            disabled={loading}
            onclick={() => fetchData()}
          >
            <Icon name="alertCircle" />
            {loading ? "Retrying..." : "Retry"}
          </Button>
        {/snippet}
      </ErrorState>
    {:else if loading}
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
