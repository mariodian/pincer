<script lang="ts">
  import { Badge } from "$lib/components/ui/badge/";
  import { cn } from "$lib/utils";

  interface Props {
    eventType: "opened" | "status_changed" | "recovered";
    class?: string;
  }

  let { eventType, class: className }: Props = $props();

  const badgeConfig: Record<string, { label: string; classes: string }> = {
    opened: {
      label: "Opened",
      classes:
        "bg-red-500/20 dark:bg-red-700/20 text-red-500 dark:text-red-700",
    },
    status_changed: {
      label: "Changed",
      classes: "bg-amber-500/20 text-amber-500",
    },
    recovered: {
      label: "Recovered",
      classes: "bg-green-600/20 text-green-600",
    },
  };

  const config = $derived(
    badgeConfig[eventType] || {
      label: eventType,
      classes: "bg-gray-100 text-gray-700",
    },
  );
</script>

<Badge class={cn(config.classes, className)}>
  {config.label}
</Badge>
