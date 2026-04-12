<script lang="ts">
  import { PageBody, PageHeader } from "$lib/components/ui/page";
  import * as Tabs from "$lib/components/ui/tabs";
  import { currentRoute, previousRoute } from "$lib/services/navigationStore";
  import SettingsAbout from "./settings/SettingsAbout.svelte";
  import SettingsAdvanced from "./settings/SettingsAdvanced.svelte";
  import SettingsGeneral from "./settings/SettingsGeneral.svelte";
  import SettingsNotifications from "./settings/SettingsNotifications.svelte";

  let currentPath = $derived($currentRoute);
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

  // Parse ?tab= parameter from URL hash
  function getTabFromUrl(): string | null {
    const hash = window.location.hash;
    const queryIndex = hash.indexOf("?");
    if (queryIndex === -1) return null;

    const queryString = hash.slice(queryIndex + 1);
    const params = new URLSearchParams(queryString);
    return params.get("tab");
  }

  // Update active tab when route changes
  $effect(() => {
    const tabFromUrl = getTabFromUrl();
    if (
      tabFromUrl === "general" ||
      tabFromUrl === "advanced" ||
      tabFromUrl === "notifications" ||
      tabFromUrl === "about"
    ) {
      activeTab = tabFromUrl;
    }
  });
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

  <PageBody>
    <Tabs.Root bind:value={activeTab} class="flex-1">
      <Tabs.List
        class={[
          "mb-6",
          "shadow-2xs shadow-white/50 inset-shadow-xs inset-shadow-black/4",
          "dark:shadow-xs dark:shadow-black/25 dark:inset-shadow-2xs dark:inset-shadow-white/2",
        ]}
      >
        <Tabs.Trigger value="general">General</Tabs.Trigger>
        <Tabs.Trigger value="advanced">Advanced</Tabs.Trigger>
        <Tabs.Trigger value="notifications">Notifications</Tabs.Trigger>
        <Tabs.Trigger value="about">About</Tabs.Trigger>
      </Tabs.List>

      <Tabs.Content value="general">
        <SettingsGeneral onSaveStatus={handleSaveStatus} />
      </Tabs.Content>

      <Tabs.Content value="advanced">
        <SettingsAdvanced onSaveStatus={handleSaveStatus} />
      </Tabs.Content>

      <Tabs.Content value="notifications">
        <SettingsNotifications onSaveStatus={handleSaveStatus} />
      </Tabs.Content>

      <Tabs.Content value="about">
        <SettingsAbout />
      </Tabs.Content>
    </Tabs.Root>
  </PageBody>
</div>
