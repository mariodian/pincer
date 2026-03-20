<script lang="ts">
  import { Button } from "$lib/components/ui/button/index.js";
  import * as Sidebar from "$lib/components/ui/sidebar/index.js";
  import type { WithoutChildren } from "$lib/utils.js";
  import { MoonIcon, SunIcon } from "@hugeicons/core-free-icons";
  import type { IconSvgElement } from "@hugeicons/svelte";
  import { HugeiconsIcon } from "@hugeicons/svelte";
  import type { ComponentProps } from "svelte";

  import { toggleMode } from "mode-watcher";
  let {
    items,
    ...restProps
  }: {
    items: { title: string; url: string; icon: IconSvgElement }[];
  } & WithoutChildren<ComponentProps<typeof Sidebar.Group>> = $props();
</script>

<Sidebar.Group {...restProps}>
  <Sidebar.GroupContent>
    <Button onclick={toggleMode} variant="outline" size="icon">
      <HugeiconsIcon
        icon={SunIcon}
        strokeWidth={2}
        class="h-[1.2rem] w-[1.2rem] scale-100 rotate-0 !transition-all dark:scale-0 dark:-rotate-90"
      />
      <HugeiconsIcon
        icon={MoonIcon}
        strokeWidth={2}
        class="bsolute h-[1.2rem] w-[1.2rem] scale-0 rotate-90 !transition-all dark:scale-100 dark:rotate-0"
      />
      <!-- <SunIcon
              class="h-[1.2rem] w-[1.2rem] scale-100 rotate-0 !transition-all dark:scale-0 dark:-rotate-90"
            />
            <MoonIcon
              class="absolute h-[1.2rem] w-[1.2rem] scale-0 rotate-90 !transition-all dark:scale-100 dark:rotate-0"
            /> -->
      <span class="sr-only">Toggle theme</span>
    </Button>
    <Sidebar.Menu>
      {#each items as item (item.title)}
        <Sidebar.MenuItem>
          <Sidebar.MenuButton>
            {#snippet child({ props })}
              <a href={item.url} {...props}>
                <HugeiconsIcon icon={item.icon} strokeWidth={2} />
                <span>{item.title}</span>
              </a>
            {/snippet}
          </Sidebar.MenuButton>
        </Sidebar.MenuItem>
      {/each}
    </Sidebar.Menu>
  </Sidebar.GroupContent>
</Sidebar.Group>
