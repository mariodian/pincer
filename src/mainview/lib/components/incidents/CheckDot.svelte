<script lang="ts">
  import { cn } from "$lib/utils";
  import { formatDateTime } from "$lib/utils/datetime";
  import { checkDotColors, statusLabels } from "$shared/status-config";
  import type { Check } from "$shared/types";

  interface Props {
    check: Check;
    class?: string;
    triggerProps?: Record<string, unknown>;
  }

  let { check, class: className, triggerProps = {} }: Props = $props();
</script>

<div
  {...triggerProps}
  class={cn(
    "h-1 w-2",
    "relative rounded-xs transition-colors duration-100",
    checkDotColors[check.status] || "bg-gray-400",
    className,
  )}
  aria-label={`${statusLabels[check.status] || check.status} at ${formatDateTime(check.checkedAt)}`}
></div>
