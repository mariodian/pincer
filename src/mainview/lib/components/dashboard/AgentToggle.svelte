<script lang="ts">
  import { cn } from "$lib/utils.js";
  import type { AgentWithColor } from "$shared/rpc";
  import Button from "../ui/button/button.svelte";

  interface Props {
    agents: AgentWithColor[];
    selectedIds: number[];
    onToggle: (id: number) => void;
    class?: string;
  }

  const BUTTON_SIZE = "sm";

  let { agents, selectedIds, onToggle, class: className }: Props = $props();

  let allSelected = $derived(
    agents.length > 0 && selectedIds.length === agents.length,
  );

  function handleToggleAll() {
    // Snapshot the derived value so it doesn't change mid-loop
    // when each onToggle() call updates selectedIds reactively
    const shouldDeselect = allSelected;
    for (const agent of agents) {
      if (!shouldDeselect && !selectedIds.includes(agent.id)) {
        onToggle(agent.id);
      } else if (shouldDeselect && selectedIds.includes(agent.id)) {
        onToggle(agent.id);
      }
    }
  }

  function isActive(id: number): boolean {
    return selectedIds.includes(id);
  }
</script>

<div class={cn("flex flex-wrap items-center gap-1.5", className)}>
  <Button
    variant={allSelected ? "default" : "outline"}
    size={BUTTON_SIZE}
    onclick={handleToggleAll}>All</Button
  >
  {#each agents as agent (agent.id)}
    <Button
      class={cn(
        "gap-2",
        isActive(agent.id) ? "" : "line-through border-transparent! opacity-50",
      )}
      variant="outline"
      size={BUTTON_SIZE}
      onclick={() => onToggle(agent.id)}
    >
      <span
        class="size-2 rounded-full shrink-0"
        style="background-color: {agent.color};"
      ></span>
      {agent.name}
    </Button>
  {/each}
</div>
