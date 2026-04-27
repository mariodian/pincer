<script lang="ts">
  import type { AdvancedSettings, Platform } from "$shared/types";

  import * as Card from "$lib/components/ui/card";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import { Separator } from "$lib/components/ui/separator";
  import { Skeleton } from "$lib/components/ui/skeleton";
  import { SwitchCard } from "$lib/components/ui/switch-card";
  import { getMainRPC, whenReady } from "$lib/services/mainRPC";

  interface Props {
    onSaveStatus: (status: "saving" | "saved" | "error" | null) => void;
  }

  let { onSaveStatus }: Props = $props();

  let loading = $state(true);
  let pollingIntervalSec = $state(30);
  let savedPollingIntervalSec = $state(30);
  let autoCheckUpdate = $state(true);
  let useNativeTray = $state(false);
  let platform = $state<Platform | "">("");

  async function loadSettings() {
    try {
      await whenReady();
      const rpc = getMainRPC();
      const settings: AdvancedSettings = await rpc.request.getAdvancedSettings(
        {},
      );
      const platformResult = await rpc.request.getPlatform({});

      pollingIntervalSec = Math.round(settings.pollingInterval / 1000);
      savedPollingIntervalSec = pollingIntervalSec;
      autoCheckUpdate = settings.autoCheckUpdate;
      useNativeTray = settings.useNativeTray;
      platform = platformResult.os;
    } catch (error) {
      console.error("Failed to load advanced settings:", error);
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    loadSettings();
  });

  async function saveAdvancedSettings(updates: Partial<AdvancedSettings>) {
    onSaveStatus("saving");
    try {
      const rpc = getMainRPC();
      await rpc.request.updateAdvancedSettings(updates);
      onSaveStatus("saved");
    } catch (error) {
      console.error("Failed to save advanced settings:", error);
      onSaveStatus("error");
    }
  }

  async function handlePollingBlur() {
    const val = Math.max(1, Math.round(pollingIntervalSec));
    pollingIntervalSec = val;

    if (val === savedPollingIntervalSec) return;

    savedPollingIntervalSec = val;
    await saveAdvancedSettings({ pollingInterval: val * 1000 });
  }

  function handlePollingKeydown(e: KeyboardEvent) {
    if (e.key === "Enter") {
      (e.target as HTMLInputElement).blur();
    }
  }

  async function handleAutoCheckChange(checked: boolean) {
    onSaveStatus("saving");
    try {
      const rpc = getMainRPC();
      await rpc.request.setAutoCheck({ enabled: checked });
      autoCheckUpdate = checked;
      onSaveStatus("saved");
    } catch (error) {
      console.error("Failed to save auto-check setting:", error);
      onSaveStatus("error");
    }
  }

  async function handleUseNativeTrayChange(checked: boolean) {
    useNativeTray = checked;
    await saveAdvancedSettings({ useNativeTray: checked });
  }
</script>

{#if loading}
  <div class="max-w-lg space-y-6">
    <div class="space-y-2">
      <Skeleton class="h-4 w-32" />
      <Skeleton class="h-9 w-full" />
      <Skeleton class="h-3 w-48" />
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
        <Skeleton class="h-4 w-32" />
        <Skeleton class="h-3 w-56" />
      </div>
      <Skeleton class="h-4.5 w-8 rounded-full" />
    </div>
  </div>
{:else}
  <div class="max-w-lg space-y-6">
    <h3 class="mb-2 font-medium">System</h3>
    <Card.Root>
      <Card.Content>
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
          <p class="text-muted-foreground text-xs">
            How often to check agent health status.
          </p>
        </div>
      </Card.Content>

      <Separator class="my-0" />

      <Card.Content>
        <SwitchCard
          class="border-none bg-transparent! p-0 shadow-none"
          id="use-native-tray"
          title="Use native tray"
          description={platform === "linux"
            ? "Linux always uses native tray. Custom tray popover is not supported due to libayatana-appindicator limitations."
            : "Native tray integrates better with your platform's appearance but the custom tray offers a more polished design. Restart required for changes to take effect."}
          checked={platform === "linux" ? true : useNativeTray}
          onCheckedChange={handleUseNativeTrayChange}
          disabled={platform === "linux"}
        />
      </Card.Content>
    </Card.Root>

    <h3 class="mb-2 font-medium">Updates</h3>

    <Card.Root>
      <Card.Content>
        <SwitchCard
          class="border-none bg-transparent! p-0 shadow-none"
          id="auto-check-updates"
          title="Automatically check for updates"
          description="Check for new versions once a day when the app starts."
          checked={autoCheckUpdate}
          onCheckedChange={handleAutoCheckChange}
        />
      </Card.Content>
    </Card.Root>
  </div>
{/if}
