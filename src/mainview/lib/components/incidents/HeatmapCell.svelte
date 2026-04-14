<script lang="ts">
  import { cn } from "$lib/utils";
  import * as Tooltip from "$lib/components/ui/tooltip";
  import type { Check, TimeRange } from "$shared/types";

  interface TimeSlot {
    startTime: Date;
    endTime: Date;
    checks: Check[];
  }

  interface Props {
    slot: TimeSlot;
    range: TimeRange;
    cellSize?: string;
    class?: string;
  }

  let { slot, range, cellSize = "size-4", class: className }: Props = $props();

  // Calculate intensity from checks
  function calculateIntensity(checks: Check[]): number {
    if (checks.length === 0) return 0;
    let failed = 0;
    let degraded = 0;
    for (const check of checks) {
      if (check.status === "error") failed++;
      // Note: offline is treated as degraded per project convention (see HEAT-07 pattern).
      // This is intentional as offline indicates reduced monitoring capability.
      else if (check.status === "degraded" || check.status === "offline")
        degraded++;
    }
    return (failed + 0.5 * degraded) / checks.length;
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

  // Get status counts
  function getStatusCounts(checks: Check[]) {
    return {
      total: checks.length,
      ok: checks.filter((c) => c.status === "ok").length,
      degraded: checks.filter(
        (c) => c.status === "degraded" || c.status === "offline",
      ).length,
      failed: checks.filter((c) => c.status === "error").length,
    };
  }

  const isEmpty = $derived(slot.checks.length === 0);
  const intensity = $derived(calculateIntensity(slot.checks));
  const heatmapColor = $derived(getHeatmapVar(intensity, isEmpty));
  const timePeriod = $derived(formatTimePeriod(slot, range));
  const counts = $derived(getStatusCounts(slot.checks));
</script>

<Tooltip.Root disableHoverableContent>
  <Tooltip.Trigger>
    {#snippet child({ props })}
      <div
        class={cn(
          "rounded-xs transition-colors duration-100",
          cellSize,
          className,
        )}
        style="background-color: {heatmapColor};"
        {...props}
      ></div>
    {/snippet}
  </Tooltip.Trigger>
  <Tooltip.Content class="flex flex-col gap-0.5">
    <div class="text-xs font-medium">{timePeriod}</div>
    {#if counts.total > 0}
      <div class="text-xs text-muted-foreground">
        {counts.total} checks | {counts.ok} ok | {counts.degraded} degraded | {counts.failed}
        failed
      </div>
    {:else}
      <div class="text-xs text-muted-foreground">No checks</div>
    {/if}
  </Tooltip.Content>
</Tooltip.Root>
