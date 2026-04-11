<script lang="ts">
  import type { IncidentTimeline } from "$bun/rpc/incidentRPC";
  import { Timeline } from "$lib/components/incidents";
  import { Button } from "$lib/components/ui/button";
  import * as Empty from "$lib/components/ui/empty/index.js";
  import { ErrorState } from "$lib/components/ui/error-state/index.js";
  import { Icon } from "$lib/components/ui/icon";
  import { PageBody, PageHeader } from "$lib/components/ui/page";
  import { Skeleton } from "$lib/components/ui/skeleton";
  import { getMainRPC, whenReady } from "$lib/services/mainRPC";
  import { currentRoute, previousRoute } from "$lib/services/navigationStore";
  import type { TimeRange } from "$shared/types";

  type TimeRangeOption = { value: TimeRange; label: string };

  const DEFAULT_TIME_RANGE: TimeRange = "7d";
  const TIME_RANGES: TimeRangeOption[] = [
    { value: "24h", label: "24h" },
    { value: "7d", label: "7d" },
    { value: "30d", label: "30d" },
    { value: "90d", label: "90d" },
  ];

  let currentPath = $derived($currentRoute);
  let prevPath = $derived($previousRoute);

  // State
  let loading = $state(true);
  let error = $state<string | null>(null);
  let timeline = $state<IncidentTimeline | null>(null);
  let timeRange = $state<TimeRange>(DEFAULT_TIME_RANGE);

  async function fetchData() {
    loading = true;
    error = null;
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
    timeRange = range;
  }
</script>

<div class="flex flex-col h-full">
  <PageHeader
    title="Incidents"
    description="Incident timeline and raw check history"
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
        title="Failed to load incidents"
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
    {:else if loading}
      <div class="space-y-4">
        <Skeleton class="h-32 w-full rounded-lg" />
        <Skeleton class="h-32 w-full rounded-lg" />
        <Skeleton class="h-32 w-full rounded-lg" />
      </div>
    {:else if timeline}
      {@const allEvents = [
        ...timeline.recent7d.events,
        ...timeline.older.events,
      ]}
      {@const allChecks = timeline.recent7d.checks}

      {#if allEvents.length === 0 && allChecks.length === 0}
        <Empty.Root class="border border-dashed">
          <Empty.Header>
            <Empty.Media variant="icon">
              <Icon name="checkCircle" class="text-muted-foreground" />
            </Empty.Media>
            <Empty.Title>No incidents</Empty.Title>
            <Empty.Description>
              No incidents have been recorded for the selected time period.
            </Empty.Description>
          </Empty.Header>
        </Empty.Root>
      {:else}
        <Timeline
          events={allEvents}
          checks={allChecks}
          agents={timeline.agents}
        />
      {/if}
    {:else}
      <Empty.Root class="border border-dashed">
        <Empty.Header>
          <Empty.Media variant="icon">
            <Icon name="alertCircle" class="text-muted-foreground" />
          </Empty.Media>
          <Empty.Title>No data</Empty.Title>
          <Empty.Description>Unable to load incident data.</Empty.Description>
        </Empty.Header>
      </Empty.Root>
    {/if}
  </PageBody>
</div>
