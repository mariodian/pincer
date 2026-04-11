<script lang="ts">
  import type { Check } from "$shared/types";
  import { cn } from "$lib/utils";

  interface Props {
    check: Check;
    class?: string;
  }

  let { check, class: className }: Props = $props();

  const statusColors: Record<string, string> = {
    ok: "bg-green-500",
    offline: "bg-red-500",
    error: "bg-orange-500",
    degraded: "bg-yellow-500",
  };

  const statusLabels: Record<string, string> = {
    ok: "OK",
    offline: "Offline",
    error: "Error",
    degraded: "Degraded",
  };

  const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  };

  const formatDuration = (ms: number | null): string => {
    if (ms === null) return "N/A";
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };
</script>

<div
  class={cn(
    "group relative inline-flex h-2 w-2 rounded-full transition-all",
    statusColors[check.status] || "bg-gray-400",
    className,
  )}
  title={`${statusLabels[check.status] || check.status} at ${formatTime(check.checkedAt)}${check.responseMs !== null ? ` (${formatDuration(check.responseMs)})` : ""}`}
>
  <!-- Tooltip -->
  <div
    class="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-popover px-2 py-1 text-xs text-popover-foreground shadow-md group-hover:block"
  >
    <div class="font-medium">{statusLabels[check.status] || check.status}</div>
    <div class="text-muted-foreground">{formatTime(check.checkedAt)}</div>
    {#if check.responseMs !== null}
      <div class="text-muted-foreground">
        Response: {formatDuration(check.responseMs)}
      </div>
    {/if}
    {#if check.httpStatus !== null}
      <div class="text-muted-foreground">HTTP {check.httpStatus}</div>
    {/if}
    {#if check.errorMessage}
      <div class="max-w-[200px] truncate text-destructive">
        {check.errorMessage}
      </div>
    {/if}
  </div>
</div>
