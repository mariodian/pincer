<script lang="ts">
  import type { TimeRange } from "$shared/types";

  type TimeRangeOption = { value: TimeRange; label: string };

  interface Props {
    value: TimeRange;
    options: TimeRangeOption[];
    onchange: (value: TimeRange) => void;
  }

  let { value, options, onchange }: Props = $props();
</script>

<div class="flex items-center gap-1 rounded-lg border bg-background p-[3px]">
  {#each options as opt (opt.value)}
    <button
      type="button"
      disabled={value === opt.value}
      class={[
        "rounded-md px-3 py-1 text-xs font-medium transition-colors",
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
