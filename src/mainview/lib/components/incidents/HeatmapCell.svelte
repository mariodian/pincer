<script lang="ts">
  import * as Tooltip from "$lib/components/ui/tooltip";
  import { cn } from "$lib/utils";
  import type { TimeRange } from "$shared/types";

  interface TimeSlot {
    startTime: Date;
    endTime: Date;
    aggregated: {
      total: number;
      ok: number;
      degraded: number;
      failed: number;
    };
  }

  interface Props {
    slot: TimeSlot;
    range: TimeRange;
    cellSize?: number;
    class?: string;
  }

  let { slot, range, cellSize = 4, class: className }: Props = $props();

  const CELL_SIZE = $derived(`calc(var(--spacing) * ${cellSize})`);

  // Calculate intensity from aggregated counts
  function calculateIntensity(aggregated: TimeSlot["aggregated"]): number {
    if (aggregated.total === 0) return 0;
    const failed = aggregated.failed;
    const degraded = aggregated.degraded;
    return (failed + 0.5 * degraded) / aggregated.total;
  }

  // Map intensity to CSS variable
  function getHeatmapVar(intensity: number, isEmpty: boolean): string {
    if (isEmpty) return "var(--heatmap-empty)"; // No checks performed — muted/neutral
    if (intensity === 0) return "var(--heatmap)"; // All checks passed
    if (intensity <= 0.2) return "var(--heatmap-1)";
    if (intensity <= 0.4) return "var(--heatmap-2)";
    if (intensity <= 0.6) return "var(--heatmap-3)";
    if (intensity <= 0.8) return "var(--heatmap-4)";
    return "var(--heatmap-5)";
  }

  // Format time period for tooltip title (D-01)
  function formatTimePeriod(slot: TimeSlot, range: TimeRange): string {
    const { startTime, endTime } = slot;
    const formatTime = (d: Date) =>
      d.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
    const formatDate = (d: Date) =>
      d.toLocaleDateString([], { month: "short", day: "numeric" });

    if (range === "24h") {
      // 24h format: always show date since window spans two days
      // "Apr 13 22:00 - 22:10"
      return `${formatDate(startTime)} ${formatTime(startTime)} - ${formatTime(endTime)}`;
    } else {
      // 7d format: "Mon Apr 14 14:00 - 15:00"
      const dayName = startTime.toLocaleDateString([], {
        weekday: "short",
        month: "short",
        day: "numeric",
      });
      return `${dayName} ${formatTime(startTime)} - ${formatTime(endTime)}`;
    }
  }

  const counts = $derived(slot.aggregated);
  const isEmpty = $derived(counts.total === 0);
  const intensity = $derived(calculateIntensity(counts));
  const heatmapColor = $derived(getHeatmapVar(intensity, isEmpty));
  const timePeriod = $derived(formatTimePeriod(slot, range));
</script>

<Tooltip.Root disableHoverableContent>
  <Tooltip.Trigger>
    {#snippet child({ props })}
      <div
        class={cn(
          "block shrink-0 rounded-xs transition-colors duration-100",
          className,
        )}
        style={`background-color: ${heatmapColor}; width: ${CELL_SIZE}; min-width: ${CELL_SIZE}; max-width: ${CELL_SIZE}; height: ${CELL_SIZE}; min-height: ${CELL_SIZE}; max-height: ${CELL_SIZE}; box-sizing: border-box;`}
        {...props}
      ></div>
    {/snippet}
  </Tooltip.Trigger>
  <Tooltip.Content class="flex flex-col items-start gap-1">
    <div class="text-xs font-bold">{timePeriod}</div>
    <div class="text-muted w-full">
      {#if counts.total > 0}
        <p class="font-medium">
          {counts.total} checks
        </p>
        <p>
          <span class="font-medium w-20">Ok:</span>
          {counts.ok}
        </p>
        <p>
          <span class="font-medium w-20">Degraded:</span>
          {counts.degraded}
        </p>
        <p>
          <span class="font-medium w-20">Failed:</span>
          {counts.failed}
        </p>
      {:else}
        <p>No checks</p>
      {/if}
    </div>
  </Tooltip.Content>
</Tooltip.Root>
