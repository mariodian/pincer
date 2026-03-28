<script lang="ts" module>
  import { cn } from "$lib/utils.js";
  import { tv, type VariantProps } from "tailwind-variants";

  export const kpiCardVariants = tv({
    base: ["rounded-lg border p-4 flex flex-col gap-1", "text-white"],
    variants: {
      color: {
        default: "",
        blue: "",
        green: "",
        destructive: "",
        secondary: "",
      },
      gradient: {
        false: "",
        true: "",
      },
    },
    compoundVariants: [
      // Flat
      {
        color: "default",
        gradient: false,
        class: "border-border bg-card text-card-foreground",
      },
      {
        color: "blue",
        gradient: false,
        class: cn([
          "border-blue-700/60 bg-blue-600",
          "dark:border-blue-700 dark:bg-blue-800",
        ]),
      },
      {
        color: "green",
        gradient: false,
        class: cn([
          "border-green-700/60 bg-green-600",
          "dark:border-green-700 dark:bg-green-800",
        ]),
      },
      {
        color: "destructive",
        gradient: false,
        class: cn([
          "border-red-700/60 bg-red-600",
          "dark:border-red-700 dark:bg-red-800",
        ]),
      },
      {
        color: "secondary",
        gradient: false,
        class: cn(["border-border bg-secondary", "text-secondary-foreground"]),
      },
      // Gradient
      {
        color: "default",
        gradient: true,
        class: cn([
          "from-muted/40 to-card bg-linear-180",
          "dark:from-black/80 dark:to-card bg-linear-180",
          "border-border",
          "text-card-foreground",
        ]),
      },
      {
        color: "blue",
        gradient: true,
        class: cn([
          "from-blue-700 to-blue-600 bg-linear-180",
          "dark:from-blue-800 dark:to-blue-700",
          "border-blue-700",
          "text-white",
        ]),
      },
      {
        color: "green",
        gradient: true,
        class: cn([
          "from-green-700 to-green-600 bg-linear-180",
          "dark:from-green-800 dark:to-green-700",
          "border-green-700",
          "text-white",
        ]),
      },
      {
        color: "destructive",
        gradient: true,
        class: cn([
          "from-red-700 to-red-600 bg-linear-180",
          "dark:from-red-800 dark:to-red-700",
          "border-red-700",
          "text-white",
        ]),
      },
      {
        color: "secondary",
        gradient: true,
        class: cn([
          "from-muted to-secondary bg-linear-180",
          "dark:from-secondary dark:to-muted/60 bg-linear-180",
          "border-border dark:border-border/50",
          "text-secondary-foreground",
        ]),
      },
    ],
    defaultVariants: {
      color: "default",
      gradient: false,
    },
  });

  export type KpiCardColor = VariantProps<typeof kpiCardVariants>["color"];
  export type KpiCardGradient = VariantProps<
    typeof kpiCardVariants
  >["gradient"];
</script>

<script lang="ts">
  import { Skeleton } from "$lib/components/ui/skeleton/index.js";

  let {
    title,
    value,
    subtitle,
    loading = false,
    color = "default",
    gradient = false,
    class: className,
  }: {
    title: string;
    value: string | number;
    subtitle?: string;
    loading?: boolean;
    color?: KpiCardColor;
    gradient?: KpiCardGradient;
    class?: string;
  } = $props();
</script>

<div class={cn(kpiCardVariants({ color, gradient }), className)}>
  {#if loading}
    <Skeleton class="h-4 w-20" />
    <Skeleton class="h-7 w-20" />
    {#if subtitle}
      <Skeleton class="h-3 w-24 mt-0.5" />
    {/if}
  {:else}
    <span class="text-xs font-medium uppercase tracking-wide opacity-70">
      {title}
    </span>
    <span class="text-2xl font-semibold tracking-tight">{value}</span>
    {#if subtitle}
      <span class="text-xs opacity-70">{subtitle}</span>
    {/if}
  {/if}
</div>
