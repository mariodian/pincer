<script lang="ts" module>
  import { cn } from "$lib/utils.js";
  import { tv, type VariantProps } from "tailwind-variants";

  export const kpiCardVariants = tv({
    base: ["rounded-lg border p-4 flex flex-col gap-1", "text-primary"],
    variants: {
      color: {
        default: "",
        blue: "",
        green: "",
        destructive: "",
        orange: "",
        yellow: "",
        secondary: "",
      },
      gradient: {
        false: "",
        true: "",
      },
      direction: {
        "to-br": "bg-linear-to-br",
        "to-bl": "bg-linear-to-bl",
        "to-b": "bg-linear-to-b",
        "to-tr": "bg-linear-to-tr",
        "to-tl": "bg-linear-to-tl",
        "to-t": "bg-linear-to-t",
        "to-180": "bg-linear-180",
        "to-90": "bg-linear-90",
      },
    },
    compoundVariants: [
      // Flat
      {
        color: "default",
        gradient: false,
        class: ["bg-card"],
      },
      {
        color: "blue",
        gradient: false,
        class: cn([
          "border-blue-700/60 bg-blue-600",
          "dark:border-blue-700 dark:bg-blue-800",
          "text-primary-foreground dark:text-primary text-shadow-xs",
        ]),
      },
      {
        color: "green",
        gradient: false,
        class: cn([
          "border-emerald-700/60 bg-emerald-600",
          "dark:border-emerald-600 dark:bg-emerald-700",
          "text-primary-foreground dark:text-primary text-shadow-xs",
        ]),
      },
      {
        color: "destructive",
        gradient: false,
        class: cn([
          "border-red-700/60 bg-red-600",
          "dark:border-red-700 dark:bg-red-800",
          "text-primary-foreground dark:text-primary text-shadow-xs",
        ]),
      },
      {
        color: "orange",
        gradient: false,
        class: cn([
          "border-amber-600/60 bg-amber-500",
          "dark:border-amber-500 dark:bg-amber-600",
          "text-primary-foreground dark:text-primary text-shadow-xs",
        ]),
      },
      {
        color: "yellow",
        gradient: false,
        class: cn([
          "border-amber-500/60 bg-amber-400",
          "dark:border-amber-300",
          "text-yellow-950 text-shadow-xs text-shadow-white/15",
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
          "bg-radial bg-radial-default",
          "border-card-foregound/10 dark:border-card-foreground/8",
          "text-primary text-shadow-xs text-shadow-primary-foreground",
        ]),
      },
      {
        color: "green",
        gradient: true,
        class: cn([
          "bg-radial bg-radial-green",
          "border-emerald-700/50 dark:border-emerald-600/50",
          "text-primary-foreground dark:text-primary text-shadow-xs",
        ]),
      },
      {
        color: "blue",
        gradient: true,
        class: cn([
          "bg-radial bg-radial-blue",
          "border-blue-700/50 dark:border-blue-600/50",
          "text-primary-foreground dark:text-primary text-shadow-xs",
        ]),
      },
      {
        color: "destructive",
        gradient: true,
        class: cn([
          "bg-radial bg-radial-red",
          "border-rose-600/50 dark:border-rose-600/50",
          "text-primary-foreground dark:text-primary",
          "text-primary-foreground dark:text-primary text-shadow-xs",
        ]),
      },
      {
        color: "orange",
        gradient: true,
        class: cn([
          "bg-radial bg-radial-orange",
          "border-amber-600/50 dark:border-amber-600/70",
          "text-primary-foreground dark:text-primary text-shadow-xs",
        ]),
      },
      {
        color: "yellow",
        gradient: true,
        class: cn([
          "bg-radial bg-radial-yellow",
          "border-amber-400/50 dark:border-amber-400/50",
          "text-yellow-950 text-shadow-xs text-shadow-white/15",
        ]),
      },
      {
        color: "secondary",
        gradient: true,
        class: cn([
          "from-muted to-secondary",
          "dark:from-secondary dark:to-muted/60",
          "border-border dark:border-border/50",
          "text-secondary-foreground",
        ]),
      },
    ],
    defaultVariants: {
      color: "default",
      gradient: false,
      // direction: "to-br",
    },
  });

  export type KpiCardColor = VariantProps<typeof kpiCardVariants>["color"];
  export type KpiCardGradient = VariantProps<
    typeof kpiCardVariants
  >["gradient"];
  export type KpiCardDirection = VariantProps<
    typeof kpiCardVariants
  >["direction"];
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
    direction = "to-br",
    class: className,
  }: {
    title: string;
    value: string | number;
    subtitle?: string;
    loading?: boolean;
    color?: KpiCardColor;
    gradient?: KpiCardGradient;
    direction?: KpiCardDirection;
    class?: string;
  } = $props();
</script>

<div class={cn(kpiCardVariants({ color, gradient, direction }), className)}>
  {#if loading}
    <Skeleton class="h-4 w-20 text-white" />
    <Skeleton class="h-7 w-20" />
    {#if subtitle}
      <Skeleton class="h-3 w-24 mt-0.5" />
    {/if}
  {:else}
    <span class="text-xs font-medium uppercase tracking-wide opacity-80">
      {title}
    </span>
    <span class="text-2xl font-semibold tracking-tight">{value}</span>
    {#if subtitle}
      <span class="text-xs opacity-75">{subtitle}</span>
    {/if}
  {/if}
</div>
