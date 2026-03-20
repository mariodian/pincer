<script lang="ts">
  import * as DropdownMenu from "$lib/components/ui/dropdown-menu";
  import * as Sidebar from "$lib/components/ui/sidebar";
  import type { WithoutChildren } from "$lib/utils";
  import { MoonIcon, SunIcon } from "@hugeicons/core-free-icons";
  import type { IconSvgElement } from "@hugeicons/svelte";
  import { HugeiconsIcon } from "@hugeicons/svelte";
  import { resetMode, setMode } from "mode-watcher";
  import type { ComponentProps } from "svelte";
  import { buttonVariants } from "../ui/button";

  let {
    items,
    ...restProps
  }: {
    items: { title: string; url: string; icon: IconSvgElement }[];
  } & WithoutChildren<ComponentProps<typeof Sidebar.Group>> = $props();
</script>

<Sidebar.Group {...restProps}>
  <Sidebar.GroupContent>
    <Sidebar.Menu>
      {#each items as item (item.title)}
        {#if item.title === "Settings"}
          <Sidebar.MenuItem class="flex items-center gap-2">
            <Sidebar.MenuButton
              class="min-w-8 duration-200 ease-linear"
              tooltipContent="Quick create"
            >
              {#snippet child({ props })}
                <a href={item.url} {...props}>
                  <HugeiconsIcon icon={item.icon} strokeWidth={2} />
                  <span>{item.title}</span>
                </a>
              {/snippet}
            </Sidebar.MenuButton>
            <DropdownMenu.Root>
              <DropdownMenu.Trigger
                class={[
                  buttonVariants({ variant: "outline", size: "icon-sm" }),
                ]}
              >
                <HugeiconsIcon
                  icon={SunIcon}
                  strokeWidth={2}
                  class="h-[1.2rem] w-[1.2rem] scale-100 rotate-0 !transition-all dark:scale-0 dark:-rotate-90"
                />
                <HugeiconsIcon
                  icon={MoonIcon}
                  strokeWidth={2}
                  class="absolute h-[1.2rem] w-[1.2rem] scale-0 rotate-90 !transition-all dark:scale-100 dark:rotate-0"
                />
                <span class="sr-only">Toggle theme</span>
              </DropdownMenu.Trigger>
              <DropdownMenu.Content align="end">
                <DropdownMenu.Item onclick={() => setMode("light")}
                  >Light</DropdownMenu.Item
                >
                <DropdownMenu.Item onclick={() => setMode("dark")}
                  >Dark</DropdownMenu.Item
                >
                <DropdownMenu.Item onclick={() => resetMode()}
                  >System</DropdownMenu.Item
                >
              </DropdownMenu.Content>
            </DropdownMenu.Root>
          </Sidebar.MenuItem>
        {:else}
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
        {/if}
      {/each}
    </Sidebar.Menu>
  </Sidebar.GroupContent>
</Sidebar.Group>
