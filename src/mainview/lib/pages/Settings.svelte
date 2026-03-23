<script lang="ts">
  import { PageHeader } from "$lib/components/ui/page-header/index.js";
  import * as Tabs from "$lib/components/ui/tabs";
  import { previousRoute } from "$lib/services/navigationStore";
  import { router } from "@bmlt-enabled/svelte-spa-router";
  import SettingsGeneral from "./settings/SettingsGeneral.svelte";

  let currentPath = $state(router.location);

  $effect(() => {
    currentPath = router.location;
  });

  let prevPath = $derived($previousRoute);

  let activeTab = $state("general");
  let saveStatus = $state<"saving" | "saved" | "error" | null>(null);
  let fadeOut = $state(false);

  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  let fadeTimer: ReturnType<typeof setTimeout> | null = null;

  function handleSaveStatus(status: "saving" | "saved" | "error" | null) {
    if (saveTimer) clearTimeout(saveTimer);
    if (fadeTimer) clearTimeout(fadeTimer);

    fadeOut = false;
    saveStatus = status;

    if (status === "saved") {
      fadeTimer = setTimeout(() => {
        fadeOut = true;
        saveTimer = setTimeout(() => {
          saveStatus = null;
          fadeOut = false;
        }, 400);
      }, 1200);
    }
  }
</script>

<div class="flex flex-col h-full">
  <PageHeader
    title="Settings"
    description="Configure your application preferences"
    {prevPath}
    {currentPath}
  >
    {#snippet actions()}
      <div class="h-5 flex items-center">
        {#if saveStatus === "saving"}
          <span class="text-sm text-muted-foreground animate-pulse">
            Saving...
          </span>
        {:else if saveStatus === "saved"}
          <span
            class="text-sm text-green-600 dark:text-green-400 transition-opacity duration-300"
            class:opacity-0={fadeOut}
          >
            Saved ✓
          </span>
        {:else if saveStatus === "error"}
          <span class="text-sm text-destructive">Failed to save</span>
        {/if}
      </div>
    {/snippet}
  </PageHeader>

  <div class="starting:opacity-0 animate-in fade-in duration-300">
    <Tabs.Root bind:value={activeTab} class="flex-1">
      <Tabs.List class="mb-6">
        <Tabs.Trigger value="general">General</Tabs.Trigger>
        <Tabs.Trigger value="privacy">Privacy</Tabs.Trigger>
      </Tabs.List>

      <Tabs.Content value="general">
        <SettingsGeneral onSaveStatus={handleSaveStatus} />
      </Tabs.Content>

      <Tabs.Content value="privacy">
        <p class="text-sm text-muted-foreground">Coming soon.</p>
      </Tabs.Content>
    </Tabs.Root>
  </div>
</div>
