<script lang="ts">
  import { Heatmap, IncidentCard } from "$lib/components/incidents";
  import * as Empty from "$lib/components/ui/empty";
  import { Icon } from "$lib/components/ui/icon";
  import { cn } from "$lib/utils";
  import { formatShortDate } from "$lib/utils/datetime";
  import type { Check, IncidentEvent, TimeRange } from "$shared/types";
  import TooltipProvider from "$lib/components/ui/tooltip/tooltip-provider.svelte";

  interface Props {
    events: IncidentEvent[];
    checks: Check[];
    agents: Array<{
      id: number;
      name: string;
      color: string;
    }>;
    range?: TimeRange;
    class?: string;
  }

  let { events, checks, agents, range = "24h", class: className }: Props = $props();

  // Group events by incident
  const incidents = $derived.by(() => {
    const grouped = new Map<string, IncidentEvent[]>();
    for (const event of events) {
      const existing = grouped.get(event.incidentId) || [];
      existing.push(event);
      grouped.set(event.incidentId, existing);
    }
    // Sort incidents by most recent event
    return Array.from(grouped.entries()).sort((a, b) => {
      const aMax = Math.max(...a[1].map((e) => e.eventAt));
      const bMax = Math.max(...b[1].map((e) => e.eventAt));
      return bMax - aMax;
    });
  });

  const getAgent = (agentId: number) => {
    const agent = agents.find((a) => a.id === agentId);
    if (!agent) {
      console.warn(`Agent ${agentId} not found in agents list`);
    }
    return agent;
  };

  // Pre-group and sort checks once so hover-driven tooltip updates do not
  // repeatedly filter/sort in the template.
  const checksByDay = $derived.by(() => {
    const grouped = new Map<string, Check[]>();
    for (const check of checks) {
      const day = formatShortDate(check.checkedAt);
      const existing = grouped.get(day) || [];
      existing.push(check);
      grouped.set(day, existing);
    }

    for (const dayChecks of grouped.values()) {
      dayChecks.sort((a, b) => a.checkedAt - b.checkedAt);
    }

    return grouped;
  });

  // Group incidents by day
  const incidentsByDay = $derived.by(() => {
    const grouped = new Map<string, Array<[string, IncidentEvent[]]>>();
    for (const [incidentId, incidentEvents] of incidents) {
      const maxTime = Math.max(
        ...incidentEvents.map((e: IncidentEvent) => e.eventAt),
      );
      const day = formatShortDate(maxTime);
      const existing = grouped.get(day) || [];
      existing.push([incidentId, incidentEvents]);
      grouped.set(day, existing);
    }
    return grouped;
  });

  // Combine all days from both checks and incidents
  const allDays = $derived.by(() => {
    const days = new Set<string>();
    for (const day of checksByDay.keys()) {
      days.add(day);
    }
    for (const day of incidentsByDay.keys()) {
      days.add(day);
    }
    // Sort days descending (newest first)
    return Array.from(days).sort((a, b) => {
      // Parse dates for comparison (formatShortDate produces strings like "Apr 12")
      // We'll compare by finding the earliest check/incident for each day
      const getDayTimestamp = (dayStr: string) => {
        const dayChecks = checksByDay.get(dayStr);
        const dayIncidents = incidentsByDay.get(dayStr);
        let minTime = Infinity;
        if (dayChecks) {
          for (const check of dayChecks) {
            minTime = Math.min(minTime, check.checkedAt);
          }
        }
        if (dayIncidents) {
          for (const [, incEvents] of dayIncidents) {
            for (const evt of incEvents) {
              minTime = Math.min(minTime, evt.eventAt);
            }
          }
        }
        return minTime;
      };
      return getDayTimestamp(b) - getDayTimestamp(a);
    });
  });
</script>

<TooltipProvider delayDuration={0} skipDelayDuration={300}>
  <div class={cn("space-y-6", className)}>
    {#each allDays as day (day)}
      {@const dayChecks = checksByDay.get(day)}
      {@const dayIncidents = incidentsByDay.get(day)}
      <div class="relative">
        <!-- Day header -->
        <div
          class={cn(
            "sticky top-0 -mx-2 px-2 z-10 mb-4 py-2",
            "flex items-center gap-4",
            "bg-content-background border-content-background",
          )}
        >
          <h3 class="text-sm font-medium">{day}</h3>
          <div class="flex-1 border-t"></div>
        </div>

        <!-- Heatmap section for this day (Phase 4) -->
        {#if dayChecks && dayChecks.length > 0}
          <div class="mb-6">
            <h4 class="mb-3 text-xs font-medium uppercase text-muted-foreground">
              Raw Checks
            </h4>
            <Heatmap checks={dayChecks} {range} cellSize="size-4" />
          </div>
        {/if}

        <!-- Incidents for this day -->
        {#if dayIncidents && dayIncidents.length > 0}
          <div class="space-y-4">
            <h4 class="mb-3 text-xs font-medium uppercase text-muted-foreground">
              Events
            </h4>
            {#each dayIncidents as [incidentId, incidentEvents] (incidentId)}
              {@const firstEvent = incidentEvents[0]}
              {@const agent = getAgent(firstEvent.agentId)}
              {#if agent}
                <IncidentCard
                  events={incidentEvents}
                  agentName={agent.name}
                  agentColor={agent.color}
                />
              {:else}
                <div class="text-xs text-muted-foreground">
                  Unknown agent (ID: {firstEvent.agentId})
                </div>
              {/if}
            {/each}
          </div>
        {/if}
      </div>
    {/each}

    {#if events.length === 0}
      <Empty.Root class="border border-dashed">
        <Empty.Header>
          <Empty.Media variant="icon">
            <Icon name="trendingUpDown" class="text-muted-foreground" />
          </Empty.Media>
          <Empty.Title>No incidents</Empty.Title>
          <Empty.Description>
            No incidents have been recorded for the selected time period.
          </Empty.Description>
        </Empty.Header>
      </Empty.Root>
    {/if}
  </div>
</TooltipProvider>
