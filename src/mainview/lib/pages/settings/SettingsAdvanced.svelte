<script lang="ts">
  import { Skeleton } from "$lib/components/ui/skeleton/index.js";
  import { SwitchCard } from "$lib/components/ui/switch-card/index.js";
  import { getMainRPC, whenReady } from "$lib/services/mainRPC";

  interface Props {
    onSaveStatus: (status: "saving" | "saved" | "error" | null) => void;
  }

  let { onSaveStatus }: Props = $props();

  let loading = $state(true);
  let autoCheckEnabled = $state(true);
  let useNativeTray = $state(false);

  async function loadSettings() {
    try {
      await whenReady();
      const rpc = getMainRPC();
      const [updateInfo, settings] = await Promise.all([
        rpc.request.getUpdateInfo({}),
        rpc.request.getSettings({}),
      ]);
      autoCheckEnabled = updateInfo.autoCheckEnabled;
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
    onSaveStatus("saving");
    try {
      const rpc = getMainRPC();
      await rpc.request.updateSettings({ useNativeTray: checked });
      useNativeTray = checked;
      onSaveStatus("saved");
    } catch (error) {
      console.error("Failed to save tray setting:", error);
      onSaveStatus("error");
    }
  }
</script>

{#if loading}
  <div class="space-y-6 max-w-lg">
    <div class="flex items-center justify-between">
      <div class="space-y-2">
        <Skeleton class="h-4 w-48" />
        <Skeleton class="h-3 w-64" />
      </div>
      <Skeleton class="h-[18px] w-[32px] rounded-full" />
    </div>
    <div class="flex items-center justify-between">
      <div class="space-y-2">
        <Skeleton class="h-4 w-32" />
        <Skeleton class="h-3 w-56" />
      </div>
      <Skeleton class="h-[18px] w-[32px] rounded-full" />
    </div>
  </div>
{:else}
  <div class="space-y-6 max-w-lg">
    <SwitchCard
      id="auto-check-updates"
      title="Automatically check for updates"
      description="Check for new versions once a day when the app starts."
      checked={autoCheckEnabled}
      onCheckedChange={handleAutoCheckChange}
    />
    <SwitchCard
      id="use-native-tray"
      title="Use native tray"
      description="Native tray integrates better with your platform's appearance but the custom tray offers a more polished design. Restart required for changes to take effect."
      checked={useNativeTray}
      onCheckedChange={handleUseNativeTrayChange}
    />
  </div>
{/if}
