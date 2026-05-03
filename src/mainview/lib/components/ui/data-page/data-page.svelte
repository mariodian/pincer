<script lang="ts">
  import type { TimeRange } from "$shared/types";
  import type { Snippet } from "svelte";

  import { Button } from "$lib/components/ui/button";
  import { ErrorState } from "$lib/components/ui/error-state";
  import { Icon } from "$lib/components/ui/icon";
  import { PageBody, PageHeader } from "$lib/components/ui/page";
  import { TimeRangePicker } from "$lib/components/ui/time-range-picker";

  interface Props {
    title: string;
    description?: string;
    prevPath: string;
    currentPath: string;
    errorTitle: string;
    error: string | null;
    initialLoading: boolean;
    refreshing: boolean;
    showRefreshing: boolean;
    timeRange: TimeRange;
    timeRangeOptions: { value: TimeRange; label: string }[];
    onTimeRangeChange: (range: TimeRange) => void;
    onRefresh?: () => void;
    lastUpdated?: Date;
    onRetry: () => void;
    isEmpty: boolean;
    skeleton: Snippet;
    content: Snippet;
    empty: Snippet;
  }

  let {
    title,
    description,
    prevPath,
    currentPath,
    errorTitle,
    error,
    initialLoading,
    refreshing,
    showRefreshing,
    timeRange,
    timeRangeOptions,
    onTimeRangeChange,
    onRefresh,
    lastUpdated,
    onRetry,
    isEmpty,
    skeleton,
    content,
    empty,
  }: Props = $props();
</script>

<div class="flex h-full flex-col">
  <PageHeader {title} {description} {prevPath} {currentPath}>
    {#snippet actions()}
      <div class="flex items-center gap-3">
        {#if showRefreshing}
          <span class="text-muted-foreground text-xs">updating...</span>
        {/if}
        <TimeRangePicker
          value={timeRange}
          options={timeRangeOptions}
          onchange={onTimeRangeChange}
          onrefresh={onRefresh}
          {refreshing}
          {lastUpdated}
        />
      </div>
    {/snippet}
  </PageHeader>

  <PageBody>
    {#if error}
      <ErrorState
        class="flex-1 py-16"
        title={errorTitle}
        description={error ?? undefined}
      >
        {#snippet icon()}
          <Icon name="alertCircle" class="text-destructive size-5" />
        {/snippet}
        {#snippet cta()}
          <Button
            variant="outline"
            disabled={refreshing}
            onclick={onRetry}
          >
            <Icon name="alertCircle" />
            {refreshing ? "Retrying..." : "Retry"}
          </Button>
        {/snippet}
      </ErrorState>
    {:else if initialLoading}
      {@render skeleton()}
    {:else if isEmpty}
      {@render empty()}
    {:else}
      {@render content()}
    {/if}
  </PageBody>
</div>
