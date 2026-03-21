<script lang="ts">
  import { Electroview } from "electrobun/view";
  import type { AgentStatus } from "$shared/types";
  import { sortAgentsByStatus } from "$shared/agent-helpers";
  import { onAgentSync, offAgentSync } from "$lib/services/mainRPC";
  import { readCachedAgents, syncAgentsToCache } from "$lib/utils/storage";
  import "./tray-popover.css";
  import Button from "./ui/Button.svelte";

  type AgentRPCType = {
    bun: {
      requests: {
        getAgents: {
          params: Record<string, never>;
          response: AgentStatus[];
        };
        checkAllAgentsStatus: {
          params: Record<string, never>;
          response: AgentStatus[];
        };
        requestRefresh: {
          params: Record<string, never>;
          response: boolean;
        };
        openMainWindow: {
          params: { page: string };
          response: boolean;
        };
        quit: {
          params: Record<string, never>;
          response: boolean;
        };
      };
      messages: Record<string, never>;
    };
    webview: {
      requests: Record<string, never>;
      messages: {
        syncAgents: {
          params: AgentStatus[];
          response: void;
        };
      };
    };
  };

  const rpc = Electroview.defineRPC<AgentRPCType>({
    handlers: {
      requests: {},
      messages: {
        syncAgents: ((data: AgentStatus[]) => {
          if (typeof localStorage !== "undefined") {
            syncAgentsToCache(data);
          }
          agents = sortAgentsByStatus(data);
        }) as any,
      },
    },
  });

  new Electroview({
    rpc,
  });

  let agents: AgentStatus[] = $state([]);
  let loading = $state(true);
  let isRefreshing = $state(false);
  let scrollContainer: HTMLDivElement | null = $state(null);
  let showHeaderShadow = $state(false);
  let showFooterShadow = $state(false);

  function updateScrollShadows() {
    if (!scrollContainer) {
      showHeaderShadow = false;
      showFooterShadow = false;
      return;
    }

    const { scrollTop, clientHeight, scrollHeight } = scrollContainer;
    const canScroll = scrollHeight > clientHeight + 1;

    if (!canScroll) {
      showHeaderShadow = false;
      showFooterShadow = false;
      return;
    }

    const atTop = scrollTop <= 0;
    const atBottom = scrollTop + clientHeight >= scrollHeight - 1;

    showHeaderShadow = !atTop;
    showFooterShadow = !atBottom;
  }

  function loadAgents() {
    // Read from localStorage — data is pushed via syncAgents by trayManager
    const cached = readCachedAgents();
    if (cached) {
      agents = sortAgentsByStatus(cached);
    }
    loading = false;
  }

  $effect(() => {
    loadAgents();

    const key = onAgentSync(loadAgents);
    return () => offAgentSync(key);
  });

  $effect(() => {
    loading;
    agents;
    requestAnimationFrame(updateScrollShadows);
  });

  async function handleRefresh() {
    isRefreshing = true;
    try {
      await rpc.request.requestRefresh({});
    } finally {
      setTimeout(() => { isRefreshing = false; }, 500);
    }
  }

  async function handleConfigure() {
    await rpc.request.openMainWindow({ page: "agents" });
  }

  async function handleSettings() {
    await rpc.request.openMainWindow({ page: "settings" });
  }

  async function handleQuit() {
    await rpc.request.quit({});
  }

  function getStatusClass(status: string): string | string[] {
    switch (status) {
      case "ok":
        return ["status-online", "bg-green-600 dark:bg-green-500"];
      case "error":
        return "animate-pulse bg-orange-400 dark:bg-orange-300";
      case "offline":
      default:
        return "bg-black/20 dark:bg-white/20";
    }
  }

  function getAgentTitle(agent: AgentStatus): string {
    let tooltip = "";

    // Add status indicator
    switch (agent.status) {
      case "ok":
        tooltip += "Status: Online";
        break;
      case "offline":
        tooltip += `Status: Offline${agent.errorMessage ? `\nError: ${agent.errorMessage}` : ""}`;
        break;
      case "error":
        tooltip += `Status: Error${agent.errorMessage ? `\nError: ${agent.errorMessage}` : ""}`;
        break;
    }

    const lines = [agent.name, `${agent.url}:${agent.port}`, tooltip];

    return lines.join("\n");
  }
</script>

