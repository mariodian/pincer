<script lang="ts">
  import type { IncidentEvent, Check } from "$shared/types";
  import { IncidentCard, CheckDot } from "$lib/components/incidents";
  import { cn } from "$lib/utils";

  interface Props {
    events: IncidentEvent[];
    checks: Check[];
    agents: Array<{
      id: number;
      name: string;
      color: string;
    }>;
    class?: string;
  }

  let { events, checks, agents, class: className }: Props = $props();

  // Group events by incident
  const incidents = $derived(() => {
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
    return agents.find((a) => a.id === agentId);
  };

  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year:
        date.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
    });
  };

  // Group incidents by day
  const incidentsByDay = $derived(() => {
    const grouped = new Map<string, Array<[string, IncidentEvent[]]>>();
    for (const [incidentId, incidentEvents] of incidents()) {
      const maxTime = Math.max(...incidentEvents.map((e) => e.eventAt));
      const day = formatDate(maxTime);
      const existing = grouped.get(day) || [];
      existing.push([incidentId, incidentEvents]);
      grouped.set(day, existing);
    }
    return grouped;
  });
</script>

<div class={cn("space-y-6", className)}>
  {#each Array.from(incidentsByDay().entries()) as [day, dayIncidents]}
    <div class="relative">
      <!-- Day header -->
      <div
        class="sticky top-0 z-10 mb-4 flex items-center gap-4 bg-background py-2"
      >
        <h3 class="text-sm font-medium text-muted-foreground">{day}</h3>
        <div class="flex-1 border-t"></div>
      </div>

      <!-- Incidents for this day -->
      <div class="space-y-4">
        {#each dayIncidents as [incidentId, incidentEvents]}
          {@const firstEvent = incidentEvents[0]}
          {@const agent = getAgent(firstEvent.agentId)}
          {#if agent}
            <IncidentCard
              {incidentId}
              events={incidentEvents}
              agentName={agent.name}
              agentColor={agent.color}
            />
          {/if}
        {/each}
      </div>

      <!-- Raw checks section for this day -->
      {#if checks.length > 0}
        <div class="mt-6">
          <h4 class="mb-3 text-xs font-medium uppercase text-muted-foreground">
            Raw Checks
          </h4>
          <div class="flex flex-wrap gap-1">
            {#each checks
              .filter((c) => formatDate(c.checkedAt) === day)
              .sort((a, b) => a.checkedAt - b.checkedAt) as check}
              <CheckDot {check} />
            {/each}
          </div>
        </div>
      {/if}
    </div>
  {/each}

  {#if events.length === 0 && checks.length === 0}
    <div class="flex flex-col items-center justify-center py-16 text-center">
      <p class="text-muted-foreground">
        No incidents or checks found for this period.
      </p>
    </div>
  {/if}
</div>
