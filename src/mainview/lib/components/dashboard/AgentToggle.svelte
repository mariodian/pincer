<script lang="ts">
  import { cn } from "$lib/utils.js";
  import type { AgentWithColor } from "$shared/rpc";

  interface Props {
    agents: AgentWithColor[];
    selectedIds: number[];
    onToggle: (id: number) => void;
    class?: string;
  }

  let { agents, selectedIds, onToggle, class: className }: Props = $props();

  let allSelected = $derived(
    agents.length > 0 && selectedIds.length === agents.length,
  );

  function handleToggleAll() {
    // If all selected, deselect all (handled by consumer toggling each)
    // If not all selected, select all
    for (const agent of agents) {
      if (!allSelected && !selectedIds.includes(agent.id)) {
        onToggle(agent.id);
      } else if (allSelected && selectedIds.includes(agent.id)) {
        onToggle(agent.id);
      }
    }
  }

  function isActive(id: number): boolean {
    return selectedIds.includes(id);
  }
</script>

<div class={cn("flex flex-wrap items-center gap-1.5", className)}>
  <button
    type="button"
    class={cn(
      "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
      "border shadow-xs",
      allSelected
        ? "bg-primary text-primary-foreground border-primary"
        : "bg-background text-muted-foreground border-border hover:bg-muted",
    )}
    onclick={handleToggleAll}
  >
    All
  </button>
  {#each agents as agent (agent.id)}
    <button
      type="button"
      class={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
        "border shadow-xs",
        isActive(agent.id)
          ? "bg-background text-foreground border-border"
          : "bg-muted/50 text-muted-foreground border-transparent line-through opacity-60",
      )}
      onclick={() => onToggle(agent.id)}
    >
      <span
        class="size-2 rounded-full shrink-0"
        style="background-color: {agent.color};"
      ></span>
      {agent.name}
    </button>
  {/each}
</div>
