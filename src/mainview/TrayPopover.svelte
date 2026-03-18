<script lang="ts">
  import { Electroview } from "electrobun/view";
  import "./index.css";
  import Button from "./ui/Button.svelte";

  interface Agent {
    id: string;
    name: string;
    url: string;
    port: number;
    enabled?: boolean;
  }

  interface AgentStatus extends Agent {
    status: "ok" | "offline" | "error" | "warning";
    lastChecked: number;
    errorMessage?: string;
  }

  interface AgentStatusInfo {
    id: string;
    status: "ok" | "offline" | "error" | "warning";
    lastChecked: number;
    errorMessage?: string;
  }

  type AgentRPCType = {
    bun: {
      requests: {
        getAgents: {
          params: Record<string, never>;
          response: AgentStatusInfo[];
        };
        checkAllAgentsStatus: {
          params: Record<string, never>;
          response: AgentStatusInfo[];
        };
        openConfig: {
          params: Record<string, never>;
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
      messages: Record<string, never>;
    };
  };

  const rpc = Electroview.defineRPC<AgentRPCType>({
    handlers: {
      requests: {},
      messages: {},
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

  async function loadAgents() {
    try {
      const storedAgents = localStorage.getItem("crabAgents");
      const storedStatuses = localStorage.getItem("crabAgentStatuses");
      if (storedAgents && storedStatuses) {
        const agentList: Agent[] = JSON.parse(storedAgents);
        const statusList: AgentStatus[] = JSON.parse(storedStatuses);
        const statusMap = new Map(statusList.map((s) => [s.id, s]));
        agents = agentList.map((agent) => ({
          ...agent,
          status: statusMap.get(agent.id)?.status ?? "offline",
          lastChecked: statusMap.get(agent.id)?.lastChecked ?? 0,
          errorMessage: statusMap.get(agent.id)?.errorMessage,
        }));
        loading = false;
        return;
      }
    } catch { /* fall through */ }
    loading = true;
    try {
      const storedAgents = localStorage.getItem("crabAgents");
      if (storedAgents) {
        const agentList: Agent[] = JSON.parse(storedAgents);
        const statuses = await rpc.request.checkAllAgentsStatus({});
        const statusMap = new Map(statuses.map((s) => [s.id, s]));
        agents = agentList.map((agent) => ({
          ...agent,
          status: statusMap.get(agent.id)?.status ?? "offline",
          lastChecked: statusMap.get(agent.id)?.lastChecked ?? 0,
          errorMessage: statusMap.get(agent.id)?.errorMessage,
        }));
      } else {
        const statuses = await rpc.request.checkAllAgentsStatus({});
        agents = statuses.map((s) => ({
          id: s.id,
          name: "",
          url: "",
          port: 0,
          status: s.status,
          lastChecked: s.lastChecked,
          errorMessage: s.errorMessage,
        })) as AgentStatus[];
      }
    } catch (error) {
      console.error("Failed to load agents:", error);
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    loadAgents();
    const handler = () => loadAgents();
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  });

  $effect(() => {
    loading;
    agents;
    requestAnimationFrame(updateScrollShadows);
  });

  async function handleRefresh() {
    isRefreshing = true;
    try {
      await rpc.request.checkAllAgentsStatus({});
      loadAgents();
    } finally {
      isRefreshing = false;
    }
  }

  async function handleConfigure() {
    await rpc.request.openConfig({});
  }

  async function handleQuit() {
    await rpc.request.quit({});
  }

  function getStatusClass(status: string): string {
    switch (status) {
      case "ok":
        return "status-online";
      case "offline":
        return "status-offline";
      case "error":
        return "status-error";
      case "warning":
        return "status-warning";
      default:
        return "status-offline";
    }
  }

  // function formatTime(timestamp: number): string {
  //   if (!timestamp) return "Never";
  //   const date = new Date(timestamp);
  //   return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  // }
</script>

<div class={["popover py-2 pl-3", "flex flex-col h-screen"]}>
  <div
    class={[
      "header",
      showHeaderShadow ? "shadow-bottom" : "",
      "flex justify-between items-center",
      "pb-2 mr-3 px-1",
      "border-b border-black/10",
    ]}
  >
    <span class="font-semibold text-sm text-black/80 dark:text-white">Crab Monitor</span>

    {#if isRefreshing}
      <span class="text-[11px] text-black/50 dark:text-white/60 animate-pulse">Updating…</span>
    {/if}

    <button
      class="refresh-btn rounded transition-colors px-2 py-1 font-bold text-[11px] text-black/70 dark:text-white bg-white/60 hover:bg-white/90 dark:bg-black/30 dark:hover:bg-black/50 shadow-xs shadow-black/5"
      onclick={handleRefresh}
    >
      <span class:animate-spin={isRefreshing}>↻</span>
    </button>
  </div>

  <div
    bind:this={scrollContainer}
    onscroll={updateScrollShadows}
    class={["flex flex-col gap-2 py-2 pl-2 pr-5", "flex-1", "overflow-y-auto"]}
  >
    {#if loading}
      <div class="loading">Loading...</div>
    {:else if agents.length === 0}
      <div class="empty">No agents configured</div>
    {:else}
      {#each agents as agent (agent.id)}
        <div
          class={[
            "agent-item",
            "flex items-center gap-2 p-2",
            "rounded-md",
            "transition-colors",
            "bg-white/25 hover:bg-white/40 dark:bg-black/25 dark:hover:bg-black/40",
            "shadow-xs shadow-black/5",
          ]}
        >
          <span
            class={[
              "shrink-0",
              "w-2.5 h-2.5 rounded-full",
              getStatusClass(agent.status),
            ]}
          ></span>
          <div class={["flex flex-col", "min-w-0"]}>
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
      "border-t border-black/10",
    ]}
  >
    <Button onclick={handleConfigure} size="sm">Configure</Button>
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

  .loading,
  .empty {
    text-align: center;
    color: #666;
    padding: 20px;
    font-size: 13px;
  }

  .status-online {
    background: #48bb78;
    box-shadow: 0 0 6px #48bb78;
  }

  .status-offline {
    background: #f56565;
  }

  .status-error {
    background: #ed8936;
  }

  .status-warning {
    background: #ecc94b;
  }

  .shadow-bottom {
    box-shadow: 0px 3px 3px -3px rgba(0, 0, 0, 0.2);
  }
  .shadow-top {
    box-shadow: 0px -3px 3px -3px rgba(0, 0, 0, 0.2);
  }

  .header,
  .footer {
    transition: box-shadow 200ms ease;
  }
</style>
