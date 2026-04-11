<script lang="ts">
  import { IncidentBadge } from "$lib/components/incidents";
  import { Icon } from "$lib/components/ui/icon";
  import { cn } from "$lib/utils";
  import type { CheckStatus, IncidentEvent } from "$shared/types";

  interface Props {
    incidentId: string;
    events: IncidentEvent[];
    agentName: string;
    agentColor: string;
    class?: string;
  }

  let { events, agentName, agentColor, class: className }: Props = $props();

  // Sort events by time (oldest first for display)
  const sortedEvents = $derived(
    [...events].sort((a, b) => a.eventAt - b.eventAt),
  );

  const openedEvent = $derived(
    sortedEvents.find((e) => e.eventType === "opened"),
  );

  const recoveredEvent = $derived(
    sortedEvents.find((e) => e.eventType === "recovered"),
  );

  const isOpen = $derived(!recoveredEvent);

  const duration = $derived(() => {
    if (!openedEvent) return null;
    const endTime = recoveredEvent?.eventAt ?? Date.now();
    const diff = endTime - openedEvent.eventAt;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    return `${minutes}m`;
  });

  const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const statusIcons: Record<CheckStatus, string> = {
    ok: "checkCircle",
    offline: "wifiOff",
    error: "alertCircle",
    degraded: "alertTriangle",
  };

  const statusColors: Record<CheckStatus, string> = {
    ok: "text-green-500",
    offline: "text-red-500",
    error: "text-orange-500",
    degraded: "text-yellow-500",
  };

  const statusLabels: Record<CheckStatus, string> = {
    ok: "OK",
    offline: "Offline",
    error: "Error",
    degraded: "Degraded",
  };
</script>

<div
  class={cn(
    "rounded-lg border bg-card p-4 transition-all",
    isOpen &&
      "border-red-200 bg-red-50/30 dark:border-red-900/30 dark:bg-red-900/10",
    className,
  )}
>
  <!-- Header -->
  <div class="flex items-start justify-between">
    <div class="flex items-center gap-2">
      <div
        class="h-2 w-2 rounded-full"
        style="background-color: {agentColor}"
      ></div>
      <span class="font-medium">{agentName}</span>
      {#if isOpen}
        <span
          class="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300"
        >
          Open
        </span>
      {/if}
    </div>
    <div class="text-sm text-muted-foreground">
      {#if duration()}
        Duration: {duration()}
      {/if}
    </div>
  </div>

  <!-- Events Timeline -->
  <div class="mt-4 space-y-3">
    {#each sortedEvents as event, i}
      <div class="flex items-start gap-3">
        <!-- Timeline line -->
        <div class="relative flex flex-col items-center">
          <div
            class={cn(
              "flex h-6 w-6 items-center justify-center rounded-full border-2 bg-background",
              event.eventType === "opened" && "border-red-500",
              event.eventType === "recovered" && "border-green-500",
              event.eventType === "status_changed" && "border-yellow-500",
            )}
          >
            {#if event.eventType === "opened"}
              <Icon name="alertCircle" class="h-3 w-3 text-red-500" />
            {:else if event.eventType === "recovered"}
              <Icon name="checkCircle" class="h-3 w-3 text-green-500" />
            {:else}
              <Icon name="refresh" class="h-3 w-3 text-yellow-500" />
            {/if}
          </div>
          {#if i < sortedEvents.length - 1}
            <div class="mt-1 h-full min-h-6 w-px bg-border"></div>
          {/if}
        </div>

        <!-- Event details -->
        <div class="flex-1 pb-3">
          <div class="flex items-center gap-2">
            <IncidentBadge eventType={event.eventType} />
            <span class="text-sm text-muted-foreground">
              {formatTime(event.eventAt)}
            </span>
          </div>

          {#if event.eventType === "opened" && event.toStatus}
            <div class="mt-1 flex items-center gap-1 text-sm">
              <Icon
                name={statusIcons[event.toStatus]}
                class={cn("h-4 w-4", statusColors[event.toStatus])}
              />
              <span>Started as {statusLabels[event.toStatus]}</span>
            </div>
          {/if}

          {#if event.eventType === "status_changed" && event.fromStatus && event.toStatus}
            <div class="mt-1 flex items-center gap-2 text-sm">
              <span class="flex items-center gap-1">
                <Icon
                  name={statusIcons[event.fromStatus]}
                  class={cn("h-4 w-4", statusColors[event.fromStatus])}
                />
                {statusLabels[event.fromStatus]}
              </span>
              <Icon name="arrowRight" class="h-3 w-3 text-muted-foreground" />
              <span class="flex items-center gap-1">
                <Icon
                  name={statusIcons[event.toStatus]}
                  class={cn("h-4 w-4", statusColors[event.toStatus])}
                />
                {statusLabels[event.toStatus]}
              </span>
            </div>
          {/if}

          {#if event.reason}
            <p class="mt-1 text-sm text-muted-foreground">{event.reason}</p>
          {/if}
        </div>
      </div>
    {/each}
  </div>
</div>
