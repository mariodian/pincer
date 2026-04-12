<script lang="ts">
  import { cn } from "$lib/utils";
  import { formatDateTime } from "$lib/utils/datetime";
  import {
    statusLabels,
    statusTones,
    type StatusTone,
  } from "$shared/status-config";
  import type { Check } from "$shared/types";

  interface Props {
    check: Check;
    class?: string;
    triggerProps?: Record<string, unknown>;
  }

  let { check, class: className, triggerProps = {} }: Props = $props();

  const toneClasses: Record<StatusTone, string> = {
    success:
      "bg-green-600 hover:bg-green-400 dark:bg-green-800 dark:hover:bg-green-600",
    neutral: "bg-muted hover:bg-muted-foreground/35",
    warning: "bg-amber-500 hover:bg-amber-300",
    danger: "bg-red-500 hover:bg-red-300 dark:bg-red-700 dark:hover:bg-red-500",
  };
</script>

<div
  {...triggerProps}
  class={cn(
    "h-1 w-2",
    "relative rounded-xs transition-colors duration-100",
    toneClasses[statusTones[check.status]],
    className,
  )}
  aria-label={`${statusLabels[check.status] || check.status} at ${formatDateTime(check.checkedAt)}`}
></div>
