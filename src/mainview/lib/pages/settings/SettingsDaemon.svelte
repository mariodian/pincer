<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import * as Card from "$lib/components/ui/card";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import { Separator } from "$lib/components/ui/separator";
  import { Skeleton } from "$lib/components/ui/skeleton";
  import Spinner from "$lib/components/ui/spinner/spinner.svelte";
  import { SwitchCard } from "$lib/components/ui/switch-card";
  import { getMainRPC, whenReady } from "$lib/services/mainRPC";
  import type { DaemonSettings } from "$shared/types";
  import { toast } from "svelte-sonner";

  interface Props {
    onSaveStatus: (status: "saving" | "saved" | "error" | null) => void;
  }

  let { onSaveStatus }: Props = $props();

  let loading = $state(true);
  let enabled = $state(false);
  let url = $state("");
  let secret = $state("");
  let namespaceKey = $state("");
  let savedUrl = $state("");
  let savedSecret = $state("");
  let savedNamespaceKey = $state("");
  let testStatus = $state<"testing" | null>(null);
  let syncStatus = $state<"syncing" | null>(null);
  let lastSync = $state<number | null>(null);

  async function loadSettings() {
    try {
      await whenReady();
      const rpc = getMainRPC();
      const [settings, lastSyncTime] = await Promise.all([
        rpc.request.getDaemonSettings({}),
        rpc.request.getLastDaemonSync({}),
      ]);

      enabled = settings.enabled;
      url = settings.url;
      secret = settings.secret;
      namespaceKey = settings.namespaceKey;
      savedUrl = url;
      savedSecret = secret;
      savedNamespaceKey = namespaceKey;
      lastSync = lastSyncTime;
    } catch (error) {
      console.error("Failed to load daemon settings:", error);
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    loadSettings();
  });

  async function saveField(updates: Partial<DaemonSettings>) {
    onSaveStatus("saving");
    try {
      const rpc = getMainRPC();
      await rpc.request.updateDaemonSettings(updates);
      onSaveStatus("saved");
    } catch (error) {
      console.error("Failed to save daemon settings:", error);
      onSaveStatus("error");
    }
  }

  async function handleUrlBlur() {
    if (url === savedUrl) return;
    savedUrl = url;
    await saveField({ url });
  }

  async function handleSecretBlur() {
    if (secret === savedSecret) return;
    savedSecret = secret;
    await saveField({ secret });
  }

  async function handleNamespaceKeyBlur() {
    if (namespaceKey === savedNamespaceKey) return;
    savedNamespaceKey = namespaceKey;
    await saveField({ namespaceKey });
  }

  async function handleEnabledChange(checked: boolean) {
    enabled = checked;
    await saveField({ enabled });
  }

  async function testConnection() {
    testStatus = "testing";
    try {
      const rpc = getMainRPC();
      const result = await rpc.request.testDaemonConnection({});
      if (result.connected) {
        toast.success(
          `Connected: daemon v${result.version}, uptime ${result.uptimeFormatted}`,
        );
      } else {
        toast.error(result.error || "Unreachable");
      }
    } catch {
      toast.error("Unreachable");
    } finally {
      testStatus = null;
    }
  }

  async function syncNow() {
    syncStatus = "syncing";
    try {
      const rpc = getMainRPC();
      const result = await rpc.request.syncDaemon({});
      lastSync = Date.now();
      toast.success(
        `Synced: ${result.checksImported} checks, ${result.statsImported} stats, ${result.incidentsImported} incidents`,
      );
    } catch {
      toast.error("Sync failed");
    } finally {
      syncStatus = null;
    }
  }

  function formatRelativeTime(timestamp: number | null): string {
    if (!timestamp) return "Never";
    const now = Date.now();
    const diff = now - timestamp;
    if (diff < 60_000) return "just now";
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
    if (diff < 2_592_000_000) return `${Math.floor(diff / 86_400_000)}d ago`;
    return `${Math.floor(diff / 2_592_000_000)}d ago`;
  }
</script>

{#if loading}
  <div class="space-y-6 max-w-lg">
    <Skeleton class="h-4 w-32" />
    <Skeleton class="h-9 w-full" />
    <Skeleton class="h-9 w-full" />
    <Skeleton class="h-9 w-full" />
  </div>
{:else}
  <div class="space-y-6 max-w-lg">
    <h3 class="font-medium mb-2">Daemon Sync</h3>
    <Card.Root>
      <Card.Content>
        <SwitchCard
          class="border-none bg-transparent! shadow-none p-0"
          id="enable-daemon"
          title="Enable daemon sync"
          description="Sync collected data with a remote pincer-daemon instance to fill gaps when this machine sleeps."
          checked={enabled}
          onCheckedChange={handleEnabledChange}
        />
      </Card.Content>

      <Separator class="my-0" />

      <Card.Content class="space-y-4">
        <div class="space-y-2">
          <Label for="daemon-url">Daemon URL</Label>
          <Input
            id="daemon-url"
            type="text"
            placeholder="http://my-vps.com:7378"
            bind:value={url}
            onblur={handleUrlBlur}
            disabled={!enabled}
          />
        </div>

        <div class="space-y-2">
          <Label for="daemon-secret">Secret</Label>
          <Input
            id="daemon-secret"
            type="password"
            placeholder="Shared secret"
            bind:value={secret}
            onblur={handleSecretBlur}
            disabled={!enabled}
          />
        </div>

        <div class="space-y-2">
          <Label for="daemon-namespace">Namespace key</Label>
          <Input
            id="daemon-namespace"
            type="text"
            placeholder="Leave empty for machine-scoped isolation"
            bind:value={namespaceKey}
            onblur={handleNamespaceKeyBlur}
            disabled={!enabled}
          />
          <p class="text-xs text-muted-foreground">
            Clients using the same key share data on the daemon. Changing this
            key disconnects existing history.
          </p>
        </div>

        <div class="flex items-center gap-2 pt-2">
          <Button
            size="sm"
            variant="outline"
            onclick={testConnection}
            disabled={!enabled || testStatus === "testing"}
          >
            {#if testStatus === "testing"}
              <Spinner />
              Testing...
            {:else}
              Test connection
            {/if}
          </Button>
        </div>
      </Card.Content>
    </Card.Root>

    <Card.Root>
      <Card.Content class="space-y-4 min-h-11">
        <div class="flex items-center justify-between">
          <div>
            <Label class="text-sm">Last synced</Label>
            <p class="text-xs text-muted-foreground mt-1">
              {formatRelativeTime(lastSync)}
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onclick={syncNow}
            disabled={syncStatus === "syncing" || !enabled}
          >
            {#if syncStatus === "syncing"}
              <Spinner />
              Syncing...
            {:else}
              Sync now
            {/if}
          </Button>
        </div>
      </Card.Content>
    </Card.Root>
  </div>
{/if}
