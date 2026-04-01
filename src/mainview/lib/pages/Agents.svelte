<script lang="ts">
  import AgentForm from "$lib/components/agents/AgentForm.svelte";
  import AgentList from "$lib/components/agents/AgentList.svelte";
  import { currentRoute, previousRoute } from "$lib/services/navigationStore";
  import { push } from "@bmlt-enabled/svelte-spa-router";

  let currentPath = $derived($currentRoute);

  let agentId = $derived.by(() => {
    const match = currentPath.match(/^\/agents\/(\d+)$/);
    return match ? parseInt(match[1], 10) : undefined;
  });

  let view = $derived.by(() => {
    if (currentPath === "/agents/add") return "add";
    if (currentPath.match(/^\/agents\/\d+$/) && agentId !== undefined)
      return "edit";
    return "list";
  });

  let prevPath = $derived($previousRoute);

  function navigate(path: string) {
    push(path);
  }
</script>

{#key currentPath}
  {#if view === "add"}
    <AgentForm {prevPath} {currentPath} onNavigate={navigate} />
  {:else if view === "edit" && agentId !== undefined}
    <AgentForm {prevPath} {currentPath} {agentId} onNavigate={navigate} />
  {:else}
    <AgentList {prevPath} {currentPath} onNavigate={navigate} />
  {/if}
{/key}
