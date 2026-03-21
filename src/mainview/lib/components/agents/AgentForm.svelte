<script lang="ts">
  import { Button } from "$lib/components/ui/button/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { Skeleton } from "$lib/components/ui/skeleton/index.js";
  import { getMainRPC, isInitialized } from "$lib/services/mainRPC";
  import { updateCachedAgent, upsertCachedStatus } from "$lib/utils/storage";
  import { shouldTriggerHealthCheck } from "$shared/agent-helpers";
  import type { Agent, AgentStatusInfo } from "$shared/types";
  import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";
  import { HugeiconsIcon } from "@hugeicons/svelte";

  interface Props {
    agentId?: number;
    onNavigate: (path: string) => void;
  }

  let { agentId, onNavigate }: Props = $props();

  const isEdit = $derived(agentId !== undefined);

  let type = $state("openclaw");
  let name = $state("");
  let url = $state("");
  let port = $state("");
  let enabled = $state(true);
  let healthEndpoint = $state("/health");
  let statusShape = $state("always_ok");

  let loading = $state(false);
  let saving = $state(false);
  let errors = $state<Record<string, string>>({});
  let loadError = $state("");

  type AgentTypeInfo = {
    id: string;
    name: string;
    statusShapeOptions: { value: string; label: string }[];
  };
  let agentTypes = $state<AgentTypeInfo[]>([]);
  let initialEditSnapshot = $state<Omit<Agent, "id"> | null>(null);

  const isCustom = $derived(type === "custom");

  function buildNormalizedPayload(): Omit<Agent, "id"> {
    return {
      type,
      name: name.trim(),
      url: url.trim().replace(/\/+$/, ""),
      port: parseInt(port, 10),
      enabled,
      healthEndpoint: isCustom ? healthEndpoint.trim() || "/health" : undefined,
      statusShape: isCustom ? statusShape : undefined,
    };
  }

  function buildChangedFields(
    initial: Omit<Agent, "id">,
    next: Omit<Agent, "id">,
  ): Partial<Agent> {
    const updates: Partial<Agent> = {};

    if (initial.type !== next.type) updates.type = next.type;
    if (initial.name !== next.name) updates.name = next.name;
    if (initial.url !== next.url) updates.url = next.url;
    if (initial.port !== next.port) updates.port = next.port;
    if (initial.enabled !== next.enabled) updates.enabled = next.enabled;
    if (initial.healthEndpoint !== next.healthEndpoint) {
      updates.healthEndpoint = next.healthEndpoint;
    }
    if (initial.statusShape !== next.statusShape) {
      updates.statusShape = next.statusShape;
    }

    return updates;
  }

  async function loadData() {
    if (!isInitialized()) return;

    try {
      const rpc = getMainRPC();
      const types = await rpc.request.getAgentTypes({});
      agentTypes = types;

      if (isEdit && agentId) {
        const agents: Agent[] = await rpc.request.getAgents({});
        const agent = agents.find((a) => a.id === agentId);
        if (!agent) {
          loadError = "Agent not found";
          return;
        }
        type = agent.type;
        name = agent.name;
        url = agent.url;
        port = String(agent.port);
        enabled = agent.enabled ?? true;
        healthEndpoint = agent.healthEndpoint ?? "/health";
        statusShape = agent.statusShape ?? "always_ok";
        initialEditSnapshot = {
          type: agent.type,
          name: agent.name.trim(),
          url: agent.url.trim().replace(/\/+$/, ""),
          port: agent.port,
          enabled: agent.enabled ?? true,
          healthEndpoint:
            agent.type === "custom"
              ? (agent.healthEndpoint ?? "/health")
              : undefined,
          statusShape: agent.type === "custom" ? agent.statusShape : undefined,
        };
      }
    } catch (error) {
      console.error("Failed to load data:", error);
      loadError = "Failed to load agent data";
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    if (isEdit) loading = true;
    loadData();
  });

  function validate(): boolean {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = "Name is required";
    }

    if (!url.trim()) {
      newErrors.url = "URL is required";
    } else {
      let validationUrl = url.trim();
      if (!validationUrl.match(/^https?:\/\//)) {
        validationUrl = `http://${validationUrl}`;
      }
      try {
        const parsed = new URL(validationUrl);
        if (!["http:", "https:"].includes(parsed.protocol)) {
          newErrors.url = "URL must use http or https";
        }
      } catch {
        newErrors.url = "Invalid URL format";
      }
    }

    const portNum = parseInt(port, 10);
    if (!port || isNaN(portNum)) {
      newErrors.port = "Port is required";
    } else if (portNum < 1 || portNum > 65535) {
      newErrors.port = "Port must be 1-65535";
    }

    if (
      isCustom &&
      healthEndpoint.trim() &&
      !healthEndpoint.trim().startsWith("/")
    ) {
      newErrors.healthEndpoint = "Health endpoint must start with /";
    }

    errors = newErrors;
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: Event) {
    e.preventDefault();
    if (saving) return;

    if (!validate()) return;

    saving = true;
    errors = {};

    try {
      const rpc = getMainRPC();
      const agentData = buildNormalizedPayload();

      let result: Agent | null = null;

      if (isEdit && agentId) {
        const initial = initialEditSnapshot ?? agentData;
        const updates = buildChangedFields(initial, agentData);

        if (Object.keys(updates).length === 0) {
          onNavigate("/agents");
          return;
        }

        result = await rpc.request.updateAgent([agentId, updates]);

        if (result) {
          if (updates.enabled === false) {
            upsertCachedStatus({
              id: result.id,
              status: "offline",
              lastChecked: Date.now(),
              errorMessage: undefined,
            });
          } else if (
            updates.enabled === true ||
            shouldTriggerHealthCheck(updates)
          ) {
            const freshStatus: AgentStatusInfo | null =
              await rpc.request.checkOneAgentStatus(result.id);
            if (freshStatus) {
              upsertCachedStatus(freshStatus);
            }
          }
        }
      } else {
        result = await rpc.request.addAgent(agentData);

        if (result) {
          if (result.enabled === false) {
            upsertCachedStatus({
              id: result.id,
              status: "offline",
              lastChecked: Date.now(),
              errorMessage: undefined,
            });
          } else {
            const freshStatus: AgentStatusInfo | null =
              await rpc.request.checkOneAgentStatus(result.id);
            if (freshStatus) {
              upsertCachedStatus(freshStatus);
            }
          }
        }
      }

      // Update localStorage cache so the agent list shows changes immediately
      if (result) {
        updateCachedAgent(result);
      }

      onNavigate("/agents");
    } catch (error) {
      console.error("Failed to save agent:", error);
      errors.form = "Failed to save agent. Please try again.";
    } finally {
      saving = false;
    }
  }
