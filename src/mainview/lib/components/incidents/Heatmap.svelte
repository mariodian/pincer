<script lang="ts">
  import type { CheckBucket, TimeRange } from "$shared/types";

  import { ONE_DAY_MS, ONE_HOUR_MS, SEVEN_DAYS_MS } from "$lib/constants";
  import { cn } from "$lib/utils";
  import HeatmapCell from "./HeatmapCell.svelte";

  // Time constants
  const TEN_MINUTES_MS = 10 * 60 * 1000;
  const BUCKETS_PER_HOUR_24H = 6; // 60 / 10 = 6 buckets per hour
  const HOURS_PER_DAY = 24;

  interface Props {
    checkBuckets: CheckBucket[];
    range: TimeRange;
    columns?: number;
    cellSize?: number;
    class?: string;
    anchorDate?: Date;
  }

  let {
    checkBuckets,
    range,
    columns = 24,
    cellSize = 4,
    class: className,
    anchorDate = new Date(),
  }: Props = $props();

  const CELL_SIZE = $derived(`calc(var(--spacing) * ${cellSize})`);

  // Snap anchor to time bucket boundary
  function snapToBoundary(date: Date, msPerBucket: number): Date {
    const snapped = new Date(date);
    if (msPerBucket === TEN_MINUTES_MS) {
      // Snap to 10-minute boundary
      snapped.setMinutes(Math.floor(snapped.getMinutes() / 10) * 10, 0, 0);
    } else {
      // Snap to hour boundary
      snapped.setMinutes(0, 0, 0);
    }
    return snapped;
  }

  // Calculate window start for rolling time windows
  function getWindowStart(
    snappedAnchor: Date,
    windowDuration: number,
    msPerBucket: number,
  ): Date {
    // Start one bucket after (snappedAnchor - windowDuration) to make room for current bucket
    return new Date(snappedAnchor.getTime() - windowDuration + msPerBucket);
  }

  // Build a lookup map from pre-aggregated buckets (aggregates counts across all agents)
  function buildBucketLookupMap(
    buckets: CheckBucket[],
  ): Map<
    number,
    { total: number; ok: number; degraded: number; failed: number }
  > {
    const map = new Map<
      number,
      { total: number; ok: number; degraded: number; failed: number }
    >();

    for (const b of buckets) {
      const existing = map.get(b.bucketStart);
      if (existing) {
        existing.total += b.total;
        existing.ok += b.okCount;
        existing.degraded += b.degradedCount;
        existing.failed += b.failedCount;
      } else {
        map.set(b.bucketStart, {
          total: b.total,
          ok: b.okCount,
          degraded: b.degradedCount,
          failed: b.failedCount,
        });
      }
    }

    return map;
  }

  // Create a single aggregated bucket from lookup map
  function createBucket(
    startMs: number,
    msPerBucket: number,
    bucketMap: Map<
      number,
      { total: number; ok: number; degraded: number; failed: number }
    >,
  ): {
    startTime: Date;
    endTime: Date;
    aggregated: { total: number; ok: number; degraded: number; failed: number };
  } {
    const startTime = new Date(startMs);
    const endTime = new Date(startMs + msPerBucket);
    const aggregated = bucketMap.get(startMs) ?? {
      total: 0,
      ok: 0,
      degraded: 0,
      failed: 0,
    };

    return { startTime, endTime, aggregated };
  }

  // Create time buckets from pre-aggregated CheckBucket data
  // Works for both 24h (10-min buckets) and 7d+ (hourly buckets)
  function createBucketsFromAggregated(
    buckets: CheckBucket[],
    range: TimeRange,
    anchor: Date,
  ): Array<{
    startTime: Date;
    endTime: Date;
    aggregated: { total: number; ok: number; degraded: number; failed: number };
  }> {
    const bucketMap = buildBucketLookupMap(buckets);
    const result: Array<{
      startTime: Date;
      endTime: Date;
      aggregated: {
        total: number;
        ok: number;
        degraded: number;
        failed: number;
      };
    }> = [];

    if (range === "24h") {
      // 24h view: 143 completed + 1 current = 144 cells (24 cols × 6 rows)
      const msPerBucket = TEN_MINUTES_MS;
      const snappedAnchor = snapToBoundary(anchor, msPerBucket);
      const windowStart = getWindowStart(
        snappedAnchor,
        ONE_DAY_MS,
        msPerBucket,
      );

      // 23 full hours (138 buckets) + partial hour (5 buckets) = 143 completed buckets
      for (let h = 0; h < 23; h++) {
        for (let m = 0; m < BUCKETS_PER_HOUR_24H; m++) {
          const startMs =
            windowStart.getTime() + h * ONE_HOUR_MS + m * msPerBucket;
          result.push(createBucket(startMs, msPerBucket, bucketMap));
        }
      }

      // Add partial 24th hour (5 buckets ending at snappedAnchor)
      const h = 23;
      for (let m = 0; m < 5; m++) {
        const startMs =
          windowStart.getTime() + h * ONE_HOUR_MS + m * msPerBucket;
        result.push(createBucket(startMs, msPerBucket, bucketMap));
      }

      // Add current unfinished bucket
      const now = anchor;
      if (now.getTime() > snappedAnchor.getTime()) {
        result.push(
          createBucket(snappedAnchor.getTime(), msPerBucket, bucketMap),
        );
      }
    } else {
      // 7d view: 167 completed + 1 current = 168 cells (24 cols × 7 rows)
      const msPerBucket = ONE_HOUR_MS;
      const snappedAnchor = snapToBoundary(anchor, msPerBucket);
      const windowStart = getWindowStart(
        snappedAnchor,
        SEVEN_DAYS_MS,
        msPerBucket,
      );

      // 6 full days (144 buckets) + partial day (23 buckets) = 167 completed buckets
      for (let d = 0; d < 6; d++) {
        for (let h = 0; h < HOURS_PER_DAY; h++) {
          const startMs =
            windowStart.getTime() + d * ONE_DAY_MS + h * ONE_HOUR_MS;
          result.push(createBucket(startMs, msPerBucket, bucketMap));
        }
      }

      // Add partial 7th day (23 buckets ending at snappedAnchor)
      const d = 6;
      for (let h = 0; h < 23; h++) {
        const startMs =
          windowStart.getTime() + d * ONE_DAY_MS + h * ONE_HOUR_MS;
        result.push(createBucket(startMs, msPerBucket, bucketMap));
      }

      // Add current unfinished bucket
      const now = anchor;
      if (now.getTime() > snappedAnchor.getTime()) {
        result.push(
          createBucket(snappedAnchor.getTime(), msPerBucket, bucketMap),
        );
      }
    }

    return result;
  }

  const timeBuckets = $derived(
    createBucketsFromAggregated(checkBuckets, range, anchorDate),
  );
</script>

<div class="w-full max-w-full min-w-0 overflow-x-auto">
  <div
    class={cn("mb-3 grid gap-1", className)}
    style={`grid-template-columns: repeat(${columns}, minmax(0, ${CELL_SIZE})); width: max-content;`}
  >
    {#each timeBuckets as slot (slot.startTime.getTime())}
      <HeatmapCell {slot} {range} {cellSize} />
    {/each}
  </div>
</div>
