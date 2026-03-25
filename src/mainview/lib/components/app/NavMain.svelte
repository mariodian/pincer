<script lang="ts">
  import { Button } from "$lib/components/ui/button/index.js";
  import * as Sidebar from "$lib/components/ui/sidebar/index.js";
  import { currentRoute } from "$lib/services/navigationStore";
  import { link, push } from "@bmlt-enabled/svelte-spa-router";
  import { Add01Icon } from "@hugeicons/core-free-icons";
  import type { IconSvgElement } from "@hugeicons/svelte";
  import { HugeiconsIcon } from "@hugeicons/svelte";

  let {
    items,
  }: { items: { title: string; url: string; icon: IconSvgElement }[] } =
    $props();

  let currentLocation = $derived($currentRoute);

  function isActive(url: string): boolean {
    if (url === "/") {
      return currentLocation === "/";
    }
    return currentLocation === url || currentLocation.startsWith(url + "/");
  }
</script>

<Sidebar.Group>
  <Sidebar.GroupContent class="flex flex-col gap-2">
    <Sidebar.Menu>
      {#each items as item (item.title)}
        {#if item.title === "Agents"}
          <Sidebar.MenuItem class="flex items-center gap-2">
            <Sidebar.MenuButton
              class="min-w-8 duration-200 ease-linear"
              tooltipContent="Agents"
              isActive={isActive(item.url)}
            >
              {#snippet child({ props })}
                <a href={item.url} use:link {...props}>
                  <HugeiconsIcon icon={item.icon} strokeWidth={2} />
                  <span>{item.title}</span>
                </a>
              {/snippet}
            </Sidebar.MenuButton>
            <Button
              size="icon"
              class="size-8 group-data-[collapsible=icon]:opacity-0"
              variant="outline"
              onclick={() => push("/agents/add")}
            >
              <HugeiconsIcon icon={Add01Icon} strokeWidth={2} />
              <span class="sr-only">Add agent</span>
            </Button>
          </Sidebar.MenuItem>
        {:else}
          <Sidebar.MenuItem>
            <Sidebar.MenuButton
              tooltipContent={item.title}
              isActive={isActive(item.url)}
            >
              {#snippet child({ props })}
                <a href={item.url} use:link {...props}>
                  <HugeiconsIcon icon={item.icon} strokeWidth={2} />
                  <span>{item.title}</span>
                </a>
              {/snippet}
            </Sidebar.MenuButton>
          </Sidebar.MenuItem>
        {/if}
      {/each}
    </Sidebar.Menu>
  </Sidebar.GroupContent>
</Sidebar.Group>
