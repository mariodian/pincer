<script lang="ts">
  import * as DropdownMenu from "$lib/components/ui/dropdown-menu";
  import * as Sidebar from "$lib/components/ui/sidebar";
  import { useSidebar } from "$lib/components/ui/sidebar";
  import type { WithoutChildren } from "$lib/utils";
  import { MoonIcon, SunIcon } from "@hugeicons/core-free-icons";
  import type { IconSvgElement } from "@hugeicons/svelte";
  import { HugeiconsIcon } from "@hugeicons/svelte";
  import { resetMode, setMode } from "mode-watcher";
  import type { ComponentProps } from "svelte";

  const sidebar = useSidebar();
  let shouldFlex = $state(false);

  $effect(() => {
    console.log("Sidebar state:", sidebar.state);
    if (sidebar.state === "collapsed") {
      setTimeout(() => {
        shouldFlex = true;
      }, 150);
    } else {
      shouldFlex = false;
    }
  });

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
              tooltipContent={item.title}
            >
              {#snippet child({ props })}
                <a href={item.url} {...props}>
                  <HugeiconsIcon icon={item.icon} strokeWidth={2} />
                  <span>{item.title}</span>
                </a>
              {/snippet}
            </Sidebar.MenuButton>
          </Sidebar.MenuItem>

          <div class="transition-all duration-150">
            <Sidebar.MenuItem class="flex items-center gap-2">
              <DropdownMenu.Root>
                <DropdownMenu.Trigger
                  class="flex-1 group-sidebar-expanded/settings:flex-1"
                >
                  <Sidebar.MenuButton
                    class="min-w-8 duration-200 ease-linear"
                    tooltipContent="Toggle theme"
                  >
                    {#snippet child({ props })}
                      <div {...props}>
                        <HugeiconsIcon
                          icon={SunIcon}
                          strokeWidth={2}
                          class={[
                            "h-[1.2rem] w-[1.2rem] scale-100 rotate-0 transition-all!",
                            "dark:scale-0 dark:-rotate-90",
                          ].join(" ")}
                        />
                        <HugeiconsIcon
                          icon={MoonIcon}
                          strokeWidth={2}
                          class={[
                            "absolute h-[1.2rem] w-[1.2rem] scale-0 rotate-90 transition-all!",
                            "dark:scale-100 dark:rotate-0",
                          ].join(" ")}
                        />
                        <span>Toggle theme</span>
                      </div>
                    {/snippet}
                  </Sidebar.MenuButton>
                </DropdownMenu.Trigger>
                <DropdownMenu.Content align="start">
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
              <div
                class={[
                  "transition-all duration-150 overflow-hidden",
                  shouldFlex
                    ? "max-w-0 opacity-0 pointer-events-none"
                    : "max-w-10 opacity-100",
                ]}
              >
                <Sidebar.Trigger class="" size="icon-sm" />
              </div>
            </Sidebar.MenuItem>
          </div>

          <div
            class={[
              "transition-all duration-150 overflow-hidden",
              shouldFlex
                ? "max-h-10 opacity-100 mt-2"
                : "max-h-0 opacity-0 mt-0 pointer-events-none",
            ]}
          >
            <Sidebar.MenuItem>
              <Sidebar.Trigger
                tooltipContent="Toggle theme"
                class=""
                size="icon-sm"
              />
            </Sidebar.MenuItem>
          </div>
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
