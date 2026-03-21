<script lang="ts">
  import { onMount } from "svelte";
  import { Button } from "$lib/components/ui/button/index.js";
  import { Skeleton } from "$lib/components/ui/skeleton/index.js";
  import { getMainRPC, onAgentSync, offAgentSync } from "$lib/services/mainRPC";
  import { readCachedAgents, removeCachedAgent } from "$lib/utils/storage";
  import type { AgentStatus } from "$shared/types";
  import {
    Add01Icon,
    Delete01Icon,
    Edit01Icon,
  } from "@hugeicons/core-free-icons";
  import { HugeiconsIcon } from "@hugeicons/svelte";

  interface Props {
    onNavigate: (path: string) => void;
  }

  let { onNavigate }: Props = $props();

  let agents = $state<AgentStatus[]>([]);
  let loading = $state(true);
  let deletingId = $state<number | null>(null);
  let confirmDeleteId = $state<number | null>(null);

  /** Load agents from localStorage cache. */
  function loadFromCache() {
    const cached = readCachedAgents();
    if (cached) {
      agents = cached;
    }
  }

  /** Handle push sync from backend. */
  function handleSync() {
    loadFromCache();
  }

  onMount(() => {
    // Read from cache immediately — no RPC call needed
    loadFromCache();
    loading = false;

    // Subscribe to backend sync pushes
    onAgentSync(handleSync);
    return () => offAgentSync(handleSync);
  });

  function getStatusClass(status: string): string {
    switch (status) {
      case "ok":
        return "bg-green-500 dark:bg-green-400 shadow-[0_0_6px_var(--color-green-500)]";
      case "error":
        return "bg-orange-400 dark:bg-orange-300 animate-pulse";
      case "offline":
      default:
        return "bg-muted-foreground/30";
    }
  }

  function getStatusLabel(status: string): string {
    return status.charAt(0).toUpperCase() + status.slice(1);
  }

  function getTypeName(type: string): string {
    switch (type) {
      case "generic":
        return "Generic";
      case "openclaw":
        return "OpenClaw";
      case "opencrabs":
        return "OpenCrabs";
      default:
        return type;
    }
  }

  async function handleDelete(agent: AgentStatus) {
    if (deletingId !== null) return;
    deletingId = agent.id;

    try {
      const rpc = getMainRPC();
      await rpc.request.deleteAgent(agent.id);
      confirmDeleteId = null;
      removeCachedAgent(agent.id);
      loadFromCache();
    } catch (error) {
      console.error("Failed to delete agent:", error);
    } finally {
      deletingId = null;
    }
  }
</script>

<div class="flex flex-col h-full">
  <div class="flex items-center justify-between mb-6">
    <div>
      <h1 class="text-2xl font-semibold tracking-tight">Agents</h1>
      <p class="text-sm text-muted-foreground mt-1">
        Manage your monitored services
      </p>
    </div>
    <Button onclick={() => onNavigate("/agents/add")}>
      <HugeiconsIcon icon={Add01Icon} strokeWidth={2} />
      Add Agent
    </Button>
  </div>

  {#if loading}
    <div class="flex flex-col gap-3">
      {#each [1, 2, 3] as _}
        <div
          class="flex items-center gap-4 p-4 rounded-lg border border-border/50 bg-card"
        >
          <Skeleton class="size-3 rounded-full" />
          <div class="flex-1 space-y-2">
            <Skeleton class="h-4 w-32" />
            <Skeleton class="h-3 w-48" />
          </div>
          <div class="flex gap-1">
            <Skeleton class="size-8 rounded-md" />
            <Skeleton class="size-8 rounded-md" />
          </div>
        </div>
      {/each}
    </div>
  {:else if agents.length === 0}
    <div
      class="flex flex-col items-center justify-center flex-1 text-center py-16"
    >
      <div class="rounded-full bg-muted p-4 mb-4">
        <HugeiconsIcon
          icon={Add01Icon}
          class="size-6 text-muted-foreground"
          strokeWidth={2}
        />
      </div>
      <h3 class="text-lg font-medium mb-1">No agents yet</h3>
      <p class="text-sm text-muted-foreground mb-4 max-w-sm">
        Add your first agent to start monitoring services.
      </p>
      <Button onclick={() => onNavigate("/agents/add")}>
        <HugeiconsIcon icon={Add01Icon} strokeWidth={2} />
        Add Agent
      </Button>
    </div>
  {:else}
    <div class="flex flex-col gap-2">
      {#each agents as agent (agent.id)}
        <div
          class={[
            "group flex items-center gap-4 p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors min-h-18",
            confirmDeleteId === agent.id
              ? "border-destructive"
              : "border-border/50",
          ]}
        >
          {#if confirmDeleteId === agent.id}
            <span class="flex-1 text-sm text-destructive font-medium">
              Delete agent {agent.name}? This can't be undone.
            </span>
            <div class="flex gap-1">
              <Button
                variant="destructive"
                size="sm"
                onclick={() => handleDelete(agent)}
                disabled={deletingId === agent.id}
              >
                Yes, delete
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onclick={() => (confirmDeleteId = null)}
              >
                Cancel
              </Button>
            </div>
          {:else}
            <span
              class={[
                "shrink-0 size-3 rounded-full transition-all",
                getStatusClass(agent.status),
              ]}
              title={getStatusLabel(agent.status)}
            ></span>

            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <span class="font-medium text-sm truncate">{agent.name}</span>
                <span
                  class="text-[11px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium"
                >
                  {getTypeName(agent.type)}
                </span>
                {#if !agent.enabled}
                  <span
                    class="text-[11px] px-1.5 py-0.5 rounded bg-destructive/10 text-destructive font-medium"
                  >
                    Disabled
                  </span>
                {/if}
              </div>
              <span class="text-xs text-muted-foreground truncate block mt-0.5">
                {agent.url}:{agent.port}
              </span>
            </div>

            <div
              class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Button
                variant="ghost"
                size="icon-sm"
                onclick={() => onNavigate(`/agents/${agent.id}`)}
                title="Edit agent"
              >
                <HugeiconsIcon icon={Edit01Icon} strokeWidth={2} />
                <span class="sr-only">Edit</span>
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onclick={() => (confirmDeleteId = agent.id)}
                disabled={confirmDeleteId !== null || deletingId === agent.id}
                title="Delete agent"
                class="hover:text-destructive hover:bg-destructive/10"
              >
                <HugeiconsIcon icon={Delete01Icon} strokeWidth={2} />
                <span class="sr-only">Delete</span>
              </Button>
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>
