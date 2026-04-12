<script lang="ts">
  import { CheckDot, IncidentCard } from "$lib/components/incidents";
  import * as Tooltip from "$lib/components/ui/tooltip";
  import { cn } from "$lib/utils";
  import {
    formatDateTime,
    formatDuration,
    formatShortDate,
  } from "$lib/utils/datetime";
  import { statusLabels } from "$shared/status-config";
  import type { Check, IncidentEvent } from "$shared/types";
  import { Tooltip as TooltipPrimitive } from "bits-ui";

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
  let activeCheck: Check | null = $state(null);

  const checksTooltipTether = TooltipPrimitive.createTether<Check>();

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
    return agents.find((a) => a.id === agentId);
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
</script>

<Tooltip.Root tether={checksTooltipTether} delayDuration={0}>
  <div class={cn("space-y-6", className)}>
    {#each Array.from(incidentsByDay.entries()) as [day, dayIncidents] (day)}
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

        <!-- Raw checks section for this day -->
        {#if checks.length > 0}
          <div class="mb-6">
            <h4
              class="mb-3 text-xs font-medium uppercase text-muted-foreground"
            >
              Raw Checks
            </h4>
            <div class="flex flex-wrap gap-px">
              {#each checksByDay.get(day) || [] as check (check.id)}
                <Tooltip.Trigger tether={checksTooltipTether} payload={check}>
                  {#snippet child({ props })}
                    {@const triggerPropsWithHover = {
                      ...props,
                      onpointerenter: (event: PointerEvent) => {
                        const pointerEnter = (
                          props as {
                            onpointerenter?: (e: PointerEvent) => void;
                          }
                        ).onpointerenter;
                        pointerEnter?.(event);
                        activeCheck = check;
                      },
                    }}
                    <CheckDot {check} triggerProps={triggerPropsWithHover} />
                  {/snippet}
                </Tooltip.Trigger>
              {/each}
            </div>
          </div>
        {/if}

        <!-- Incidents for this day -->
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
            {/if}
          {/each}
        </div>
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

  {#if activeCheck}
    <Tooltip.Content
      side="top"
      align="center"
      sideOffset={8}
      collisionPadding={8}
      class="max-w-55 px-2 py-1 text-xs data-open:animate-none data-closed:animate-none data-[state=delayed-open]:animate-none"
    >
      <div class="flex flex-col">
        <div class="font-medium">
          {statusLabels[activeCheck.status] || activeCheck.status}
        </div>
        <div class="text-muted">
          {formatDateTime(activeCheck.checkedAt)}
        </div>
        {#if activeCheck.responseMs !== null}
          <div class="text-muted">
            Response: {formatDuration(activeCheck.responseMs)}
          </div>
        {/if}
        {#if activeCheck.httpStatus !== null}
          <div class="text-muted">
            HTTP {activeCheck.httpStatus}
          </div>
        {/if}
        {#if activeCheck.errorMessage}
          <div class="max-w-50 truncate text-red-500 dark:text-red-600">
            {activeCheck.errorMessage}
          </div>
        {/if}
      </div>
    </Tooltip.Content>
  {/if}
</Tooltip.Root>