<div class={["popover py-2 pl-3", "flex flex-col h-screen"]}>
  <div
    class={[
      "header",
      showHeaderShadow ? "shadow-bottom" : "",
      "flex justify-between items-center",
      "pb-2 mr-3 px-1",
      "border-b border-black/10 dark:border-white/10",
    ]}
  >
    <span class="flex-2 font-semibold text-sm text-black/80 dark:text-white"
      >Crab Monitor</span
    >

    {#if isRefreshing}
      <span
        class={[
          "flex-1 animate-pulse text-[11px] mr-2",
          "text-black/50 dark:text-white/60",
        ]}>Updating…</span
      >
    {/if}

    <button
      class={[
        "refresh-btn",
        "rounded transition-colors",
        "px-2 py-1",
        "font-bold text-[11px]",
        "text-black/70 dark:text-white",
        "bg-white/60 hover:bg-white/90 dark:bg-black/30 dark:hover:bg-black/50",
        "box-border dark:border-black/5",
        "shadow-xs shadow-black/5 dark:shadow-black/20",
      ]}
      onclick={handleRefresh}
    >
      <span class={["refresh-icon", isRefreshing ? "is-spinning" : ""]}>↻</span>
    </button>
  </div>

  <div
    bind:this={scrollContainer}
    onscroll={updateScrollShadows}
    class={["flex flex-col gap-2 py-2 pl-2 pr-5", "flex-1", "overflow-y-auto"]}
  >
    {#if agents.length === 0}
      <div
        class={["p-5 text-sm text-center", "text-black/60 dark:text-white/60"]}
      >
        No agents configured
      </div>
    {:else}
      {#each agents as agent (agent.id)}
        <div
          title={getAgentTitle(agent)}
          class={[
            "agent-item",
            "flex items-center gap-2 p-2",
            "rounded-md",
            "transition-colors",
            "bg-white/25 hover:bg-white/40 dark:bg-black/20 dark:hover:bg-black/35",
            "shadow-xs shadow-black/5 dark:shadow-black/15",
            "box-border dark:border-black/5",
          ]}
        >
          <span
            class={[
              "shrink-0 ml-1",
              "w-2.5 h-2.5 rounded-full",
              getStatusClass(agent.status),
            ]}
          ></span>
          <div class={["flex flex-col ml-1", "min-w-0"]}>
            <span
              class={[
                "agent-name",
                "font-medium text-[13px] text-ellipsis text-nowrap overflow-hidden",
                "text-black/80 dark:text-white",
              ]}>{agent.name}</span
            >
            <span
              class={[
                "agent-time",
                "text-[11px]",
                "text-black/50 dark:text-white/60",
              ]}>{agent.url}:{agent.port}</span
            >
          </div>
        </div>
      {/each}
    {/if}
  </div>

  <div
    class={[
      "footer",
      showFooterShadow ? "shadow-top" : "",
      "relative z-10",
      "flex gap-2 pt-2 mr-3 px-1",
      "border-t border-black/10 dark:border-white/10",
    ]}
  >
    <Button onclick={handleConfigure} size="sm">Configure</Button>
    <Button onclick={handleSettings} size="sm">Settings</Button>
    <Button
      onclick={handleQuit}
      bgColor={["bg-white/60 hover:bg-red-500/60 dark:bg-black/30"]}
      textColor={["text-black/70 hover:text-white dark:text-white"]}
      size="sm">Quit</Button
    >
  </div>
</div>

<style>
  .popover {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
      sans-serif;
    box-sizing: border-box;
  }

  .status-online {
    box-shadow: 0 0 6px var(--color-green-600);
  }
  :global(.dark) .status-online {
    box-shadow: 0 0 6px var(--color-green-500);
  }

  .shadow-bottom {
    box-shadow: 0px 3px 3px -3px rgba(0, 0, 0, 0.2);
  }
  .shadow-top {
    box-shadow: 0px -3px 3px -3px rgba(0, 0, 0, 0.2);
  }

  :global(.dark) .shadow-bottom {
    box-shadow: 0px 3px 3px -3px rgba(0, 0, 0, 0.3);
  }
  :global(.dark) .shadow-top {
    box-shadow: 0px -3px 3px -3px rgba(0, 0, 0, 0.3);
  }

  .header,
  .footer {
    transition: box-shadow 200ms ease;
  }

  .refresh-icon {
    display: inline-block;
    transform-origin: 50% 50%;
  }

  .refresh-icon.is-spinning {
    animation: refresh-spin 700ms linear infinite;
  }

  @keyframes refresh-spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
</style>
