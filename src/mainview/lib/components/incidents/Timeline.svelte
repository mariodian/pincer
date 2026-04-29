<script lang="ts">
  import type { CheckBucket, IncidentEvent, TimeRange } from "$shared/types";
  import { SvelteMap, SvelteSet } from "svelte/reactivity";

  import { Heatmap, IncidentCard } from "$lib/components/incidents";
  import * as Empty from "$lib/components/ui/empty";
  import { Icon } from "$lib/components/ui/icon";
  import TooltipProvider from "$lib/components/ui/tooltip/tooltip-provider.svelte";
  import { cn } from "$lib/utils";
  import { formatShortDate } from "$lib/utils/datetime";

  interface Props {
    events: IncidentEvent[];
    checkBuckets: CheckBucket[];
    agents: Array<{
      id: number;
      name: string;
      color: string;
    }>;
    range?: TimeRange;
    class?: string;
  }

  let {
    events,
    checkBuckets,
    agents,
    range = "24h",
    class: className,
  }: Props = $props();

  type IncidentGroup = {
    id: string;
    events: IncidentEvent[];
    linkedIncidentIds: string[];
  };

  const incidents = $derived.by(() => {
    // Group events by incidentId first
    const byId = new SvelteMap<string, IncidentEvent[]>();
    for (const event of events) {
      const existing = byId.get(event.incidentId) || [];
      existing.push(event);
      byId.set(event.incidentId, existing);
    }

    // Build linkedTo map: incidentId -> linkedIncidentId (from "opened" events)
    const linkedTo = new SvelteMap<string, string>();
    for (const event of events) {
      if (event.eventType === "opened" && event.linkedIncidentId) {
        linkedTo.set(event.incidentId, event.linkedIncidentId);
      }
    }

    // Resolve chains: find root incident for each incidentId
    function findRoot(id: string): string {
      const visited = new SvelteSet<string>();
      let current = id;
      while (linkedTo.has(current) && !visited.has(current)) {
        visited.add(current);
        current = linkedTo.get(current)!;
      }
      return current;
    }

    // Merge linked incidents into groups
    const merged = new SvelteMap<string, IncidentGroup>();
    const assigned = new SvelteSet<string>();

    for (const incidentId of byId.keys()) {
      if (assigned.has(incidentId)) continue;

      const root = findRoot(incidentId);
      const groupEvents: IncidentEvent[] = [];
      const linkedIds: string[] = [];

      // Walk the chain from root, following linkedTo in reverse
      // Collect all incidentIds that resolve to this root
      const chain = new SvelteSet<string>();
      for (const id of byId.keys()) {
        if (findRoot(id) === root) {
          chain.add(id);
        }
      }

      for (const id of chain) {
        assigned.add(id);
        const idEvents = byId.get(id) || [];
        groupEvents.push(...idEvents);
        if (id !== root) {
          linkedIds.push(id);
        }
      }

      // Sort events chronologically (oldest first within card)
      groupEvents.sort((a, b) => a.eventAt - b.eventAt);

      merged.set(root, {
        id: root,
        events: groupEvents,
        linkedIncidentIds: linkedIds,
      });
    }

    // Sort groups by most recent event
    return Array.from(merged.values()).sort((a, b) => {
      const aMax = Math.max(...a.events.map((e) => e.eventAt));
      const bMax = Math.max(...b.events.map((e) => e.eventAt));
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

  // Group incidents by day
  const incidentsByDay = $derived.by(() => {
    const grouped = new SvelteMap<string, Array<IncidentGroup>>();
    for (const group of incidents) {
      const maxTime = Math.max(...group.events.map((e) => e.eventAt));
      const day = formatShortDate(maxTime);
      const existing = grouped.get(day) || [];
      existing.push(group);
      grouped.set(day, existing);
    }
    return grouped;
  });

  // Combine all days from incidents (heatmap shows all checks at top)
  const allDays = $derived.by(() => {
    const days = new SvelteSet<string>();
    for (const day of incidentsByDay.keys()) {
      days.add(day);
    }
    // Sort days descending (newest first)
    return Array.from(days).sort((a, b) => {
      // Compare by the most recent incident time for each day
      const getDayTimestamp = (dayStr: string) => {
        const dayIncidents = incidentsByDay.get(dayStr);
        let maxTime = 0;
        if (dayIncidents) {
          for (const group of dayIncidents) {
            for (const evt of group.events) {
              maxTime = Math.max(maxTime, evt.eventAt);
            }
          }
        }
        return maxTime;
      };
      return getDayTimestamp(b) - getDayTimestamp(a);
    });
  });
</script>

<TooltipProvider delayDuration={0} skipDelayDuration={300}>
  <div class={cn("w-full max-w-full min-w-0 space-y-3", className)}>
    <!-- Single heatmap for the entire period (24h or 7d) -->
    <Heatmap {range} {checkBuckets} cellSize={4} />

    {#each allDays as day (day)}
      {@const dayIncidents = incidentsByDay.get(day)}
      <div class="relative">
        <!-- Day header -->
        <div
          class={cn(
            "sticky top-0 z-10 -mx-2 mb-4 px-2 py-2",
            "flex items-center gap-4",
            "bg-content-background border-content-background",
          )}
        >
          <h3 class="text-sm font-medium">{day}</h3>
          <div class="flex-1 border-t"></div>
        </div>

        <!-- Incidents for this day -->
        {#if dayIncidents && dayIncidents.length > 0}
          <div class="space-y-4">
            <h4
              class="text-muted-foreground mb-3 text-xs font-medium uppercase"
            >
              Events
            </h4>
            {#each dayIncidents as group (group.id)}
              {@const firstEvent = group.events[0]}
              {@const agent = getAgent(firstEvent.agentId)}
              {#if agent}
                <IncidentCard
                  events={group.events}
                  agentName={agent.name}
                  agentColor={agent.color}
                />
              {:else}
                <div class="text-muted-foreground text-xs">
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
