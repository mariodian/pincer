<script lang="ts">
  import { Electroview } from "electrobun/view";

  interface Agent {
    id: string;
    name: string;
    url: string;
    port: number;
    enabled?: boolean;
  }

  interface AgentStatus extends Agent {
    status: "online" | "offline" | "error" | "warning";
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
        addAgent: {
          params: Omit<Agent, "id">;
          response: Agent;
        };
        updateAgent: {
          params: [string, Partial<Agent>];
          response: Agent | null;
        };
        deleteAgent: {
          params: string;
          response: boolean;
        };
        checkAllAgentsStatus: {
          params: Record<string, never>;
          response: AgentStatus[];
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

  new Electroview({ rpc });

  let agents = $state<Agent[]>([]);
  let agentStatusMap = $state<Map<string, AgentStatus>>(new Map());
  let name = $state("");
  let url = $state("");
  let port = $state("");
  let editingId = $state<string | null>(null);
  let statusMessage = $state("");
  let isLoading = $state(false);

  async function loadAgents() {
    isLoading = true;
    try {
      agents = await rpc.request.getAgents({});
      const statuses = await rpc.request.checkAllAgentsStatus({});
      agentStatusMap = new Map(statuses.map((s) => [s.id, s]));
    } catch (e) {
      console.error("Error loading agents:", e);
      statusMessage = "Error loading agents";
    } finally {
      isLoading = false;
    }
  }

  async function handleSubmit(e: Event) {
    e.preventDefault();
    if (!name || !url || !port) {
      statusMessage = "Please fill in all fields";
      return;
    }

    const portNum = parseInt(port, 10);
    if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
      statusMessage = "Please enter a valid port number (1-65535)";
      return;
    }

    isLoading = true;
    try {
      if (editingId) {
        const updated = await rpc.request.updateAgent([
          editingId,
          { name, url, port: portNum },
        ]);
        if (updated) {
          statusMessage = "Agent updated successfully";
          await loadAgents();
        }
      } else {
        await rpc.request.addAgent({ name, url, port: portNum, enabled: true });
        statusMessage = "Agent added successfully";
        await loadAgents();
      }
      resetForm();
    } catch (e) {
      console.error("Error saving agent:", e);
      statusMessage = "Error saving agent";
    } finally {
      isLoading = false;
    }
  }

  function resetForm() {
    editingId = null;
    name = "";
    url = "";
    port = "";
  }

  function editAgent(agent: Agent) {
    editingId = agent.id;
    name = agent.name;
    url = agent.url;
    port = agent.port.toString();
  }

  async function deleteAgent(id: string) {
    if (!confirm("Are you sure you want to delete this agent?")) return;
    isLoading = true;
    try {
      await rpc.request.deleteAgent(id);
      statusMessage = "Agent deleted successfully";
      await loadAgents();
    } catch (e) {
      console.error("Error deleting agent:", e);
      statusMessage = "Error deleting agent";
    } finally {
      isLoading = false;
    }
  }

  function getStatusIndicator(agentId: string) {
    const status = agentStatusMap.get(agentId);
    if (!status)
      return { label: "○", class: "offline", title: "Status unknown" };

    switch (status.status) {
      case "online":
        return { label: "●", class: "online", title: `${status.name}: Online` };
      case "offline":
        return {
          label: "○",
          class: "offline",
          title: `${status.name}: Offline`,
        };
      case "error":
        return { label: "✗", class: "error", title: `${status.name}: Error` };
      case "warning":
        return {
          label: "▲",
          class: "warning",
          title: `${status.name}: Warning`,
        };
      default:
        return { label: "○", class: "offline", title: "Status unknown" };
    }
  }

  loadAgents();
</script>

<div class="agent-config-container">
  <h1>Agent Configuration</h1>

  {#if statusMessage}
    <div class="status-message">{statusMessage}</div>
  {/if}

  <form onsubmit={handleSubmit} class="agent-form">
    <h2>{editingId ? "Edit Agent" : "Add New Agent"}</h2>
    <div class="form-group">
      <label for="agent-name">Name:</label>
      <input
        type="text"
        id="agent-name"
        bind:value={name}
        required
        disabled={isLoading}
      />
    </div>
    <div class="form-group">
      <label for="agent-url">URL:</label>
      <input
        type="text"
        id="agent-url"
        bind:value={url}
        required
        disabled={isLoading}
        placeholder="http://localhost"
      />
    </div>
    <div class="form-group">
      <label for="agent-port">Port:</label>
      <input
        type="number"
        id="agent-port"
        bind:value={port}
        required
        disabled={isLoading}
        min="1"
        max="65535"
      />
    </div>
    <div class="form-actions">
      <button type="submit" disabled={isLoading}>
        {editingId ? "Update Agent" : "Add Agent"}
      </button>
      <button type="button" onclick={resetForm} disabled={isLoading}
        >Cancel</button
      >
    </div>
  </form>

  {#if agents.length > 0}
    <h2>Managed Agents</h2>
    <table class="agents-table">
      <thead>
        <tr>
          <th>Status</th>
          <th>Name</th>
          <th>URL:Port</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {#each agents as agent}
          {@const statusInfo = getStatusIndicator(agent.id)}
          <tr>
            <td>
              <span
                class="status-indicator {statusInfo.class}"
                title={statusInfo.title}
              >
                {statusInfo.label}
              </span>
            </td>
            <td>{agent.name}</td>
            <td>{agent.url}:{agent.port}</td>
            <td class="agent-actions">
              <button
                class="btn-edit"
                onclick={() => editAgent(agent)}
                disabled={isLoading}
              >
                Edit
              </button>
              <button
                class="btn-delete"
                onclick={() => deleteAgent(agent.id)}
                disabled={isLoading}
              >
                Delete
              </button>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  {:else}
    <p class="no-agents">No agents configured yet. Add one above!</p>
  {/if}
</div>

<style>
  .agent-config-container {
    max-width: 800px;
    margin: 0 auto;
    padding: 20px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
      sans-serif;
  }

  h1 {
    color: #333;
    margin-bottom: 20px;
  }

  h2 {
    color: #333;
    margin-top: 0;
    margin-bottom: 15px;
  }

  .status-message {
    padding: 10px;
    margin-bottom: 20px;
    background-color: #e3f2fd;
    border-left: 4px solid #2196f3;
    border-radius: 4px;
  }

  .agent-form {
    background: #f8f9fa;
    padding: 20px;
    border-radius: 8px;
    margin-bottom: 30px;
  }

  .form-group {
    margin-bottom: 15px;
  }

  .form-group label {
    display: block;
    margin-bottom: 5px;
    font-weight: bold;
  }

  .form-group input {
    width: 100%;
    padding: 8px;
    border: 1px solid #ddd;
    border-radius: 4px;
    box-sizing: border-box;
    font-size: 16px;
  }

  .form-group input:disabled {
    background-color: #f5f5f5;
    cursor: not-allowed;
  }

  .form-actions {
    display: flex;
    gap: 10px;
    margin-top: 20px;
  }

  .form-actions button {
    padding: 10px 20px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 16px;
    transition: background-color 0.2s;
  }

  .form-actions button[type="submit"] {
    background-color: #4caf50;
    color: white;
  }

  .form-actions button[type="submit"]:hover:not(:disabled) {
    background-color: #45a049;
  }

  .form-actions button[type="submit"]:disabled {
    background-color: #cccccc;
    cursor: not-allowed;
  }

  .form-actions button[type="button"] {
    background-color: #f44336;
    color: white;
  }

  .form-actions button[type="button"]:hover:not(:disabled) {
    background-color: #d32f2f;
  }

  .form-actions button[type="button"]:disabled {
    background-color: #cccccc;
    cursor: not-allowed;
  }

  .agents-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 20px;
  }

  .agents-table th,
  .agents-table td {
    padding: 12px;
    text-align: left;
    border-bottom: 1px solid #ddd;
  }

  .agents-table th {
    background-color: #f2f2f2;
    font-weight: bold;
  }

  .agents-table tr:hover {
    background-color: #f5f5f5;
  }

  .status-indicator {
    font-weight: bold;
    font-size: 1.2em;
  }

  .status-indicator.online {
    color: #4caf50;
  }

  .status-indicator.offline {
    color: #9e9e9e;
  }

  .status-indicator.error {
    color: #f44336;
  }

  .status-indicator.warning {
    color: #ff9800;
  }

  .agent-actions {
    display: flex;
    gap: 8px;
  }

  .btn-edit,
  .btn-delete {
    padding: 6px 12px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
  }

  .btn-edit {
    background-color: #2196f3;
    color: white;
  }

  .btn-edit:hover:not(:disabled) {
    background-color: #0b7dda;
  }

  .btn-edit:disabled {
    background-color: #cccccc;
    cursor: not-allowed;
  }

  .btn-delete {
    background-color: #f44336;
    color: white;
  }

  .btn-delete:hover:not(:disabled) {
    background-color: #d32f2f;
  }

  .btn-delete:disabled {
    background-color: #cccccc;
    cursor: not-allowed;
  }

  .no-agents {
    text-align: center;
    color: #666;
    font-style: italic;
    padding: 40px;
  }
</style>
