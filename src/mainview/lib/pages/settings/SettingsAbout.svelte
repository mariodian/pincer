<script lang="ts">
  import * as Alert from "$lib/components/ui/alert";
  import { Button } from "$lib/components/ui/button";
  import * as Card from "$lib/components/ui/card";
  import { Icon } from "$lib/components/ui/icon";
  import { Label } from "$lib/components/ui/label";
  import { Skeleton } from "$lib/components/ui/skeleton";
  import { Spinner } from "$lib/components/ui/spinner";
  import { getMainRPC, whenReady } from "$lib/services/mainRPC";
  import { cn } from "$lib/utils";
  import icon from "../../../../../icons/icon.iconset/icon_256x256.png";

  interface UpdateInfo {
    version: string;
    hash: string;
    channel: string;
    lastCheckTimestamp: number | null;
    updateAvailable: boolean;
    newVersion?: string;
    newHash?: string;
  }

  interface UpdateCheckResult {
    updateAvailable: boolean;
    version?: string;
    hash?: string;
    message: string;
  }

  const RELEASE_NOTES_URL =
    "https://github.com/mariodian/pincer/blob/main/CHANGELOG.md";

  let loading = $state(true);
  let checking = $state(false);
  let downloading = $state(false);
  let updateInfo = $state<UpdateInfo | null>(null);
  let checkResult = $state<UpdateCheckResult | null>(null);
  let error = $state<string | null>(null);

  async function loadUpdateInfo() {
    try {
      await whenReady();
      const rpc = getMainRPC();
      updateInfo = await rpc.request.getUpdateInfo({});
      error = null;
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to load update info";
      console.error("Failed to load update info:", err);
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    loadUpdateInfo();
  });

  async function handleCheckForUpdate() {
    checking = true;
    checkResult = null;
    error = null;

    try {
      const rpc = getMainRPC();
      const result = await rpc.request.checkForUpdate({});
      checkResult = result;

      // Reload update info to get latest timestamp
      await loadUpdateInfo();
    } catch (err) {
      error =
        err instanceof Error ? err.message : "Failed to check for updates";
      console.error("Failed to check for update:", err);
    } finally {
      checking = false;
    }
  }

  async function handleDownloadAndApply() {
    downloading = true;
    error = null;

    try {
      const rpc = getMainRPC();
      const result = await rpc.request.downloadAndApplyUpdate({});

      if (!result.success) {
        error = "Failed to download and apply update";
      }
      // If successful, the app will restart, so we don't need to do anything
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to download update";
      console.error("Failed to download/apply update:", err);
    } finally {
      downloading = false;
    }
  }

  async function handleOpenReleaseNotes(event: MouseEvent) {
    event.preventDefault();

    try {
      await whenReady();
      const rpc = getMainRPC();
      const result = await rpc.request.openExternalUrl({
        url: RELEASE_NOTES_URL,
      });

      if (!result.success) {
        error = "Could not open release notes in your default browser";
      }
    } catch (err) {
      error =
        err instanceof Error
          ? err.message
          : "Could not open release notes in your default browser";
      console.error("Failed to open release notes:", err);
    }
  }

  function formatLastCheck(timestamp: number | null): string {
    if (!timestamp) return "Never checked";

    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days} day${days === 1 ? "" : "s"} ago`;
    if (hours > 0) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
    if (minutes > 0) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
    return "Just now";
  }

  function getChannelColor(channel: string): string {
    switch (channel.toLowerCase()) {
      case "stable":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
      case "beta":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
      case "canary":
        return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400";
      case "dev":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400";
      default:
        return "bg-muted text-muted-foreground";
    }
  }
</script>

{#if loading}
  <div class="space-y-6 max-w-lg">
    <div class="space-y-2">
      <Skeleton class="h-8 w-48" />
      <Skeleton class="h-4 w-64" />
    </div>
    <Skeleton class="h-px w-full" />
    <div class="space-y-2">
      <Skeleton class="h-5 w-32" />
      <Skeleton class="h-10 w-40" />
    </div>
  </div>
{:else if updateInfo}
  <div class="space-y-6 max-w-lg">
    <Card.Root>
      <Card.Header>
        <Card.Title class="flex items-center justify-center flex-col">
          <img src={icon} alt="Pincer Icon" class="h-24 w-24 drop-shadow-sm" />
          <div class="flex items-center gap-3 mt-4">
            <h2 class="text-xl font-semibold">Pincer</h2>

            <span
              class="px-2 py-0.5 text-xs font-medium rounded-full {getChannelColor(
                updateInfo.channel,
              )}"
            >
              {updateInfo.channel}
            </span>
          </div>
          <p>A fast multi-platform agent monitoring utility</p>
        </Card.Title>
        <Card.Description class="text-center">
          <p class="text-sm text-muted-foreground">
            Version {updateInfo.version} ({updateInfo.hash.slice(0, 8)})
          </p>
        </Card.Description>
      </Card.Header>
      <Card.Content class="space-y-4">
        <div class="flex items-center justify-between">
          <div class="space-y-1">
            <Label class="text-base">Updates</Label>
            <p class="text-xs text-muted-foreground">
              Last checked: {formatLastCheck(updateInfo.lastCheckTimestamp)}
            </p>
          </div>

          <!-- Check Button -->
          <Button
            variant="outline"
            onclick={handleCheckForUpdate}
            disabled={checking}
            class="gap-2"
          >
            {#if checking}
              <Spinner class="size-4" />
              Checking...
            {:else}
              Check for Updates
            {/if}
          </Button>
        </div>

        <!-- Check Result Message -->
        {#if checkResult && !checkResult.updateAvailable}
          <Alert.Root>
            <Icon name="checkCircle" class="size-4" />
            <Alert.Title>{checkResult.message}</Alert.Title>
            <Alert.Description>
              <a
                href={RELEASE_NOTES_URL}
                target="_blank"
                rel="noopener noreferrer"
                onclick={handleOpenReleaseNotes}>Release Notes</a
              >
            </Alert.Description>
          </Alert.Root>
        {/if}

        {#if updateInfo.updateAvailable && updateInfo.newVersion}
          <div
            class={cn(
              "p-4 rounded-lg border",
              "border-green-300/50 bg-green-300/30",
              "dark:border-green-900/70 dark:bg-green-900/50",
              "text-green-950/80 dark:text-green-100/80",
            )}
          >
            <div class="flex items-center gap-2 mb-2">
              <Icon
                name="checkCircle"
                class="size-5 text-green-950/80 dark:text-green-100/80"
              />
              <span class="font-medium">Update Available</span>
            </div>
            <p class="text-sm text-green-950/60 dark:text-green-100/60 mb-3">
              Version {updateInfo.newVersion} is ready to download and install.
            </p>
            <Button
              onclick={handleDownloadAndApply}
              disabled={downloading}
              class="gap-2"
            >
              {#if downloading}
                <Spinner class="size-4" />
                Downloading...
              {:else}
                <Icon name="download" class="size-4" />
                Download & Install
              {/if}
            </Button>
          </div>
        {/if}

        <!-- Error Message -->
        {#if error}
          <Alert.Root variant="destructive">
            <Icon name="alertCircle" class="size-4" />
            <Alert.Title>Error</Alert.Title>
            <Alert.Description>{error}</Alert.Description>
          </Alert.Root>
        {/if}
      </Card.Content>
    </Card.Root>
  </div>
{/if}
