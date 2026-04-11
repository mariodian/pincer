<script lang="ts">
  import { cn } from "$lib/utils";

  interface Props {
    eventType: "opened" | "status_changed" | "recovered";
    class?: string;
  }

  let { eventType, class: className }: Props = $props();

  const badgeConfig: Record<string, { label: string; classes: string }> = {
    opened: {
      label: "Opened",
      classes: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
    },
    status_changed: {
      label: "Changed",
      classes:
        "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
    },
    recovered: {
      label: "Recovered",
      classes:
        "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
    },
  };

  const config = $derived(
    badgeConfig[eventType] || {
      label: eventType,
      classes: "bg-gray-100 text-gray-700",
    },
  );
</script>

<span
  class={cn(
    "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
    config.classes,
    className,
  )}
>
  {config.label}
</span>
