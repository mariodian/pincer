import { cn } from "$lib/utils.js";
import { tv, type VariantProps } from "tailwind-variants";

export const kpiCardVariants = tv({
  base: [
    "rounded-lg border p-4 flex flex-col gap-1",
    "text-primary",
    "shadow-sm shadow-black/10",
    "dark:shadow-xs dark:shadow-black/25"
  ],
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
        "dark:border-muted/50",
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
  },
});

export type KpiCardColor = VariantProps<typeof kpiCardVariants>["color"];
export type KpiCardGradient = VariantProps<typeof kpiCardVariants>["gradient"];
