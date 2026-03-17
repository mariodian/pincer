<script lang="ts">
  import { Electroview } from "electrobun/view";
  import "./index.css";

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

  type AgentRPCType = {
    bun: {
      requests: {
        getAgents: {
          params: Record<string, never>;
          response: Agent[];
        };
        checkAllAgentsStatus: {
          params: Record<string, never>;
          response: AgentStatus[];
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

  async function loadAgents() {
    loading = true;
    try {
      const agentList = await rpc.request.getAgents({});
      const statuses = await rpc.request.checkAllAgentsStatus({});
      const statusMap = new Map(statuses.map((s) => [s.id, s]));
      agents = agentList.map((agent) => ({
        ...agent,
        status: statusMap.get(agent.id)?.status || "offline",
        lastChecked: statusMap.get(agent.id)?.lastChecked || 0,
        errorMessage: statusMap.get(agent.id)?.errorMessage,
      }));
    } catch (error) {
      console.error("Failed to load agents:", error);
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    loadAgents();
  });

  async function handleRefresh() {
    isRefreshing = true;
    try {
      await rpc.request.checkAllAgentsStatus({});
      await loadAgents();
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

  function formatTime(timestamp: number): string {
    if (!timestamp) return "Never";
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
</script>

<div class="popover">
  <div class="header">
    <span class="title">CrabControl</span>
    <button class="refresh-btn" onclick={handleRefresh}><span class:spinning={isRefreshing}>↻</span></button>
  </div>

  <div class="agent-list">
    {#if loading}
      <div class="loading">Loading...</div>
    {:else if agents.length === 0}
      <div class="empty">No agents configured</div>
    {:else}
      {#each agents as agent (agent.id)}
        <div class="agent-item">
          <span class="status-dot {getStatusClass(agent.status)}"></span>
          <div class="agent-info">
            <span class="agent-name">{agent.name}</span>
            <span class="agent-time">{formatTime(agent.lastChecked)}</span>
          </div>
        </div>
      {/each}
    {/if}
  </div>

  <div class="footer">
    <button class="footer-btn" onclick={handleConfigure}>Configure</button>
    <button class="footer-btn quit" onclick={handleQuit}>Quit</button>
  </div>
</div>

<style>
  .popover {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
      sans-serif;
    background: rgba(30, 30, 30, 0.95);
    color: #fff;
    padding: 12px;
    border-radius: 10px;
    min-height: 100%;
    box-sizing: border-box;
  }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
    padding-bottom: 8px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .title {
    font-size: 14px;
    font-weight: 600;
  }

  .refresh-btn {
    background: rgba(255, 255, 255, 0.1);
    border: none;
    color: #fff;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 11px;
    cursor: pointer;
    transition: background 0.15s;
  }

  .refresh-btn:hover {
    background: rgba(255, 255, 255, 0.2);
  }

  .refresh-btn span.spinning {
    display: inline-block;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  .agent-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-height: 180px;
    overflow-y: auto;
  }

  .loading,
  .empty {
    text-align: center;
    color: #666;
    padding: 20px;
    font-size: 13px;
  }

  .agent-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 6px;
    transition: background 0.15s;
  }

  .agent-item:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  .status-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
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

  .agent-info {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0;
  }

  .agent-name {
    font-size: 13px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .agent-time {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.5);
  }

  .footer {
    margin-top: 12px;
    padding-top: 8px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    display: flex;
    gap: 8px;
  }

  .footer-btn {
    flex: 1;
    background: rgba(255, 255, 255, 0.1);
    border: none;
    color: #fff;
    padding: 8px;
    border-radius: 4px;
    font-size: 12px;
    cursor: pointer;
    transition: background 0.15s;
  }

  .footer-btn:hover {
    background: rgba(255, 255, 255, 0.2);
  }

  .footer-btn.quit:hover {
    background: rgba(245, 101, 101, 0.3);
  }
</style>