</script>

<div class="flex flex-col h-full max-w-lg">
  <div class="flex items-center gap-3 mb-6">
    <Button
      variant="ghost"
      size="icon-sm"
      onclick={() => onNavigate("/agents")}
    >
      <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} />
      <span class="sr-only">Back</span>
    </Button>
    <div>
      <h1 class="text-2xl font-semibold tracking-tight">
        {isEdit ? "Edit Agent" : "Add Agent"}
      </h1>
      <p class="text-sm text-muted-foreground mt-1">
        {isEdit
          ? "Update the agent configuration."
          : "Configure a new service to monitor."}
      </p>
    </div>
  </div>

  {#if loadError}
    <div
      class="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive"
    >
      {loadError}
    </div>
  {:else if loading}
    <div class="space-y-6">
      <div class="space-y-2">
        <Skeleton class="h-4 w-12" />
        <Skeleton class="h-9 w-full" />
      </div>
      <div class="space-y-2">
        <Skeleton class="h-4 w-12" />
        <Skeleton class="h-9 w-full" />
      </div>
      <div class="space-y-2">
        <Skeleton class="h-4 w-8" />
        <Skeleton class="h-9 w-full" />
      </div>
      <div class="space-y-2">
        <Skeleton class="h-4 w-8" />
        <Skeleton class="h-9 w-full" />
      </div>
    </div>
  {:else}
    <form onsubmit={handleSubmit} class="space-y-5">
      {#if errors.form}
        <div
          class="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive"
        >
          {errors.form}
        </div>
      {/if}

      <div class="space-y-2">
        <label for="type" class="text-sm font-medium">Type</label>
        <select
          id="type"
          bind:value={type}
          class="flex h-9 w-full rounded-md border border-input bg-transparent px-2.5 py-1 text-sm shadow-xs transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-3 outline-none"
        >
          {#each [...agentTypes].sort( (a, b) => (a.id === "custom" ? 1 : b.id === "custom" ? -1 : 0), ) as agentType (agentType.id)}
            <option value={agentType.id}>{agentType.name}</option>
          {/each}
        </select>
      </div>

      {#if isCustom}
        <div class="space-y-2">
          <label for="healthEndpoint" class="text-sm font-medium">
            Health Endpoint
          </label>
          <Input
            id="healthEndpoint"
            type="text"
            placeholder="/health"
            bind:value={healthEndpoint}
            aria-invalid={!!errors.healthEndpoint}
          />
          {#if errors.healthEndpoint}
            <p class="text-xs text-destructive">{errors.healthEndpoint}</p>
          {/if}
          <p class="text-xs text-muted-foreground">
            Path checked for agent health (e.g. /health, /status)
          </p>
        </div>

        <div class="space-y-2">
          <label for="statusShape" class="text-sm font-medium">
            Status Detection
          </label>
          <select
            id="statusShape"
            bind:value={statusShape}
            class="flex h-9 w-full rounded-md border border-input bg-transparent px-2.5 py-1 text-sm shadow-xs transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-3 outline-none"
          >
            {#each agentTypes.find((t) => t.id === "custom")?.statusShapeOptions ?? [] as option (option.value)}
              <option value={option.value}>{option.label}</option>
            {/each}
          </select>
          <p class="text-xs text-muted-foreground">
            How to interpret the health endpoint response
          </p>
        </div>
      {/if}

      <div class="space-y-2">
        <label for="name" class="text-sm font-medium">Name</label>
        <Input
          id="name"
          type="text"
          placeholder="My Service"
          bind:value={name}
          aria-invalid={!!errors.name}
        />
        {#if errors.name}
          <p class="text-xs text-destructive">{errors.name}</p>
        {/if}
      </div>

      <div class="space-y-2">
        <label for="url" class="text-sm font-medium">URL</label>
        <Input
          id="url"
          type="text"
          placeholder="example.com or http(s)://example.com"
          bind:value={url}
          aria-invalid={!!errors.url}
        />
        {#if errors.url}
          <p class="text-xs text-destructive">{errors.url}</p>
        {/if}
      </div>

      <div class="space-y-2">
        <label for="port" class="text-sm font-medium">Port</label>
        <Input
          id="port"
          type="number"
          placeholder="18790"
          bind:value={port}
          min="1"
          max="65535"
          aria-invalid={!!errors.port}
        />
        {#if errors.port}
          <p class="text-xs text-destructive">{errors.port}</p>
        {/if}
      </div>

      <div class="flex items-center gap-2">
        <input
          id="enabled"
          type="checkbox"
          bind:checked={enabled}
          class="size-4 rounded border-input accent-primary"
        />
        <label for="enabled" class="text-sm font-medium cursor-pointer"
          >Enabled</label
        >
      </div>

      <div class="flex gap-3 pt-2">
        <Button type="submit" disabled={saving}>
          {saving ? "Saving..." : isEdit ? "Save Changes" : "Add Agent"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onclick={() => onNavigate("/agents")}
        >
          Cancel
        </Button>
      </div>
    </form>
  {/if}
</div>
