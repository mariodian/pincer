<script lang="ts">
  import { Button } from "$lib/components/ui/button/index.js";
  import * as Empty from "$lib/components/ui/empty/index.js";
  import { Icon } from "$lib/components/ui/icon";
  import * as Item from "$lib/components/ui/item/index.js";
  import { PageBody, PageHeader } from "$lib/components/ui/page";
  import { Skeleton } from "$lib/components/ui/skeleton/index.js";
  import { getMainRPC, offAgentSync, onAgentSync } from "$lib/services/mainRPC";
  import { readCachedAgents, removeCachedAgent } from "$lib/utils/storage";
  import {
    createAgentSyncSignature,
    sortAgentsByStatus,
  } from "$shared/agent-helpers";
  import type { AgentStatus, Status } from "$shared/types";
  import { onMount } from "svelte";

  interface Props {
    onNavigate: (path: string) => void;
    prevPath?: string;
    currentPath?: string;
  }

  let { onNavigate, prevPath = "/", currentPath = "/agents" }: Props = $props();

  let agents = $state<AgentStatus[]>([]);
  let loading = $state(true);
  let deletingId = $state<number | null>(null);
  let confirmDeleteId = $state<number | null>(null);
  let lastListSignature = "";

  /** Load agents from localStorage cache, enforcing offline status for disabled agents. */
  function loadFromCache() {
    const cached = readCachedAgents();
    if (cached) {
      const withForcedStatus = cached.map((a) =>
        a.enabled === false ? { ...a, status: "offline" as const } : a,
      );
      const sorted = sortAgentsByStatus(withForcedStatus);
      const nextSignature = createAgentSyncSignature(sorted);

      // Avoid no-op list rerenders while still allowing every backend sync through.
      if (nextSignature === lastListSignature) {
        return;
      }

      lastListSignature = nextSignature;
      agents = sorted;
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
    const key = onAgentSync(handleSync);
    return () => offAgentSync(key);
  });

  function getStatusClass(status: Status): string {
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

  function getStatusLabel(status: Status): string {
    return status.charAt(0).toUpperCase() + status.slice(1);
  }

  function getTypeName(type: string): string {
    switch (type) {
      case "custom":
        return "Custom";
      case "openclaw":
        return "OpenClaw";
      case "opencrabs":
        return "OpenCrabs";
      default:
        return type;
    }
  }

  function stripProtocol(url: string): string {
    return url.replace(/^https?:\/\//, "");
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
  <PageHeader
    title="Agents"
    description="Manage your monitored services"
    {prevPath}
    {currentPath}
  >
    {#snippet actions()}
      {#if agents.length > 0}
        <Button onclick={() => onNavigate("/agents/add")}>
          <Icon name="add" />
          Add Agent
        </Button>
      {/if}
    {/snippet}
  </PageHeader>

  <PageBody>
    {#if loading}
      <div class="flex flex-col gap-3">
        {#each [1, 2, 3] as _}
          <div
            class="flex items-center gap-4 p-4 rounded-lg border border-border/50 bg-card"
          >
            <Skeleton class="size-3 rounded-full" />
            <div class="flex-1 space-y-2">
              <Skeleton class="h-4 w-44" />
              <Skeleton class="h-3 w-24" />
            </div>
            <div class="flex gap-1">
              <Skeleton class="size-8 rounded-md" />
              <Skeleton class="size-8 rounded-md" />
            </div>
          </div>
        {/each}
      </div>
    {:else if agents.length > 0}
      <div class="grid grid-cols-1 xl:grid-cols-2 gap-3 overflow-x-hidden">
        {#each agents as agent (agent.id)}
          <div class="relative overflow-x-hidden">
            <!-- Delete Confirmation -->
            <div
              class={[
                "absolute w-full",
                confirmDeleteId === agent.id
                  ? "right-0 duration-300"
                  : "-right-200 duration-300 opacity-0",
              ]}
            >
              <Item.Root
                variant="outline"
                class={[
                  "group",
                  "min-h-18 h-full w-full",
                  "border-red-700/80 bg-red-700/80",
                  "dark:border-destructive/60 dark:bg-destructive/50",
                ]}
              >
                <Item.Content>
                  <span
                    class={[
                      "text-sm font-medium",
                      "text-primary-foreground dark:text-primary",
                    ]}
                  >
                    Delete {agent.name}? This can't be undone.
                  </span>
                </Item.Content>
                <Item.Actions>
                  <Button
                    variant="default"
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
                </Item.Actions>
              </Item.Root>
            </div>

            <!-- Agent Item -->
            <div
              class={[
                "relative w-full",
                confirmDeleteId === agent.id
                  ? "-left-200 duration-300 opacity-0"
                  : "left-0 duration-300",
              ]}
            >
              <Item.Root
                variant="outline"
                class={["group", "bg-card", "min-h-18 h-full w-full"]}
              >
                <Item.Media class="min-h-9">
                  <span
                    class={[
                      "shrink-0 size-3 rounded-full transition-all",
                      getStatusClass(agent.status),
                    ]}
                    title={getStatusLabel(agent.status)}
                  ></span>
                </Item.Media>

                <Item.Content>
                  <div class="flex items-center gap-2">
                    <Item.Title>{agent.name}</Item.Title>
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
                  <Item.Description class="text-xs"
                    >{stripProtocol(agent.url)}:{agent.port}</Item.Description
                  >
                </Item.Content>

                <Item.Actions>
                  <div
                    class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onclick={() => onNavigate(`/agents/${agent.id}`)}
                      title="Edit agent"
                    >
                      <Icon name="edit" />
                      <span class="sr-only">Edit</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onclick={() => (confirmDeleteId = agent.id)}
                      disabled={confirmDeleteId !== null ||
                        deletingId === agent.id}
                      title="Delete agent"
                      class="hover:text-destructive hover:bg-destructive/10"
                    >
                      <Icon name="delete" />
                      <span class="sr-only">Delete</span>
                    </Button>
                  </div>
                </Item.Actions>
              </Item.Root>
            </div>
          </div>
        {/each}
      </div>
    {:else}
      <Empty.Root class="border border-dashed">
        <Empty.Header>
          <Empty.Media variant="icon">
            <Icon name="agents" class="text-muted-foreground" />
          </Empty.Media>
          <Empty.Title>No agents yet</Empty.Title>
          <Empty.Description>
            You haven't created any agents yet. Add your first agent to start
            monitoring services.
          </Empty.Description>
        </Empty.Header>
        <Empty.Content>
          <div class="flex gap-2">
            <Button onclick={() => onNavigate("/agents/add")}
              >Create Agent</Button
            >
          </div>
        </Empty.Content>
      </Empty.Root>
    {/if}
  </PageBody>
</div>
