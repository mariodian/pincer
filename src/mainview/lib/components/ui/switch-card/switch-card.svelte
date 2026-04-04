<script lang="ts" module>
  import { cn } from "$lib/utils.js";
  import { tv, type VariantProps } from "tailwind-variants";

  // border-border bg-background hover:bg-muted hover:text-foreground
  // dark:bg-input/30 dark:border-input dark:hover:bg-input/50
  // aria-expanded:bg-muted aria-expanded:text-foreground shadow-xs",

  export const switchCardVariants = tv({
    base: cn([
      "flex items-center justify-between gap-3 p-4",
      "rounded-lg border shadow-xs transition-colors",
      "has-[[aria-checked=false]]:saturate-50"
    ]),
    variants: {
      variant: {
        default: cn([
          "border-ring/30 bg-muted",
          "[&_[data-slot=description]]:text-muted-foreground",
          "has-[[aria-checked=false]]:bg-muted/50",
          "has-[[aria-checked=false]]:border-ring/20 has-[[aria-checked=false]]:bg-muted/20",
          "dark:has-[[aria-checked=false]]:bg-muted/40",
          "has-[[aria-checked=false]]:saturate-100",
          "has-[[aria-checked=false]]:brightness-100",

        ]),
        blue: cn([
          "border-blue-300/50 bg-blue-300/30",
          "dark:border-blue-900/70 dark:bg-blue-900/50",
          "[&_[data-slot=description]]:text-blue-950/60",
          "dark:[&_[data-slot=description]]:text-blue-100/60",

        ]),
        green: cn([
          "border-green-300/50 bg-green-300/30",
          "dark:border-green-900/70 dark:bg-green-900/50",
          "[&_[data-slot=description]]:text-green-950/60",
          "dark:[&_[data-slot=description]]:text-green-100/60",
        ]),
        destructive: cn([
          "border-red-300/50 bg-red-300/30",
          "dark:border-red-900/70 dark:bg-red-900/50",
          "[&_[data-slot=description]]:text-red-950/60",
          "dark:[&_[data-slot=description]]:text-red-100/60",
        ]),
        secondary: cn([
          "border-border bg-secondary",
          "dark:border-border/50",
          "[&_[data-slot=description]]:text-secondary-foreground/60",
          "dark:[&_[data-slot=description]]:text-secondary-foreground/40",
          "has-[[aria-checked=false]]:bg-secondary/50",
          "has-[[aria-checked=false]]:saturate-100",
          "has-[[aria-checked=false]]:brightness-100",
        ]),
        ghost: cn([
          "border-transparent bg-accent",
          "[&_[data-slot=description]]:text-foreground/60",
          "dark:[&_[data-slot=description]]:text-foreground/40",
          "has-[[aria-checked=false]]:bg-accent/50",
          "has-[[aria-checked=false]]:saturate-100",
          "has-[[aria-checked=false]]:brightness-100",
        ]),
      },
      size: {
        default: cn([
          "[&_[data-slot=title]]:text-sm [&_[data-slot=description]]:text-[13px]",
          "[&_[data-slot=description]]:leading-4.5",
        ]),
        lg: cn([
          "[&_div]:gap-3",
          "[&_[data-slot=title]]:text-base [&_[data-slot=description]]:text-sm",
          "py-6 px-5",
        ]),
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  });

  export type SwitchCardVariant = VariantProps<
    typeof switchCardVariants
  >["variant"];
  export type SwitchCardSize = VariantProps<typeof switchCardVariants>["size"];
</script>

<script lang="ts">
  import { Label } from "$lib/components/ui/label/index.js";
  import Switch from "../switch/switch.svelte";

  let {
    id,
    title,
    description,
    checked = $bindable(false),
    variant = "default",
    size = "default",
    disabled = false,
    onCheckedChange,
    class: className,
  }: {
    id: string;
    title: string;
    description?: string;
    checked?: boolean;
    variant?: SwitchCardVariant;
    size?: SwitchCardSize;
    disabled?: boolean;
    onCheckedChange?: (checked: boolean) => void;
    class?: string;
  } = $props();
</script>

<Label for={id} class={cn(switchCardVariants({ variant, size }), className)}>
  <div class="grid gap-1.5">
    <p data-slot="title" class="leading-none font-medium">{title}</p>
    {#if description}
      <p data-slot="description">
        {description}
      </p>
    {/if}
  </div>
  <Switch tabindex={0} {variant} {size} {id} bind:checked {disabled} {onCheckedChange} />
</Label>
