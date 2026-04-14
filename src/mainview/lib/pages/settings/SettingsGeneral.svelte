<script lang="ts">
  import * as Card from "$lib/components/ui/card";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import Separator from "$lib/components/ui/separator/separator.svelte";
  import { Skeleton } from "$lib/components/ui/skeleton";
  import { SwitchCard } from "$lib/components/ui/switch-card";
  import { getMainRPC, whenReady } from "$lib/services/mainRPC";
  import type { Settings } from "$shared/types";

  interface Props {
    onSaveStatus: (status: "saving" | "saved" | "error" | null) => void;
  }

  let { onSaveStatus }: Props = $props();

  let loading = $state(true);
  let platform: "macos" | "win" | "linux" | null = $state(null);

  // Form state
  let retentionDays = $state(90);
  let openMainWindow = $state(true);
  let showDisabledAgents = $state(false);
  let launchAtLogin = $state(false);

  // Track last-saved values to detect changes on blur
  let savedRetentionDays = $state(90);

  async function loadSettings() {
    try {
      await whenReady();
      const rpc = getMainRPC();
      const [settings, platformInfo]: [
        Settings,
        { os: "macos" | "win" | "linux" },
      ] = await Promise.all([
        rpc.request.getSettings({}),
        rpc.request.getPlatform({}),
      ]);

      retentionDays = settings.retentionDays;
      openMainWindow = settings.openMainWindow;
      showDisabledAgents = settings.showDisabledAgents;
      launchAtLogin = settings.launchAtLogin;
      platform = platformInfo.os;

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

  async function handleShowDisabledAgentsChange(checked: boolean) {
    showDisabledAgents = checked;
    await saveField({ showDisabledAgents: checked });
  }

  async function handleLaunchAtLoginChange(checked: boolean) {
    launchAtLogin = checked;
    await saveField({ launchAtLogin: checked });
  }

  function getAutostartDescription(): string {
    if (platform === "macos") {
      return "Start Pincer automatically when you log in to your Mac. The app will run in the background and can be accessed from the menu bar.";
    } else if (platform === "win") {
      return "Start Pincer automatically when Windows starts. The app will run in the background and can be accessed from the system tray.";
    }
    return "Start Pincer automatically when you log in. The app will run in the background and can be accessed from the system tray.";
  }
</script>

{#if loading}
  <div class="space-y-6 max-w-lg">
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
      <Skeleton class="h-4.5 w-8 rounded-full" />
    </div>
    <div class="flex items-center justify-between">
      <div class="space-y-2">
        <Skeleton class="h-4 w-48" />
        <Skeleton class="h-3 w-64" />
      </div>
      <Skeleton class="h-4.5 w-8 rounded-full" />
    </div>
    <div class="flex items-center justify-between">
      <div class="space-y-2">
        <Skeleton class="h-4 w-28" />
        <Skeleton class="h-3 w-56" />
      </div>
      <Skeleton class="h-4.5 w-8 rounded-full" />
    </div>
  </div>
{:else}
  <div class="space-y-6 max-w-lg">
    <h3 class="font-medium mb-2">Application</h3>
    <Card.Root>
      <Card.Content>
        <SwitchCard
          class="border-none bg-transparent! shadow-none p-0"
          id="launch-at-login"
          title="Launch at login"
          description={getAutostartDescription()}
          checked={launchAtLogin}
          onCheckedChange={handleLaunchAtLoginChange}
        />
      </Card.Content>

      <Separator class="my-0" />

      <Card.Content>
        <SwitchCard
          class="border-none bg-transparent! shadow-none p-0"
          id="open-main-window"
          title="Open main window on startup"
          description="Show the application window when Pincer launches. If disabled, the app will run in the background and can be accessed from the system tray."
          checked={openMainWindow}
          onCheckedChange={handleMainWindowChange}
        />
      </Card.Content>
    </Card.Root>

    <h3 class="font-medium mb-2">Statistics</h3>
    <Card.Root>
      <Card.Content class="space-y-4">
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
            Days to keep stats and incident history. Set to 0 to keep forever.
          </p>
        </div>
      </Card.Content>

      <Separator class="my-0" />

      <Card.Content>
        <SwitchCard
          class="border-none bg-transparent! shadow-none p-0"
          id="show-disabled-agents"
          title="Show disabled agents in dashboard"
          description="Include data from disabled agents in dashboard charts and KPIs. Historical data is preserved even when disabled."
          checked={showDisabledAgents}
          onCheckedChange={handleShowDisabledAgentsChange}
        />
      </Card.Content>
    </Card.Root>
  </div>
{/if}
