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

  async function loadSettings() {
    try {
      await whenReady();
      const rpc = getMainRPC();
      const updateInfo = await rpc.request.getUpdateInfo({});
      autoCheckEnabled = updateInfo.autoCheckEnabled;
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
  </div>
{/if}
