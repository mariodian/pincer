<script lang="ts">
  import * as Alert from "$lib/components/ui/alert";
  import { Button } from "$lib/components/ui/button";
  import * as Card from "$lib/components/ui/card";
  import * as Dialog from "$lib/components/ui/dialog";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import { PageBody, PageHeader } from "$lib/components/ui/page";
  import * as Select from "$lib/components/ui/select";
  import { Skeleton } from "$lib/components/ui/skeleton";
  import { SwitchCard } from "$lib/components/ui/switch-card";
  import {
    getMainRPC,
    onAgentFormSave,
    whenReady,
  } from "$lib/services/mainRPC";
  import { normalizeUrl } from "$shared/agent-helpers";
  import type { Agent } from "$shared/types";
  import { onMount } from "svelte";
  import { toast } from "svelte-sonner";
  import Icon from "../ui/icon/icon.svelte";
  import Separator from "../ui/separator/separator.svelte";

  interface Props {
    agentId?: number;
    onNavigate: (path: string) => void;
    prevPath?: string;
    currentPath?: string;
  }

  let {
    agentId,
    onNavigate,
    prevPath = "/",
    currentPath = "/agents/add",
  }: Props = $props();

  const isEdit = $derived(agentId !== undefined);
  const DEFAULT_PORT = "18790";

  let type = $state("");
  let name = $state("");
  let url = $state("");
  let port = $state(DEFAULT_PORT);
  let enabled = $state(true);
  let healthEndpoint = $state("/health");
  let statusShape = $state("always_ok");

  let loading = $state(false);
  let saving = $state(false);
  let errors = $state<Record<string, string>>({});
  let loadError = $state("");
  let formElement = $state<HTMLFormElement | null>(null);
  let showDiscardDialog = $state(false);

  type AgentTypeInfo = {
    id: string;
    name: string;
    statusShapeOptions: { value: string; label: string }[];
  };
  let agentTypes = $state<AgentTypeInfo[]>([]);
  let initialEditSnapshot = $state<Omit<Agent, "id"> | null>(null);

  const triggerContent = $derived(
    agentTypes.find((f) => f.id === type)?.name ?? "Select an agent type",
  );

  const isCustom = $derived(type === "custom");

  const hasUnsavedChanges = $derived.by(() => {
    if (loading || saving) return false;
    if (isEdit && initialEditSnapshot) {
      const updates = buildChangedFields(
        initialEditSnapshot,
        buildNormalizedPayload(),
      );
      return Object.keys(updates).length > 0;
    }
    // Add mode: dirty if any field differs from defaults
    return (
      name !== "" ||
      url !== "" ||
      port !== DEFAULT_PORT ||
      enabled !== true ||
      type !== ""
    );
  });

  function buildNormalizedPayload(): Omit<Agent, "id"> {
    return {
      type,
      name: name.trim(),
      url: normalizeUrl(url),
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
    try {
      await whenReady();
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

    if (!type) {
      newErrors.type = "Agent type is required";
    }

    if (!name.trim()) {
      newErrors.name = "Name is required";
    }

    if (!url.trim()) {
      newErrors.url = "URL is required";
    } else {
      try {
        const normalized = normalizeUrl(url);
        const parsed = new URL(normalized);
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

      if (isEdit && agentId) {
        const initial = initialEditSnapshot ?? agentData;
        const updates = buildChangedFields(initial, agentData);

        if (Object.keys(updates).length === 0) {
          onNavigate("/agents");
          return;
        }

        await rpc.request.updateAgent([agentId, updates]);
        toast.success(`Agent "${name}" updated`);
      } else {
        await rpc.request.addAgent(agentData);
        toast.success(`Agent "${name}" added`);
      }

      // Status sync is handled by main process via StatusSyncService
      onNavigate("/agents");
    } catch (error) {
      console.error("Failed to save agent:", error);
      errors.form = "Failed to save agent. Please try again.";
    } finally {
      saving = false;
    }
  }

  onMount(() => {
    return onAgentFormSave(() => {
      if (loading || saving || !formElement) {
        return;
      }

      formElement.requestSubmit();
    });
  });

  function handleEscKey(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      if (hasUnsavedChanges) {
        showDiscardDialog = true;
      } else {
        window.history.back();
      }
    }
  }

  function handleBack() {
    if (hasUnsavedChanges) {
      showDiscardDialog = true;
    } else {
      onNavigate("/agents");
    }
  }

  function handleDiscard() {
    showDiscardDialog = false;
    window.history.back();
  }
</script>

<svelte:window onkeydown={handleEscKey} />

<div class="flex flex-col h-full max-w-lg">
  <PageHeader
    title={isEdit ? "Edit Agent" : "Add Agent"}
    description={isEdit
      ? "Update the agent configuration."
      : "Configure a new service to monitor."}
    {prevPath}
    {currentPath}
    showBack
    onBack={handleBack}
  />

  <PageBody>
    {#if loadError}
      <Alert.Root variant="destructive">
        <Icon name="alertCircle" class="size-4 text-destructive" />
        <Alert.Title>Error</Alert.Title>
        <Alert.Description>
          <p>{loadError}</p>
        </Alert.Description>
      </Alert.Root>
    {:else if loading}
      <Card.Root class="">
        <Card.Content class="space-y-6">
          <div class="space-y-2">
            <Skeleton class="h-4 w-19" />
            <Skeleton class="h-9 w-56" />
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
            <Skeleton class="h-9 w-28" />
          </div>
        </Card.Content>
      </Card.Root>
    {:else}
      <form bind:this={formElement} onsubmit={handleSubmit}>
        {#if errors.form}
          <Alert.Root variant="destructive">
            <Icon name="alertCircle" class="size-4 text-destructive" />
            <Alert.Title>Error</Alert.Title>
            <Alert.Description>
              <p>{errors.form}</p>
            </Alert.Description>
          </Alert.Root>
        {/if}
        <Card.Root class="gap-0">
          <Card.Content class="space-y-4">
            <div class="space-y-2">
              <Label
                for="type-select"
                class="text-sm font-medium cursor-pointer"
              >
                Agent Type
              </Label>
              <Select.Root type="single" name="type" bind:value={type}>
                <Select.Trigger
                  id="type-select"
                  class="w-56"
                  aria-invalid={!!errors.type}
                >
                  {triggerContent}
                </Select.Trigger>
                <Select.Content>
                  <Select.Group>
                    <Select.Label>Agents</Select.Label>
                    {#each [...agentTypes].sort( (a, b) => (a.id === "custom" ? 1 : b.id === "custom" ? -1 : 0), ) as agentType (agentType.id)}
                      <Select.Item
                        value={agentType.id}
                        label="{agentType.name}}"
                      >
                        {agentType.name}
                      </Select.Item>
                    {/each}
                  </Select.Group>
                </Select.Content>
              </Select.Root>
              {#if errors.type}
                <p class="text-xs text-destructive">{errors.type}</p>
              {/if}
            </div>

            {#if isCustom}
              <div class="space-y-2">
                <Label for="healthEndpoint" class="text-sm font-medium">
                  Health Endpoint
                </Label>
                <Input
                  id="healthEndpoint"
                  type="text"
                  placeholder="/health"
                  bind:value={healthEndpoint}
                  aria-invalid={!!errors.healthEndpoint}
                />
                {#if errors.healthEndpoint}
                  <p class="text-xs text-destructive">
                    {errors.healthEndpoint}
                  </p>
                {/if}
                <p class="text-xs text-muted-foreground">
                  Path checked for agent health (e.g. /health, /status)
                </p>
              </div>

              <div class="space-y-2">
                <Label for="statusShape" class="text-sm font-medium">
                  Status Detection
                </Label>
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
              <Label for="name" class="text-sm font-medium">Name</Label>
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
              <Label for="url" class="text-sm font-medium">URL</Label>
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

            <div class="space-y-2 w-28">
              <Label for="port" class="text-sm font-medium">Port</Label>
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
          </Card.Content>

          <Separator class="mt-6" />

          <Card.Content class="p-0 space-y-0">
            <SwitchCard
              id="monitor-agent"
              title="Monitor Agent"
              description="An enabled agent will be actively monitored. Disable to pause
          monitoring without losing configuration."
              bind:checked={enabled}
              variant="blue"
              class="border-none shadow-none rounded-none m-0 px-6"
            />
          </Card.Content>

          <Separator class="mb-4" />

          <Card.Footer>
            <div class="flex gap-3 pt-2">
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : isEdit ? "Save Changes" : "Add Agent"}
              </Button>
              <Button type="button" variant="outline" onclick={handleBack}>
                Cancel
              </Button>
            </div>
          </Card.Footer>
        </Card.Root>
      </form>
    {/if}
  </PageBody>

  <Dialog.Root bind:open={showDiscardDialog}>
    <Dialog.Portal>
      <Dialog.Overlay />
      <Dialog.Content
        showCloseButton={false}
        onkeydown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
          }
        }}
      >
        <Dialog.Header>
          <Dialog.Title>Discard unsaved changes?</Dialog.Title>
          <Dialog.Description>
            You have unsaved changes that will be lost if you leave.
          </Dialog.Description>
        </Dialog.Header>
        <Dialog.Footer class="gap-2">
          <Button
            tabindex={0}
            variant="outline"
            onclick={() => (showDiscardDialog = false)}
          >
            Keep editing
          </Button>
          <Button tabindex={0} variant="destructive" onclick={handleDiscard}
            >Discard</Button
          >
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>
</div>
