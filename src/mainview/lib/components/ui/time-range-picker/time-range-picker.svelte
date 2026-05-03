<script lang="ts">
  import { cn } from "$lib/utils";
  import type { TimeRange } from "$shared/types";
  import Icon from "../icon/icon.svelte";
  import * as Tooltip from "$lib/components/ui/tooltip/index.js";
  import { formatRelativeTime } from "$lib/utils/datetime";

  type TimeRangeOption = { value: TimeRange; label: string };

  interface Props {
    value: TimeRange;
    options: TimeRangeOption[];
    onchange: (value: TimeRange) => void;
    onrefresh?: () => void;
    refreshing?: boolean;
    lastUpdated?: Date;
  }

  let { value, options, onchange, onrefresh, refreshing, lastUpdated }: Props = $props();

  let spinning = $state(false);
  let tooltipOpen = $state(false);
  let now = $state(Date.now());

  let lastUpdatedLabel = $derived(
    lastUpdated ? formatRelativeTime(lastUpdated, now) : null,
  );

  function handleRefreshClick() {
    spinning = true;
    onrefresh?.();
  }

  $effect(() => {
    if (!lastUpdated || !tooltipOpen) {
      return;
    }

    now = Date.now();

    const intervalId = setInterval(() => {
      now = Date.now();
    }, 1000);

    return () => clearInterval(intervalId);
  });

</script>

<div class="flex items-center gap-[3px] rounded-lg border bg-background p-[3px]">
  {#if onrefresh}
  <Tooltip.Provider>
    <Tooltip.Root bind:open={tooltipOpen}>
      <Tooltip.Trigger class="inline-flex items-center justify-center">
        <button
          type="button"
          disabled={refreshing}
          class={[
            "inline-flex items-center justify-center",
            "rounded h-6 w-8",
            "text-xs font-medium tabular-nums transition-colors",
            "text-muted-foreground hover:text-foreground hover:bg-muted",
          ]}
          onclick={handleRefreshClick}
          onanimationiteration={() => { if (!refreshing) spinning = false; }}
        >
          <Icon
            name="refresh"
            animate={spinning}
            class={cn(
              "size-4"
            )}
          />
          <span class="sr-only">Refresh</span>
        </button>
      </Tooltip.Trigger>
      {#if lastUpdatedLabel}
      <Tooltip.Content side="left" sideOffset={4}>
        <p class="whitespace-nowrap font-mono tabular-nums">
          Updated {lastUpdatedLabel}
        </p>
      </Tooltip.Content>
      {/if}
    </Tooltip.Root>
  </Tooltip.Provider>
  {/if}
  {#each options as opt (opt.value)}
    <button
      type="button"
      disabled={value === opt.value}
      class={[
        "rounded h-6 min-w-10 ",
        "text-xs font-medium tabular-nums transition-colors",
        value === opt.value
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:text-foreground hover:bg-muted",
      ]}
      onclick={() => onchange(opt.value)}
    >
        {opt.label}
    </button>
  {/each}
</div>
