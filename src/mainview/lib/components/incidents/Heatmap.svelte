<script lang="ts">
  import { cn } from "$lib/utils";
  import * as Tooltip from "$lib/components/ui/tooltip/index.js";
  import type { Check } from "$shared/types";

  interface Props {
    checks: Check[];
    columns?: number;
    cellSize?: string;
    class?: string;
  }

  let {
    checks,
    columns: _columns,
    cellSize = "size-4",
    class: className,
  }: Props = $props();

  // Error intensity calculation per HEAT-05, HEAT-06
  // Formula: (failed + 0.5 * degraded) / total_checks
  // Unknown/offline treated as degraded per D-06
  function calculateIntensity(checks: Check[]): number {
    if (checks.length === 0) return 0;

    let failed = 0;
    let degraded = 0;

    for (const check of checks) {
      if (check.status === "error") {
        failed++;
      } else if (check.status === "degraded" || check.status === "offline") {
        // D-06: unknown/no-result treated as degraded
        // Also treating offline as degraded (D-06 covers "unknown/no-result")
        degraded++;
      }
    }

    return (failed + 0.5 * degraded) / checks.length;
  }

  // Map intensity (0-1) to CSS variable
  function getHeatmapVar(intensity: number): string {
    if (intensity === 0) return "var(--heatmap)";
    if (intensity <= 0.2) return "var(--heatmap-1)";
    if (intensity <= 0.4) return "var(--heatmap-2)";
    if (intensity <= 0.6) return "var(--heatmap-3)";
    if (intensity <= 0.8) return "var(--heatmap-4)";
    return "var(--heatmap-5)";
  }

  const intensity = $derived(calculateIntensity(checks));
  const heatmapColor = $derived(getHeatmapVar(intensity));
</script>

<Tooltip.Root>
  <Tooltip.Trigger>
    {#snippet child({ props })}
      <div
        class={cn("rounded-xs transition-colors duration-100", cellSize, className)}
        style="background-color: {heatmapColor};"
        {...props}
      ></div>
    {/snippet}
  </Tooltip.Trigger>
  <Tooltip.Content>
    {checks.length > 0
      ? `${checks.filter((c) => c.status === "ok").length} ok, ${checks.filter((c) => c.status === "degraded").length} degraded, ${checks.filter((c) => c.status === "error").length} failed`
      : "No checks"}
  </Tooltip.Content>
</Tooltip.Root>
