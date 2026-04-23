<script lang="ts">
  import { Badge } from "$lib/components/ui/badge/";
  import { cn } from "$lib/utils";
  import { eventBadgeConfig } from "$shared/status-config";
  import type { EventType } from "$shared/types";

  interface Props {
    eventType: EventType;
    class?: string;
  }

  type BadgeTone = "danger" | "warning" | "success" | "neutral";

  let { eventType, class: className }: Props = $props();

  const config = $derived(
    eventBadgeConfig[eventType] ?? {
      label: eventType,
      tone: "neutral" as BadgeTone,
    },
  );

  const toneClasses: Record<BadgeTone, string> = {
    danger: "bg-red-500/20 text-red-500 dark:bg-red-700/20 dark:text-red-700",
    warning:
      "bg-amber-600/20 text-amber-600 dark:bg-amber-700/20 dark:text-amber-600",
    success:
      "bg-green-600/20 text-green-600 dark:bg-green-700/20 dark:text-green-500",
    neutral: "bg-muted text-muted-foreground",
  };
</script>

<Badge
  variant="outline"
  class={cn("border-transparent", toneClasses[config.tone], className)}
>
  {config.label}
</Badge>
