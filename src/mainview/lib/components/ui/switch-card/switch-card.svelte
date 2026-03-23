<script lang="ts" module>
  import { cn } from "$lib/utils.js";
  import { tv, type VariantProps } from "tailwind-variants";

  // border-border bg-background hover:bg-muted hover:text-foreground
  // dark:bg-input/30 dark:border-input dark:hover:bg-input/50
  // aria-expanded:bg-muted aria-expanded:text-foreground shadow-xs",

  export const switchCardVariants = tv({
    base: "flex items-center justify-between gap-3 rounded-lg border p-4 hover:bg-accent/50 font-normal transition-colors",
    variants: {
      variant: {
        default: [
          "has-[[aria-checked=true]]:border-ring has-[[aria-checked=true]]:bg-muted",
          "[&_[data-slot=description]]:text-muted-foreground",
        ],
        blue: [
          "has-[[aria-checked=true]]:border-blue-200 has-[[aria-checked=true]]:bg-blue-50",
          "dark:has-[[aria-checked=true]]:border-blue-900/50 dark:has-[[aria-checked=true]]:bg-blue-950/50",
          "[&_[data-slot=description]]:text-blue-950/60 dark:[&_[data-slot=description]]:text-blue-100/60",
        ],
        green: [
          "has-[[aria-checked=true]]:border-green-200 has-[[aria-checked=true]]:bg-green-50",
          "dark:has-[[aria-checked=true]]:border-green-900/50 dark:has-[[aria-checked=true]]:bg-green-950/50",
          "[&_[data-slot=description]]:text-green-950/60 dark:[&_[data-slot=description]]:text-green-100/60",
        ],
        destructive: [
          "has-[[aria-checked=true]]:border-destructive/20 has-[[aria-checked=true]]:bg-destructive/5",
          "dark:has-[[aria-checked=true]]:bg-destructive/10",
          "[&_[data-slot=description]]:text-red-950/60 dark:[&_[data-slot=description]]:text-red-100/60",
        ],
        secondary: [
          "has-[[aria-checked=true]]:border-border has-[[aria-checked=true]]:bg-secondary/50",
          "[&_[data-slot=description]]:text-secondary-foreground/60 dark:[&_[data-slot=description]]:text-secondary-foreground/40",
        ],
        ghost: [
          "border-transparent has-[[aria-checked=true]]:bg-accent/50 has-[[aria-checked=true]]:shadow-xs",
          "[&_[data-slot=description]]:text-foreground/60 dark:[&_[data-slot=description]]:text-foreground/40",
        ],
      },
      size: {
        default: [
          "[&_[data-slot=title]]:text-sm [&_[data-slot=description]]:text-[13px]",
          "[&_[data-slot=description]]:leading-4.5",
        ],
        lg: [
          "[&_div]:gap-3",
          "[&_[data-slot=title]]:text-base [&_[data-slot=description]]:text-sm",
          "py-6 px-5",
        ],
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
  import { Switch } from "$lib/components/ui/switch/index.js";

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
  <Switch {variant} {size} {id} bind:checked {disabled} {onCheckedChange} />
</Label>
