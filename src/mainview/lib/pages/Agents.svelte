<script lang="ts">
  import { router, push } from "@bmlt-enabled/svelte-spa-router";
  import AgentList from "$lib/components/agents/AgentList.svelte";
  import AgentForm from "$lib/components/agents/AgentForm.svelte";
  import { previousRoute } from "$lib/services/navigationStore";

  let currentPath = $state(router.location);

  $effect(() => {
    currentPath = router.location;
  });

  let agentId = $derived.by(() => {
    const match = currentPath.match(/^\/agents\/(\d+)$/);
    return match ? parseInt(match[1], 10) : undefined;
  });

  let view = $derived.by(() => {
    if (currentPath === "/agents/add") return "add";
    if (currentPath.match(/^\/agents\/\d+$/) && agentId !== undefined) return "edit";
    return "list";
  });

  let prevPath = $derived($previousRoute);

  function navigate(path: string) {
    push(path);
  }
</script>

{#if view === "add"}
  <AgentForm {prevPath} onNavigate={navigate} />
{:else if view === "edit" && agentId !== undefined}
  <AgentForm {prevPath} {agentId} onNavigate={navigate} />
{:else}
  <AgentList {prevPath} onNavigate={navigate} />
{/if}
