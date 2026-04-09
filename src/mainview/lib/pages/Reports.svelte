<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import * as Empty from "$lib/components/ui/empty/index.js";
  import { ErrorState } from "$lib/components/ui/error-state/index.js";
  import { Icon } from "$lib/components/ui/icon";
  import { PageBody, PageHeader } from "$lib/components/ui/page";
  import { Skeleton } from "$lib/components/ui/skeleton";
  import { getMainRPC, whenReady } from "$lib/services/mainRPC";
  import { currentRoute, previousRoute } from "$lib/services/navigationStore";
  import type { ReportRange, UptimeReport } from "$shared/reportTypes";
  import { sortAgentsByStatus } from "$shared/agent-helpers";
  import { toast } from "svelte-sonner";

  type ReportRangeOption = { value: ReportRange; label: string };

  const RANGES: ReportRangeOption[] = [
    { value: "7d", label: "7d" },
    { value: "30d", label: "30d" },
    { value: "90d", label: "90d" },
  ];

  let currentPath = $derived($currentRoute);
  let prevPath = $derived($previousRoute);

  let loading = $state(true);
  let exporting = $state(false);
  let error = $state<string | null>(null);
  let report = $state<UptimeReport | null>(null);
  let range = $state<ReportRange>("30d");

  function getUptimeColor(pct: number): string {
    if (pct >= 99) return "text-green-600 dark:text-green-400";
    if (pct >= 95) return "text-yellow-600 dark:text-yellow-400";
    if (pct >= 50) return "text-orange-600 dark:text-orange-400";
    return "text-red-600 dark:text-red-400";
  }

  function formatUptime(val: number): string {
    return `${val.toFixed(2)}%`;
  }

  function formatMs(val: number): string {
    return `${Math.round(val)}ms`;
  }

  function formatDate(d: Date | string | number): string {
    const date = typeof d === "string" ? new Date(d) : typeof d === "number" ? new Date(d * 1000) : d;
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  async function fetchData() {
    loading = true;
    error = null;
    try {
      await whenReady();
      const rpc = getMainRPC();
      report = await rpc.request.getUptimeReport({ range });
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      loading = false;
    }
  }

  async function handleExportHtml() {
    exporting = true;
    try {
      await whenReady();
      const rpc = getMainRPC();
      const html = await rpc.request.exportHtmlReport({ range });

      const fileName = `pincer-uptime-${range}.html`;

      if (typeof window !== "undefined") {
        const blob = new Blob([html], { type: "text/html" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        const downloadsPath = (await rpc.request.getDownloadsPath({})).path;
        toast.success(
          "HTML report exported",
          {
            description: `Saved to ${downloadsPath}`,
            action: {
              label: "Show in Folder",
              onClick: async () => {
                await rpc.request.openFolder({ path: downloadsPath });
              },
            },
          },
        );
      }
    } catch (e) {
      console.error("Failed to export report:", e);
    } finally {
      exporting = false;
    }
  }

  $effect(() => {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    range; // reactive dependency
    fetchData();
  });
</script>

<div class="flex flex-col h-full">
  <PageHeader
    title="Uptime Reports"
    description="Per-agent availability summaries"
    {prevPath}
    {currentPath}
  >
    {#snippet actions()}
      <div class="flex items-center gap-2">
        <div
          class="flex items-center gap-1 rounded-lg border bg-background p-1"
        >
          {#each RANGES as r}
            <button
              type="button"
              class={[
                "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                range === r.value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted",
              ]}
              onclick={() => (range = r.value)}
            >
              {r.label}
            </button>
          {/each}
        </div>
      </div>
    {/snippet}
  </PageHeader>

  <PageBody>
    {#if error}
      <ErrorState
        class="flex-1 py-16"
        title="Failed to load report"
        description={error ?? undefined}
      >
        {#snippet icon()}
          <Icon name="alertCircle" class="size-5 text-destructive" />
        {/snippet}
        {#snippet cta()}
          <Button
            variant="outline"
            disabled={loading}
            onclick={() => fetchData()}
          >
            <Icon name="alertCircle" />
            {loading ? "Retrying..." : "Retry"}
          </Button>
        {/snippet}
      </ErrorState>
    {:else if loading}
      <div class="space-y-4">
        <div class="grid gap-3 lg:gap-4 grid-cols-2 lg:grid-cols-4">
          <Skeleton class="h-24 w-full rounded-lg" />
          <Skeleton class="h-24 w-full rounded-lg" />
          <Skeleton class="h-24 w-full rounded-lg" />
          <Skeleton class="h-24 w-full rounded-lg" />
        </div>
        <Skeleton class="h-96 w-full rounded-lg" />
      </div>
    {:else if report}
      <!-- KPI Summary -->
      <div class={["grid gap-3 lg:gap-4 mb-6", "grid-cols-2 lg:grid-cols-4"]}>
        <div class="rounded-lg border bg-background p-4">
          <div
            class="text-xs text-muted-foreground uppercase tracking-wide mb-1"
          >
            Overall Uptime
          </div>
          <div
            class={[
              "text-2xl font-bold",
              report.overallUptimePct !== null
                ? getUptimeColor(report.overallUptimePct)
                : "text-muted-foreground",
            ]}
          >
            {report.overallUptimePct !== null
              ? formatUptime(report.overallUptimePct)
              : "No data"}
          </div>
        </div>

        <div class="rounded-lg border bg-background p-4">
          <div
            class="text-xs text-muted-foreground uppercase tracking-wide mb-1"
          >
            Total Agents
          </div>
          <div class="text-2xl font-bold">{report.agents.length}</div>
        </div>

        <div class="rounded-lg border bg-background p-4">
          <div
            class="text-xs text-muted-foreground uppercase tracking-wide mb-1"
          >
            Total Incidents
          </div>
          <div
            class={[
              "text-2xl font-bold",
              report.totalIncidents > 0
                ? "text-red-600 dark:text-red-400"
                : "text-green-600 dark:text-green-400",
            ]}
          >
            {report.totalIncidents}
          </div>
        </div>

        <div class="rounded-lg border bg-background p-4">
          <div
            class="text-xs text-muted-foreground uppercase tracking-wide mb-1"
          >
            Period
          </div>
          <div class="text-sm font-medium">
            {formatDate(report.periodStart)} – {formatDate(report.periodEnd)}
          </div>
        </div>
      </div>

      <!-- Export + Agent Table -->
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={exporting || loading}
            onclick={handleExportHtml}
          >
            <Icon name="download" />
            {exporting ? "Exporting..." : "Export HTML"}
          </Button>
        </div>
      </div>

      <!-- Agent Table -->
      <div class="rounded-lg border overflow-hidden">
        <table class="w-full">
          <thead class="bg-muted/50">
            <tr>
              <th
                class="text-left text-xs font-medium text-muted-foreground uppercase tracking-wide px-4 py-3"
              >
                Agent
              </th>
              <th
                class="text-left text-xs font-medium text-muted-foreground uppercase tracking-wide px-4 py-3"
              >
                Uptime
              </th>
              <th
                class="text-left text-xs font-medium text-muted-foreground uppercase tracking-wide px-4 py-3"
              >
                Checks
              </th>
              <th
                class="text-left text-xs font-medium text-muted-foreground uppercase tracking-wide px-4 py-3"
              >
                Incidents
              </th>
              <th
                class="text-left text-xs font-medium text-muted-foreground uppercase tracking-wide px-4 py-3"
              >
                Avg Response
              </th>
            </tr>
          </thead>
          <tbody>
            {#each sortAgentsByStatus(report.agents) as agent (agent.agentId)}
              <tr class="border-t">
                <td class="px-4 py-3">
                  <div class="flex items-center gap-2">
                    <span
                      class="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style="background-color: {agent.color}"
                    ></span>
                    <span class="text-sm font-medium">{agent.agentName}</span>
                    {#if !agent.enabled}
                      <span
                        class="text-[10px] uppercase bg-muted px-1.5 py-0.5 rounded text-muted-foreground"
                        >Disabled</span
                      >
                    {/if}
                  </div>
                </td>
                <td class="px-4 py-3">
                  {#if agent.hasData}
                    <div class="flex items-center gap-3">
                      <div
                        class="flex-1 h-2 bg-muted rounded-full overflow-hidden max-w-[120px]"
                      >
                        <div
                          class="h-full rounded-full"
                          style="width: {Math.min(
                            agent.uptimePct,
                            100,
                          )}%; background-color: {agent.uptimePct >= 99
                            ? 'hsl(142 76% 36%)'
                            : agent.uptimePct >= 95
                              ? 'hsl(45 93% 47%)'
                              : agent.uptimePct >= 50
                                ? 'hsl(24 94% 50%)'
                                : 'hsl(0 84% 60%)'}"
                        ></div>
                      </div>
                      <span
                        class={[
                          "font-semibold text-sm",
                          getUptimeColor(agent.uptimePct),
                        ]}
                      >
                        {formatUptime(agent.uptimePct)}
                      </span>
                    </div>
                  {:else}
                    <span class="text-muted-foreground text-sm">No data</span>
                  {/if}
                </td>
                <td class="px-4 py-3 text-sm">
                  {agent.totalChecks.toLocaleString()}
                </td>
                <td
                  class={[
                    "px-4 py-3 text-sm font-medium",
                    agent.incidentCount > 0
                      ? "text-red-600 dark:text-red-400"
                      : "text-muted-foreground",
                  ]}
                >
                  {agent.incidentCount.toLocaleString()}
                </td>
                <td class="px-4 py-3 text-sm text-muted-foreground">
                  {agent.hasData ? formatMs(agent.avgResponseMs) : "—"}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {:else}
      <Empty.Root class="border border-dashed">
        <Empty.Header>
          <Empty.Media variant="icon">
            <Icon name="dashboard" class="text-muted-foreground" />
          </Empty.Media>
          <Empty.Title>No report data</Empty.Title>
          <Empty.Description>
            There isn't enough data yet to generate a report.
          </Empty.Description>
        </Empty.Header>
      </Empty.Root>
    {/if}
  </PageBody>
</div>
