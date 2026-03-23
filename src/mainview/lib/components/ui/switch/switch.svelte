<script lang="ts" module>
  import { cn, type WithoutChildrenOrChild } from "$lib/utils.js";
  import { tv, type VariantProps } from "tailwind-variants";

  export const switchVariants = tv({
    base: "shrink-0 rounded-full border border-transparent shadow-xs focus-visible:ring-3 aria-invalid:ring-3 peer group/switch relative inline-flex items-center transition-all outline-none after:absolute after:-inset-x-3 after:-inset-y-2 data-disabled:cursor-not-allowed data-disabled:opacity-50 focus-visible:border-ring focus-visible:ring-ring/50",
    variants: {
      size: {
        sm: "h-[14px] w-[24px]",
        default: "h-[18.4px] w-[32px]",
        lg: "h-[24px] w-[44px]",
      },
      variant: {
        default:
          "data-checked:bg-primary data-unchecked:bg-input aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 dark:data-unchecked:bg-input/80",
        blue: "data-checked:bg-blue-500 data-unchecked:bg-input dark:data-checked:bg-blue-600",
        green:
          "data-checked:bg-green-500 data-unchecked:bg-input dark:data-checked:bg-green-600/90",
        destructive:
          "data-checked:bg-destructive data-unchecked:bg-input dark:data-checked:bg-red-500/90",
        secondary:
          "data-checked:bg-black/30 data-unchecked:bg-input dark:data-checked:bg-secondary-foreground/50",
        ghost:
          "data-checked:bg-accent-foreground data-unchecked:bg-input dark:data-checked:bg-accent-foreground",
      },
    },
    defaultVariants: {
      size: "default",
      variant: "default",
    },
  });

  export const switchThumbVariants = tv({
    base: "bg-background dark:data-unchecked:bg-foreground rounded-full pointer-events-none block ring-0 transition-transform rtl:data-[state=checked]:translate-x-[calc(-100%)]",
    variants: {
      size: {
        sm: "size-3 data-checked:translate-x-[calc(100%-2px)] data-unchecked:translate-x-0",
        default:
          "size-4 data-checked:translate-x-[calc(100%-2px)] data-unchecked:translate-x-0",
        lg: "size-5 data-checked:translate-x-[calc(100%+1px)] data-unchecked:translate-x-px",
      },
    },
    defaultVariants: {
      size: "default",
    },
  });

  export type SwitchSize = VariantProps<typeof switchVariants>["size"];
  export type SwitchVariant = VariantProps<typeof switchVariants>["variant"];
</script>

<script lang="ts">
  import { Switch as SwitchPrimitive } from "bits-ui";

  let {
    ref = $bindable(null),
    class: className,
    checked = $bindable(false),
    size = "default",
    variant = "default",
    ...restProps
  }: WithoutChildrenOrChild<SwitchPrimitive.RootProps> & {
    size?: SwitchSize;
    variant?: SwitchVariant;
  } = $props();
</script>

<SwitchPrimitive.Root
  bind:ref
  bind:checked
  data-slot="switch"
  data-size={size}
  data-variant={variant}
  class={cn(switchVariants({ size, variant }), className)}
  {...restProps}
>
  <SwitchPrimitive.Thumb
    data-slot="switch-thumb"
    class={cn(switchThumbVariants({ size }))}
  />
</SwitchPrimitive.Root>
