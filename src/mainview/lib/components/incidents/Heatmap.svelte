<script lang="ts">
  import { cn } from "$lib/utils";
  import { ONE_HOUR_MS, ONE_DAY_MS, SEVEN_DAYS_MS } from "$lib/constants";
  import type { Check, CheckBucket, TimeRange } from "$shared/types";
  import HeatmapCell from "./HeatmapCell.svelte";

  // 24h view: 10-minute buckets
  const TEN_MINUTES_MS = 10 * 60 * 1000;
  const BUCKETS_PER_HOUR_24H = 6; // 60 / 10 = 6 buckets per hour

  interface Props {
    checks: Check[];
    checkBuckets?: CheckBucket[];
    range: TimeRange;
    columns?: number;
    cellSize?: number;
    class?: string;
    anchorDate?: Date;
  }

  let {
    checks,
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

  // Create a single time bucket with filtered checks
  function createBucket(
    startMs: number,
    msPerBucket: number,
    checks: Check[],
  ): { startTime: Date; endTime: Date; checks: Check[] } {
    const startTime = new Date(startMs);
    const endTime = new Date(startMs + msPerBucket);

    const bucketChecks = checks.filter((c) => {
      const checkTime = new Date(c.checkedAt);
      return checkTime >= startTime && checkTime < endTime;
    });

    return { startTime, endTime, checks: bucketChecks };
  }

  // Create time buckets from raw checks (for 24h view with smaller dataset)
  function createTimeBuckets(
    checks: Check[],
    range: TimeRange,
    anchor: Date,
  ): Array<{ startTime: Date; endTime: Date; checks: Check[] }> {
    const buckets: Array<{ startTime: Date; endTime: Date; checks: Check[] }> =
      [];

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
          buckets.push(createBucket(startMs, msPerBucket, checks));
        }
      }

      // Add partial 24th hour (5 buckets ending at snappedAnchor)
      const h = 23;
      for (let m = 0; m < 5; m++) {
        const startMs =
          windowStart.getTime() + h * ONE_HOUR_MS + m * msPerBucket;
        buckets.push(createBucket(startMs, msPerBucket, checks));
      }

      // Add current unfinished bucket
      const now = anchor;
      if (now.getTime() > snappedAnchor.getTime()) {
        const currentBucketEnd = new Date(
          snappedAnchor.getTime() + msPerBucket,
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
    } else {
      // 7d+ view: Use aggregated data path instead
      // This should not be called when checkBuckets is provided
      throw new Error(
        "7d+ views should use createBucketsFromAggregated with pre-aggregated data",
      );
    }

    return buckets;
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

  // Create aggregated bucket for 7d+ views using pre-aggregated data
  function createAggregatedBucket(
    startMs: number,
    msPerBucket: number,
    bucketMap: Map<
      number,
      { total: number; ok: number; degraded: number; failed: number }
    >,
  ): {
    startTime: Date;
    endTime: Date;
    checks: Check[];
    aggregated?: {
      total: number;
      ok: number;
      degraded: number;
      failed: number;
    };
  } {
    const startTime = new Date(startMs);
    const endTime = new Date(startMs + msPerBucket);
    const aggregated = bucketMap.get(startMs);

    // Create a dummy check for color calculation
    const bucketChecks: Check[] = aggregated
      ? [
          {
            id: 0,
            agentId: 0,
            checkedAt: startMs,
            status:
              aggregated.failed > 0
                ? "error"
                : aggregated.degraded > 0
                  ? "degraded"
                  : "ok",
            responseMs: null,
            httpStatus: null,
            errorCode: null,
            errorMessage: null,
          },
        ]
      : [];

    return { startTime, endTime, checks: bucketChecks, aggregated };
  }

  // Create time buckets from pre-aggregated CheckBucket data (for 7d+ views)
  // This is much faster than filtering 118K raw checks (O(n) lookup vs O(n*m) filtering)
  function createBucketsFromAggregated(
    buckets: CheckBucket[],
    _range: TimeRange,
    anchor: Date,
  ): Array<{
    startTime: Date;
    endTime: Date;
    checks: Check[];
    aggregated?: {
      total: number;
      ok: number;
      degraded: number;
      failed: number;
    };
  }> {
    const bucketMap = buildBucketLookupMap(buckets);
    const result: Array<{
      startTime: Date;
      endTime: Date;
      checks: Check[];
      aggregated?: {
        total: number;
        ok: number;
        degraded: number;
        failed: number;
      };
    }> = [];

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
      for (let h = 0; h < 24; h++) {
        const startMs =
          windowStart.getTime() + d * ONE_DAY_MS + h * ONE_HOUR_MS;
        result.push(createAggregatedBucket(startMs, msPerBucket, bucketMap));
      }
    }

    // Add partial 7th day (23 buckets ending at snappedAnchor)
    const d = 6;
    for (let h = 0; h < 23; h++) {
      const startMs = windowStart.getTime() + d * ONE_DAY_MS + h * ONE_HOUR_MS;
      result.push(createAggregatedBucket(startMs, msPerBucket, bucketMap));
    }

    // Add current unfinished bucket
    const now = anchor;
    if (now.getTime() > snappedAnchor.getTime()) {
      result.push(
        createAggregatedBucket(snappedAnchor.getTime(), msPerBucket, bucketMap),
      );
    }

    return result;
  }

  const timeBuckets = $derived(
    checkBuckets && range !== "24h"
      ? createBucketsFromAggregated(checkBuckets, range, anchorDate)
      : createTimeBuckets(checks, range, anchorDate),
  );
</script>

<div class="overflow-x-auto w-full min-w-0 max-w-full">
  <div
    class={cn("grid gap-1 mb-3", className)}
    style={`grid-template-columns: repeat(${columns}, minmax(0, ${CELL_SIZE})); width: max-content;`}
  >
    {#each timeBuckets as slot (slot.startTime.getTime())}
      <HeatmapCell {slot} {range} {cellSize} />
    {/each}
  </div>
</div>
