<script lang="ts">
  import { Button } from "$lib/components/ui/button/index.js";
  import * as Sidebar from "$lib/components/ui/sidebar/index.js";
  import type { IconSvgElement } from "@hugeicons/svelte";
  import { HugeiconsIcon } from "@hugeicons/svelte";

  let {
    items,
  }: { items: { title: string; url: string; icon: IconSvgElement }[] } =
    $props();
</script>

<Sidebar.Group>
  <Sidebar.GroupContent class="flex flex-col gap-2">
    <Sidebar.Menu>
      <Sidebar.MenuItem class="flex items-center gap-2">
        <Sidebar.MenuButton
          class="bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground active:bg-primary/90 active:text-primary-foreground min-w-8 duration-200 ease-linear"
          tooltipContent="Quick create"
        >
          <!-- <CirclePlusFilledIcon /> -->
          <span>Quick Create</span>
        </Sidebar.MenuButton>
        <Button
          size="icon"
          class="size-8 group-data-[collapsible=icon]:opacity-0"
          variant="outline"
        >
          <!-- <MailIcon /> -->
          <span class="sr-only">Inbox</span>
        </Button>
      </Sidebar.MenuItem>
    </Sidebar.Menu>
    <Sidebar.Menu>
      {#each items as item (item.title)}
        <Sidebar.MenuItem>
          <Sidebar.MenuButton tooltipContent={item.title}>
            {#snippet child({ props })}
              <a href={item.url} {...props}>
                <HugeiconsIcon icon={item.icon} strokeWidth={2} />
                <span>{item.title}</span>
              </a>
            {/snippet}
            <!-- {#if item.icon}
              <item.icon />
            {/if} -->
            <span>{item.title}</span>
          </Sidebar.MenuButton>
        </Sidebar.MenuItem>
      {/each}
    </Sidebar.Menu>
  </Sidebar.GroupContent>
</Sidebar.Group>
