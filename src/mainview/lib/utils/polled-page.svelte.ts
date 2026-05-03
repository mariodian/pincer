import type { AdvancedSettings, TimeRange } from "$shared/types";
import { SvelteDate } from "svelte/reactivity";

import { MIN_POLLING_INTERVAL_MS } from "$lib/constants";
import {
  getMainRPC,
  offAgentSync,
  onAgentSync,
  whenReady,
  type MainRPCRequests,
} from "$lib/services/mainRPC";
import { createDebouncedVisibility } from "./debounced-visibility.svelte";
import { createFetchState } from "./fetch-state.svelte";

interface PolledPageOptions<T> {
  defaultRange: TimeRange;
  fetch: (rpc: MainRPCRequests, range: TimeRange) => Promise<T>;
  onData?: (data: T) => void;
}

export function createPolledPage<T>(options: PolledPageOptions<T>) {
  const anchorDate = new SvelteDate();
  let timeRange = $state<TimeRange>(options.defaultRange);
  let data = $state<T | null>(null);
  let pollingIntervalMs = $state<number | null>(null);

  const fetchState = createFetchState();
  const refreshingIndicator = createDebouncedVisibility(
    () => fetchState.refreshing && !fetchState.initialLoading,
    1000,
  );

  async function doFetch(range: TimeRange, silent: boolean = false) {
    const result = await fetchState.run(
      async () => {
        await whenReady();
        const rpc = getMainRPC();

        const [pageData, advancedSettings] = (await Promise.all([
          options.fetch(rpc.request, range),
          rpc.request.getAdvancedSettings({}),
        ])) as [T, AdvancedSettings];

        pollingIntervalMs = advancedSettings.pollingInterval;
        anchorDate.setTime(Date.now());
        return pageData;
      },
      { silent },
    );

    if (result !== undefined) {
      data = result;
      options.onData?.(result);
    }
  }

  function handleTimeRangeChange(range: TimeRange) {
    if (range === timeRange) return;
    fetchState.clearError();
    fetchState.beginInitialLoading();
    timeRange = range;
  }

  $effect(() => {
    doFetch(timeRange, true);
  });

  $effect(() => {
    const key = onAgentSync(() => doFetch(timeRange, true));
    return () => offAgentSync(key);
  });

  return {
    get timeRange() {
      return timeRange;
    },
    get data() {
      return data;
    },
    get anchorDate() {
      return anchorDate;
    },
    get error() {
      return fetchState.error;
    },
    get initialLoading() {
      return fetchState.initialLoading;
    },
    get refreshing() {
      return fetchState.refreshing;
    },
    get showRefreshing() {
      return refreshingIndicator.visible;
    },
    get shouldShowLastUpdated() {
      return (
        pollingIntervalMs !== null &&
        pollingIntervalMs >= MIN_POLLING_INTERVAL_MS
      );
    },
    handleTimeRangeChange,
    refresh: () => doFetch(timeRange, true),
    retry: () => doFetch(timeRange, false),
  };
}
