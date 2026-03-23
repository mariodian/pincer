<script lang="ts">
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import { Skeleton } from "$lib/components/ui/skeleton";
  import { SwitchCard } from "$lib/components/ui/switch-card";
  import { getMainRPC, whenReady } from "$lib/services/mainRPC";
  import type { Settings } from "$shared/types";

  interface Props {
    onSaveStatus: (status: "saving" | "saved" | "error" | null) => void;
  }

  let { onSaveStatus }: Props = $props();

  let loading = $state(true);

  // Form state
  let pollingIntervalSec = $state(30);
  let retentionDays = $state(90);
  let openMainWindow = $state(true);

  // Track last-saved values to detect changes on blur
  let savedPollingIntervalSec = $state(30);
  let savedRetentionDays = $state(90);

  async function loadSettings() {
    try {
      await whenReady();
      const rpc = getMainRPC();
      const settings: Settings = await rpc.request.getSettings({});

      pollingIntervalSec = Math.round(settings.pollingInterval / 1000);
      retentionDays = settings.retentionDays;
      openMainWindow = settings.openMainWindow;

      savedPollingIntervalSec = pollingIntervalSec;
      savedRetentionDays = retentionDays;
    } catch (error) {
      console.error("Failed to load settings:", error);
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    loadSettings();
  });

  async function saveField(updates: Partial<Settings>) {
    onSaveStatus("saving");
    try {
      const rpc = getMainRPC();
      await rpc.request.updateSettings(updates);
      onSaveStatus("saved");
    } catch (error) {
      console.error("Failed to save settings:", error);
      onSaveStatus("error");
    }
  }

  async function handlePollingBlur() {
    const val = Math.max(1, Math.round(pollingIntervalSec));
    pollingIntervalSec = val;

    if (val === savedPollingIntervalSec) return;

    savedPollingIntervalSec = val;
    await saveField({ pollingInterval: val * 1000 });
  }

  function handlePollingKeydown(e: KeyboardEvent) {
    if (e.key === "Enter") {
      (e.target as HTMLInputElement).blur();
    }
  }

  async function handleRetentionBlur() {
    const val = Math.max(0, Math.round(retentionDays));
    retentionDays = val;

    if (val === savedRetentionDays) return;

    savedRetentionDays = val;
    await saveField({ retentionDays: val });
  }

  function handleRetentionKeydown(e: KeyboardEvent) {
    if (e.key === "Enter") {
      (e.target as HTMLInputElement).blur();
    }
  }

  async function handleMainWindowChange(checked: boolean) {
    openMainWindow = checked;
    await saveField({ openMainWindow: checked });
  }
</script>

{#if loading}
  <div class="space-y-6 max-w-lg">
    <div class="space-y-2">
      <Skeleton class="h-4 w-32" />
      <Skeleton class="h-9 w-full" />
      <Skeleton class="h-3 w-48" />
    </div>
    <div class="space-y-2">
      <Skeleton class="h-4 w-28" />
      <Skeleton class="h-9 w-full" />
      <Skeleton class="h-3 w-56" />
    </div>
    <div class="flex items-center justify-between">
      <div class="space-y-2">
        <Skeleton class="h-4 w-40" />
        <Skeleton class="h-3 w-52" />
      </div>
      <Skeleton class="h-[18px] w-[32px] rounded-full" />
    </div>
  </div>
{:else}
  <div class="space-y-6 max-w-lg">
    <div class="space-y-2">
      <Label for="polling-interval">Polling interval (seconds)</Label>
      <Input
        id="polling-interval"
        type="number"
        min="1"
        bind:value={pollingIntervalSec}
        onblur={handlePollingBlur}
        onkeydown={handlePollingKeydown}
        class="w-20"
      />
      <p class="text-xs text-muted-foreground">
        How often to check agent health status.
      </p>
    </div>

    <div class="space-y-2">
      <Label for="retention-days">Data retention (days)</Label>
      <Input
        id="retention-days"
        type="number"
        min="0"
        bind:value={retentionDays}
        onblur={handleRetentionBlur}
        onkeydown={handleRetentionKeydown}
        class="w-20"
      />
      <p class="text-xs text-muted-foreground">
        Days to keep historical stats. Set to 0 to keep forever.
      </p>
    </div>

    <SwitchCard
      id="open-main-window"
      title="Open main window on startup"
      description="Show the application window when CrabControl launches. If disabled, the app will run in the background and can be accessed from the system tray."
      checked={openMainWindow}
      onCheckedChange={handleMainWindowChange}
    />
  </div>
{/if}
