<script lang="ts">
  import { cn } from "$lib/utils";
  import type { Check, TimeRange } from "$shared/types";
  import HeatmapCell from "./HeatmapCell.svelte";

  interface Props {
    checks: Check[];
    range: TimeRange;
    columns?: number;
    cellSize?: number;
    class?: string;
    anchorDate?: Date;
  }

  let {
    checks,
    range,
    columns = 24,
    cellSize = 4,
    class: className,
    anchorDate = new Date(),
  }: Props = $props();

  const CELL_SIZE = $derived(`calc(var(--spacing) * ${cellSize})`);

  // Create time buckets from checks
  // D-03: 24h view = 24 cols × 6 rows of 10-min cells = 144 cells
  // D-04: 7d view = 24 cols × 7 rows of hourly cells = 168 cells
  function createTimeBuckets(
    checks: Check[],
    range: TimeRange,
    anchor: Date,
  ): Array<{ startTime: Date; endTime: Date; checks: Check[] }> {
    const buckets: Array<{ startTime: Date; endTime: Date; checks: Check[] }> =
      [];

    // Snap anchor to the appropriate boundary
    const snappedAnchor = new Date(anchor);
    if (range === "24h") {
      snappedAnchor.setMinutes(
        Math.floor(snappedAnchor.getMinutes() / 10) * 10,
        0,
        0,
      );
    } else {
      snappedAnchor.setMinutes(0, 0, 0);
    }

    if (range === "24h") {
      // 24h view: 143 completed + 1 current = 144 cells (24 cols × 6 rows)
      // Rolling window: from (snappedAnchor - 24h + 1 bucket) to snappedAnchor, plus current bucket
      const msPerBucket = 10 * 60 * 1000; // 10 minutes
      // Start one bucket after (snappedAnchor - 24h) to make room for the current bucket
      const windowStart = new Date(
        snappedAnchor.getTime() - 24 * 60 * 60 * 1000 + msPerBucket,
      );

      // 23 full hours (138 buckets) + partial hour (5 buckets) = 143 completed buckets
      for (let h = 0; h < 23; h++) {
        for (let m = 0; m < 6; m++) {
          const startTime = new Date(
            windowStart.getTime() + h * 60 * 60 * 1000 + m * 10 * 60 * 1000,
          );
          const endTime = new Date(startTime.getTime() + msPerBucket);

          const bucketChecks = checks.filter((c) => {
            const checkTime = new Date(c.checkedAt);
            return checkTime >= startTime && checkTime < endTime;
          });

          buckets.push({ startTime, endTime, checks: bucketChecks });
        }
      }

      // Add partial 24th hour (5 buckets ending at snappedAnchor)
      // This gives us 23*6 + 5 = 143 completed buckets, leaving room for the current unfinished bucket
      const h = 23;
      for (let m = 0; m < 5; m++) {
        const startTime = new Date(
          windowStart.getTime() + h * 60 * 60 * 1000 + m * 10 * 60 * 1000,
        );
        const endTime = new Date(startTime.getTime() + msPerBucket);

        const bucketChecks = checks.filter((c) => {
          const checkTime = new Date(c.checkedAt);
          return checkTime >= startTime && checkTime < endTime;
        });

        buckets.push({ startTime, endTime, checks: bucketChecks });
      }
    } else {
      // 7d view: 167 completed + 1 current = 168 cells (24 cols × 7 rows)
      // Rolling window: from (snappedAnchor - 7d + 1 hour) to snappedAnchor, plus current bucket
      const msPerBucket = 60 * 60 * 1000; // 1 hour
      // Start one hour after (snappedAnchor - 7d) to make room for the current bucket
      const windowStart = new Date(
        snappedAnchor.getTime() - 7 * 24 * 60 * 60 * 1000 + msPerBucket,
      );

      // 6 full days (144 buckets) + partial day (23 buckets) = 167 completed buckets
      for (let d = 0; d < 6; d++) {
        for (let h = 0; h < 24; h++) {
          const startTime = new Date(
            windowStart.getTime() +
              d * 24 * 60 * 60 * 1000 +
              h * 60 * 60 * 1000,
          );
          const endTime = new Date(startTime.getTime() + msPerBucket);

          const bucketChecks = checks.filter((c) => {
            const checkTime = new Date(c.checkedAt);
            return checkTime >= startTime && checkTime < endTime;
          });

          buckets.push({ startTime, endTime, checks: bucketChecks });
        }
      }

      // Add partial 7th day (23 buckets ending at snappedAnchor)
      // This gives us 6*24 + 23 = 167 completed buckets, leaving room for the current unfinished bucket
      const d = 6;
      for (let h = 0; h < 23; h++) {
        const startTime = new Date(
          windowStart.getTime() + d * 24 * 60 * 60 * 1000 + h * 60 * 60 * 1000,
        );
        const endTime = new Date(startTime.getTime() + msPerBucket);

        const bucketChecks = checks.filter((c) => {
          const checkTime = new Date(c.checkedAt);
          return checkTime >= startTime && checkTime < endTime;
        });

        buckets.push({ startTime, endTime, checks: bucketChecks });
      }
    }

    // Add current unfinished bucket (the period we're in right now)
    const now = anchor;
    const currentBucketMs = range === "24h" ? 10 * 60 * 1000 : 60 * 60 * 1000;

    // Only add if we're past the snapped boundary (i.e. there's an in-progress period)
    if (now.getTime() > snappedAnchor.getTime()) {
      const currentBucketEnd = new Date(
        snappedAnchor.getTime() + currentBucketMs,
      );
      const currentBucketChecks = checks.filter((c) => {
        const checkTime = new Date(c.checkedAt);
        return checkTime >= snappedAnchor && checkTime < now;
      });
      buckets.push({
        startTime: new Date(snappedAnchor),
        endTime: currentBucketEnd,
        checks: currentBucketChecks,
      });
    }

    return buckets;
  }

  const timeBuckets = $derived(createTimeBuckets(checks, range, anchorDate));
</script>

<div class="overflow-x-auto w-full min-w-0">
  <div
    class={cn("grid gap-1 mb-3", className)}
    style={`grid-template-columns: repeat(${columns}, minmax(0, ${CELL_SIZE})); width: max-content;`}
  >
    {#each timeBuckets as slot (slot.startTime.getTime())}
      <HeatmapCell {slot} {range} {cellSize} />
    {/each}
  </div>
</div>
