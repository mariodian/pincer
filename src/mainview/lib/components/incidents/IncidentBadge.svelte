<script lang="ts">
  import { Badge } from "$lib/components/ui/badge/";
  import { cn } from "$lib/utils";
  import { eventBadgeConfig } from "$shared/status-config";
  import type { EventType } from "$shared/types";

  interface Props {
    eventType: EventType;
    class?: string;
  }

  let { eventType, class: className }: Props = $props();

  const config = $derived(
    eventBadgeConfig[eventType] ?? {
      label: eventType,
      classes: "bg-gray-100 text-gray-700",
    },
  );
</script>

<Badge class={cn(config.classes, className)}>
  {config.label}
</Badge>
