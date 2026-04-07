<script lang="ts">
  import * as Card from "$lib/components/ui/card";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import { Separator } from "$lib/components/ui/separator";

  import { Skeleton } from "$lib/components/ui/skeleton";
  import { SwitchCard } from "$lib/components/ui/switch-card";
  import { getMainRPC, whenReady } from "$lib/services/mainRPC";
  import type { AdvancedSettings } from "$shared/types";

  interface Props {
    onSaveStatus: (status: "saving" | "saved" | "error" | null) => void;
  }

  let { onSaveStatus }: Props = $props();

  let loading = $state(true);
  let pollingIntervalSec = $state(30);
  let savedPollingIntervalSec = $state(30);
  let autoCheckEnabled = $state(true);
  let useNativeTray = $state(false);

  async function loadSettings() {
    try {
      await whenReady();
      const rpc = getMainRPC();
      const settings: AdvancedSettings = await rpc.request.getAdvancedSettings(
        {},
      );

      pollingIntervalSec = Math.round(settings.pollingInterval / 1000);
      savedPollingIntervalSec = pollingIntervalSec;
      autoCheckEnabled = settings.autoCheckEnabled;
      useNativeTray = settings.useNativeTray;
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
      autoCheckEnabled = checked;
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
  <div class="space-y-6 max-w-lg">
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
  <div class="space-y-6 max-w-lg">
    <h3 class="font-medium mb-2">System</h3>
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
          <p class="text-xs text-muted-foreground">
            How often to check agent health status.
          </p>
        </div>
      </Card.Content>

      <Separator class="my-0" />

      <Card.Content>
        <SwitchCard
          class="border-none bg-transparent! shadow-none p-0"
          id="use-native-tray"
          title="Use native tray"
          description="Native tray integrates better with your platform's appearance but the custom tray offers a more polished design. Restart required for changes to take effect."
          checked={useNativeTray}
          onCheckedChange={handleUseNativeTrayChange}
        />
      </Card.Content>
    </Card.Root>

    <h3 class="font-medium mb-2">Updates</h3>

    <Card.Root>
      <Card.Content>
        <SwitchCard
          class="border-none bg-transparent! shadow-none p-0"
          id="auto-check-updates"
          title="Automatically check for updates"
          description="Check for new versions once a day when the app starts."
          checked={autoCheckEnabled}
          onCheckedChange={handleAutoCheckChange}
        />
      </Card.Content>
    </Card.Root>
  </div>
{/if}
