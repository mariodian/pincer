<script lang="ts">
  import { cn } from "$lib/utils.js";
  import { Label } from "$lib/components/ui/label/index.js";
  import { Switch } from "$lib/components/ui/switch/index.js";

  let {
    id,
    title,
    description,
    checked = $bindable(false),
    variant = "default",
    disabled = false,
    onCheckedChange,
    class: className,
  }: {
    id: string;
    title: string;
    description?: string;
    checked?: boolean;
    variant?: "default" | "blue";
    disabled?: boolean;
    onCheckedChange?: (checked: boolean) => void;
    class?: string;
  } = $props();

  const variantClasses = {
    default:
      "has-[[aria-checked=true]]:border-ring has-[[aria-checked=true]]:bg-muted",
    blue:
      "has-[[aria-checked=true]]:border-blue-200 has-[[aria-checked=true]]:bg-blue-50 dark:has-[[aria-checked=true]]:border-blue-900/50 dark:has-[[aria-checked=true]]:bg-blue-950/50",
  };
</script>

<Label
  for={id}
  class={cn(
    "flex items-center justify-between gap-3 rounded-lg border p-4",
    "hover:bg-accent/50",
    "font-normal",
    variantClasses[variant],
    className,
  )}
>
  <div class="grid gap-1.5">
    <p class="text-sm leading-none font-medium">{title}</p>
    {#if description}
      <p class="text-xs text-muted-foreground">{description}</p>
    {/if}
  </div>
  <Switch {id} bind:checked {disabled} {onCheckedChange} />
</Label>
