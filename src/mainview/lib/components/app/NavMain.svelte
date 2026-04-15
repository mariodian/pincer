<script lang="ts">
  import { Button } from "$lib/components/ui/button/index.js";
  import { Icon } from "$lib/components/ui/icon/index.js";
  import { useSidebar } from "$lib/components/ui/sidebar";
  import * as Sidebar from "$lib/components/ui/sidebar/index.js";
  import type { IconName } from "$lib/icons/icon-registry.js";
  import { currentRoute } from "$lib/services/navigationStore";
  import { isActiveUrl } from "$lib/utils/url.js";
  import { link, push } from "@bmlt-enabled/svelte-spa-router";

  let { items }: { items: { title: string; url: string; icon: IconName }[] } =
    $props();

  let currentLocation = $derived($currentRoute);
  const sidebar = useSidebar();
</script>

<Sidebar.Group>
  <Sidebar.GroupContent class="flex flex-col gap-2">
    <Sidebar.Menu>
      {#each items as item (item.title)}
        {#if item.title === "Agents"}
          <Sidebar.MenuItem class="flex items-center gap-2">
            <Sidebar.MenuButton
              class={["min-w-8 duration-200 ease-linear"]}
              tooltipContent="Agents"
              isActive={isActiveUrl(currentLocation, item.url)}
            >
              {#snippet child({ props })}
                <a href={item.url} use:link {...props}>
                  <Icon name={item.icon} />
                  <span>{item.title}</span>
                </a>
              {/snippet}
            </Sidebar.MenuButton>
            <Button
              tabindex={sidebar.state === "collapsed" ? -1 : 0}
              size="icon"
              class={[
                "size-8 group-data-[collapsible=icon]:opacity-0",
                "border-input bg-primary-foreground/70 hover:bg-primary-foreground",
              ]}
              variant="outline"
              onclick={() => push("/agents/add")}
            >
              <Icon name="add" />
              <span class="sr-only">Add agent</span>
            </Button>
          </Sidebar.MenuItem>
        {:else}
          <Sidebar.MenuItem>
            <Sidebar.MenuButton
              tooltipContent={item.title}
              isActive={isActiveUrl(currentLocation, item.url)}
            >
              {#snippet child({ props })}
                <a href={item.url} use:link {...props}>
                  <Icon name={item.icon} />
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
