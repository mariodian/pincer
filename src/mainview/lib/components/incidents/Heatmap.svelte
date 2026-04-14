<script lang="ts">
  import HeatmapCell from "./HeatmapCell.svelte";
  import type { Check, TimeRange } from "$shared/types";
  import { cn } from "$lib/utils";

  interface Props {
    checks: Check[];
    range: TimeRange;
    columns?: number;
    cellSize?: string;
    class?: string;
  }

  let {
    checks,
    range,
    columns,
    cellSize = "size-4",
    class: className,
  }: Props = $props();

  // Create time buckets from checks
  // D-03: 24h view = 24 hours × 6 (10-min cells) = 144 cells
  // D-04: 7d view = 7 days × 24 hours = 168 hourly cells
  function createTimeBuckets(checks: Check[], range: TimeRange): Array<{ startTime: Date; endTime: Date; checks: Check[] }> {
    const now = new Date();
    const buckets: Array<{ startTime: Date; endTime: Date; checks: Check[] }> = [];

    if (range === "24h") {
      // 24h view: 144 x 10-minute cells
      const msPerBucket = 10 * 60 * 1000; // 10 minutes
      for (let h = 0; h < 24; h++) {
        for (let m = 0; m < 6; m++) {
          const startTime = new Date(now);
          startTime.setHours(h, m * 10, 0, 0);
          const endTime = new Date(startTime.getTime() + msPerBucket);
          
          // Note: uses half-open interval [startTime, endTime) intentionally.
          // Checks at the exact current moment may not be captured (data lag).
          // This is acceptable for historical bucket views.
          const bucketChecks = checks.filter((c) => {
            const checkTime = new Date(c.checkedAt);
            return checkTime >= startTime && checkTime < endTime;
          });
          
          buckets.push({ startTime, endTime, checks: bucketChecks });
        }
      }
    } else {
      // 7d view: 168 x hourly cells
      const msPerBucket = 60 * 60 * 1000; // 1 hour
      for (let d = 0; d < 7; d++) {
        for (let h = 0; h < 24; h++) {
          const startTime = new Date(now);
          startTime.setDate(startTime.getDate() - (6 - d)); // Go back 6 days, then forward
          startTime.setHours(h, 0, 0, 0);
          const endTime = new Date(startTime.getTime() + msPerBucket);
          
          const bucketChecks = checks.filter((c) => {
            const checkTime = new Date(c.checkedAt);
            return checkTime >= startTime && checkTime < endTime;
          });
          
          buckets.push({ startTime, endTime, checks: bucketChecks });
        }
      }
    }

    return buckets;
  }

  const timeBuckets = $derived(createTimeBuckets(checks, range));
</script>

<div
  class={cn(
    "grid gap-1 grid-cols-24",
    className,
  )}
  style={columns ? `grid-template-columns: repeat(${columns}, 1fr);` : ""}
>
  {#each timeBuckets as slot (slot.startTime.getTime())}
    <HeatmapCell {slot} {range} {cellSize} />
  {/each}
</div>
