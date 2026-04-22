<script lang="ts">
  import { IncidentBadge } from "$lib/components/incidents";
  import { Badge } from "$lib/components/ui/badge/";
  import * as Card from "$lib/components/ui/card";
  import { Icon } from "$lib/components/ui/icon";
  import * as Timeline from "$lib/components/ui/timeline";
  import { cn } from "$lib/utils";
  import { formatDateTime } from "$lib/utils/datetime";
  import {
    statusIcons,
    statusLabels,
    statusTones,
    type StatusTone,
  } from "$shared/status-config";
  import type { IncidentEvent } from "$shared/types";
  import { Duration, DurationUnits } from "@layerstack/utils";

  interface Props {
    events: IncidentEvent[];
    linkedIncidentIds?: string[];
    agentName: string;
    agentColor: string;
    class?: string;
  }

  let {
    events,
    linkedIncidentIds = [],
    agentName,
    agentColor,
    class: className,
  }: Props = $props();

  const ICON_SIZE = "size-6";
  const ICON_STATUS_SIZE = "size-4";
  const ICON_STROKE = 2;

  const iconToneClasses: Record<StatusTone, string> = {
    success: "text-green-600 dark:text-green-800",
    neutral: "text-muted-foreground",
    warning: "text-amber-500",
    danger: "text-red-500 dark:text-red-700",
  };

  // Sort events by time (oldest first for display within card)
  const sortedEvents = $derived(
    [...events].sort((a, b) => a.eventAt - b.eventAt),
  );

  // Deduplicate "opened" events: keep only the first one in merged incidents
  const displayEvents = $derived.by(() => {
    let seenOpened = false;
    return sortedEvents.filter((e) => {
      if (e.eventType === "opened") {
        if (seenOpened) return false;
        seenOpened = true;
      }
      return true;
    });
  });

  const openedEvent = $derived(
    displayEvents.find((e) => e.eventType === "opened"),
  );

  const recoveredEvent = $derived(
    displayEvents.find((e) => e.eventType === "recovered"),
  );

  const isOpen = $derived(!recoveredEvent);

  const duration = $derived(() => {
    if (!openedEvent) return null;
    const endTime = recoveredEvent?.eventAt ?? Date.now();
    const diff = endTime - openedEvent.eventAt;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    const duration = new Duration({
      start: new Date(openedEvent.eventAt),
      end: new Date(endTime),
    });

    const minUnits =
      days > 0
        ? DurationUnits.Day
        : hours > 0
          ? DurationUnits.Hour
          : minutes > 0
            ? DurationUnits.Minute
            : DurationUnits.Second;

    return duration.format({
      minUnits: minUnits,
      variant: "short",
    });
  });
</script>

<Card.Root
  class={cn(
    className,
    "gap-4",
    isOpen ? "ring-destructive dark:ring-red-800 ring-2 " : "",
  )}
>
  <Card.Header>
    <Card.Title>
      <div class="flex items-center gap-2">
        <div
          class="size-2 rounded-full"
          style="background-color: {agentColor}"
        ></div>
        <span class="font-medium">{agentName}</span>
        {#if isOpen}
          <Badge variant="secondary">Open</Badge>
        {/if}
        {#if linkedIncidentIds.length > 0}
          <Badge variant="outline" class="text-xs">Linked</Badge>
        {/if}
      </div>
    </Card.Title>
    <Card.Action class="text-muted-foreground text-xs">
      {#if duration()}
        Duration: {duration()}
      {/if}
    </Card.Action>
  </Card.Header>
  <Card.Content>
    <div class="ml-2 space-y-2">
      {#each displayEvents as event, i}
        <Timeline.Root withoutBorder={i === displayEvents.length - 1}>
          <Timeline.Item>
            <Timeline.Icon class="bg-card ring-card">
              {#if event.eventType === "opened"}
                <Icon
                  name="alertCircle"
                  strokeWidth={ICON_STROKE}
                  class={cn(ICON_SIZE, "text-red-500")}
                />
              {:else if event.eventType === "recovered"}
                <Icon
                  name="checkCircle"
                  strokeWidth={ICON_STROKE}
                  class={cn(ICON_SIZE, "text-green-500")}
                />
              {:else if event.eventType === "handoff"}
                <Icon
                  name="arrowLeftRight"
                  strokeWidth={ICON_STROKE}
                  class={cn(ICON_SIZE, "text-amber-500")}
                />
              {:else}
                <Icon
                  name="refresh"
                  strokeWidth={ICON_STROKE}
                  class={cn(ICON_SIZE, "text-yellow-500")}
                />
              {/if}
            </Timeline.Icon>
            <Timeline.Content>
              <div class="mb-2">
                <IncidentBadge eventType={event.eventType} />
                <Timeline.Time
                  >{formatDateTime(event.eventAt, {
                    month: "short",
                    day: "numeric",
                    second: undefined,
                  })}</Timeline.Time
                >
              </div>
              {#if event.eventType === "opened" || event.eventType === "status_changed"}
                <Timeline.Title class="text-sm mt-2">
                  {#if event.eventType === "opened" && event.toStatus}
                    <div class="flex items-center gap-1.5">
                      <Icon
                        name={statusIcons[event.toStatus]}
                        class={cn(
                          ICON_STATUS_SIZE,
                          iconToneClasses[statusTones[event.toStatus]],
                        )}
                      />
                      <span>Started as {statusLabels[event.toStatus]}</span>
                    </div>
                  {/if}

                  {#if event.eventType === "status_changed" && event.fromStatus && event.toStatus}
                    <div class="flex items-center gap-2">
                      <div class="flex items-center gap-1.5">
                        <Icon
                          name={statusIcons[event.fromStatus]}
                          class={cn(
                            ICON_STATUS_SIZE,
                            iconToneClasses[statusTones[event.fromStatus]],
                          )}
                        />
                        <span>
                          {statusLabels[event.fromStatus]}
                        </span>
                      </div>
                      <Icon
                        name="arrowRight"
                        class={cn(ICON_STATUS_SIZE, "text-muted-foreground")}
                      />
                      <div class="flex items-center gap-1.5">
                        <Icon
                          name={statusIcons[event.toStatus]}
                          class={cn(
                            ICON_STATUS_SIZE,
                            iconToneClasses[statusTones[event.toStatus]],
                          )}
                        />
                        <span>
                          {statusLabels[event.toStatus]}
                        </span>
                      </div>
                    </div>
                  {/if}
                </Timeline.Title>
              {/if}

              {#if event.reason}
                <Timeline.Description
                  class="mb-3 text-sm text-muted-foreground"
                >
                  <p>
                    {event.reason}
                  </p>
                </Timeline.Description>
              {/if}
            </Timeline.Content>
          </Timeline.Item>
        </Timeline.Root>
      {/each}
    </div>
  </Card.Content>
</Card.Root>
