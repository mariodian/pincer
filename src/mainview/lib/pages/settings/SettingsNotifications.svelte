<script lang="ts">
  import * as Card from "$lib/components/ui/card";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import Separator from "$lib/components/ui/separator/separator.svelte";
  import { Skeleton } from "$lib/components/ui/skeleton";
  import { SwitchCard } from "$lib/components/ui/switch-card";
  import { getMainRPC, whenReady } from "$lib/services/mainRPC";
  import type { NotificationSettings } from "$shared/types";

  interface Props {
    onSaveStatus: (status: "saving" | "saved" | "error" | null) => void;
  }

  let { onSaveStatus }: Props = $props();

  let loading = $state(true);

  // Form state
  let notificationsEnabled = $state(true);
  let notifyOnStatusChange = $state(true);
  let notifyOnError = $state(true);
  let statusChangeThreshold = $state(1);
  let silentNotifications = $state(false);

  // Track last-saved values to detect changes on blur
  let savedStatusChangeThreshold = $state(1);

  async function loadSettings() {
    try {
      await whenReady();
      const rpc = getMainRPC();
      const settings: NotificationSettings =
        await rpc.request.getNotificationSettings({});

      notificationsEnabled = settings.notificationsEnabled;
      notifyOnStatusChange = settings.notifyOnStatusChange;
      notifyOnError = settings.notifyOnError;
      statusChangeThreshold = settings.statusChangeThreshold;
      silentNotifications = settings.silentNotifications;

      savedStatusChangeThreshold = statusChangeThreshold;
    } catch (error) {
      console.error("Failed to load notification settings:", error);
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    loadSettings();
  });

  async function saveField(updates: Partial<NotificationSettings>) {
    onSaveStatus("saving");
    try {
      const rpc = getMainRPC();
      await rpc.request.updateNotificationSettings(updates);
      onSaveStatus("saved");
    } catch (error) {
      console.error("Failed to save notification settings:", error);
      onSaveStatus("error");
    }
  }

  async function handleNotificationsEnabledChange(checked: boolean) {
    notificationsEnabled = checked;
    await saveField({ notificationsEnabled: checked });

    // Request notification permission when enabling
    if (checked) {
      try {
        const rpc = getMainRPC();
        await rpc.request.requestNotificationPermission({});
      } catch (error) {
        console.error("Failed to request notification permission:", error);
      }
    }
  }

  async function handleNotifyOnStatusChangeChange(checked: boolean) {
    notifyOnStatusChange = checked;
    await saveField({ notifyOnStatusChange: checked });
  }

  async function handleNotifyOnErrorChange(checked: boolean) {
    notifyOnError = checked;
    await saveField({ notifyOnError: checked });
  }

  async function handleSilentNotificationsChange(checked: boolean) {
    silentNotifications = checked;
    await saveField({ silentNotifications: checked });
  }

  async function handleThresholdBlur() {
    const val = Math.max(1, Math.round(statusChangeThreshold));
    statusChangeThreshold = val;

    if (val === savedStatusChangeThreshold) return;

    savedStatusChangeThreshold = val;
    await saveField({ statusChangeThreshold: val });
  }

  function handleThresholdKeydown(e: KeyboardEvent) {
    if (e.key === "Enter") {
      (e.target as HTMLInputElement).blur();
    }
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
        <Skeleton class="h-4 w-48" />
        <Skeleton class="h-3 w-64" />
      </div>
      <Skeleton class="h-4.5 w-8 rounded-full" />
    </div>
  </div>
{:else}
  <div class="space-y-6 max-w-lg">
    <h3 class="font-medium mb-2">General</h3>
    <Card.Root>
      <Card.Content>
        <SwitchCard
          class="border-none bg-transparent! shadow-none p-0"
          id="notifications-enabled"
          title="Enable notifications"
          description="Receive native system notifications when your monitored agents change status. The system will ask for permission the first time you enable this."
          checked={notificationsEnabled}
          onCheckedChange={handleNotificationsEnabledChange}
        />
      </Card.Content>
    </Card.Root>

    {#if notificationsEnabled}
      <h3 class="font-medium mb-2">Notification Triggers</h3>
      <Card.Root>
        <Card.Content>
          <SwitchCard
            class="border-none bg-transparent! shadow-none p-0"
            id="notify-on-status-change"
            title="Status changes"
            description="Get notified when any of your agents changes status, whether it goes online, offline, or encounters an error. Useful for staying informed about your infrastructure health."
            checked={notifyOnStatusChange}
            onCheckedChange={handleNotifyOnStatusChangeChange}
          />
        </Card.Content>

        <Separator class="my-0" />

        <Card.Content>
          <SwitchCard
            disabled={notifyOnStatusChange}
            class="border-none bg-transparent! shadow-none p-0"
            id="notify-on-error"
            title="Error alerts"
            description={notifyOnStatusChange
              ? "Already covered by status changes notifications. Disable status changes above to enable error-only alerts."
              : "Receive notifications only when an agent enters an error state. Enable this if you want to be alerted to issues without getting notified for every status change."}
            checked={notifyOnError}
            onCheckedChange={handleNotifyOnErrorChange}
          />
        </Card.Content>

        <Separator class="my-0" />

        <Card.Content>
          <div class="space-y-2">
            <Label for="status-change-threshold">Status change threshold</Label>
            <Input
              id="status-change-threshold"
              type="number"
              min="1"
              bind:value={statusChangeThreshold}
              onblur={handleThresholdBlur}
              onkeydown={handleThresholdKeydown}
              class="w-20"
            />
            <p class="text-xs text-muted-foreground">
              Polling rounds before a status change is confirmed. When any agent
              in a group (e.g., all going "online") reaches this threshold, all
              agents in that group notify together. Batches notifications for
              agents changing to the same status.
            </p>
          </div>
        </Card.Content>
      </Card.Root>

      <h3 class="font-medium mb-2">Sound</h3>
      <Card.Root>
        <Card.Content>
          <SwitchCard
            class="border-none bg-transparent! shadow-none p-0"
            id="silent-notifications"
            title="Silent notifications"
            description="Show notifications without playing a sound. Useful in quiet environments or when you don't want to disturb others with notification sounds."
            checked={silentNotifications}
            onCheckedChange={handleSilentNotificationsChange}
          />
        </Card.Content>
      </Card.Root>
    {/if}
  </div>
{/if}
