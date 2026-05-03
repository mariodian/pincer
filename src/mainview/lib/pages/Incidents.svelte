<script lang="ts">
  import type { TimeRange } from "$shared/types";

  import { Timeline } from "$lib/components/incidents";
  import { DataPage } from "$lib/components/ui/data-page";
  import * as Empty from "$lib/components/ui/empty";
  import { Icon } from "$lib/components/ui/icon";
  import { Skeleton } from "$lib/components/ui/skeleton";
  import { currentRoute, previousRoute } from "$lib/services/navigationStore";
  import { createPolledPage } from "$lib/utils/polled-page.svelte";

  const TIME_RANGES: { value: TimeRange; label: string }[] = [
    { value: "24h", label: "24h" },
    { value: "7d", label: "7d" },
  ];

  const page = createPolledPage({
    defaultRange: "24h",
    fetch: (rpc, range) => rpc.getIncidentTimeline({ range }),
  });

  let timeline = $derived(page.data);
  let allEvents = $derived(
    timeline ? [...timeline.recent7d.events, ...timeline.older.events] : [],
  );
  let checkBuckets = $derived(timeline?.recent7d.checkBuckets ?? []);
  let isEmpty = $derived(
    timeline !== null &&
      timeline.recent7d.events.length === 0 &&
      timeline.older.events.length === 0 &&
      timeline.recent7d.checkBuckets.length === 0,
  );
</script>

<DataPage
  title="Incidents"
  description="Incident timeline and raw check history"
  prevPath={$previousRoute}
  currentPath={$currentRoute}
  errorTitle="Failed to load incidents"
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
    <div class="space-y-4">
      <Skeleton class="mb-6 h-29 w-120 rounded-lg" />
      <Skeleton class="mb-6 h-8 w-full rounded-lg" />
      <Skeleton class="h-3 w-20 rounded-lg" />
      <Skeleton class="mb-6 h-40 w-full rounded-lg" />
      <Skeleton class="h-3 w-12 rounded-lg" />
      <Skeleton class="h-44 w-full rounded-lg" />
    </div>
  {/snippet}

  {#snippet content()}
    <Timeline
      events={allEvents}
      {checkBuckets}
      agents={page.data!.agents}
      range={page.timeRange}
      anchorDate={page.anchorDate}
    />
  {/snippet}

  {#snippet empty()}
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
  {/snippet}
</DataPage>
