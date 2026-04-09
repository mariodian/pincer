<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import * as Empty from "$lib/components/ui/empty/index.js";
  import { ErrorState } from "$lib/components/ui/error-state/index.js";
  import { Icon } from "$lib/components/ui/icon";
  import { PageBody, PageHeader } from "$lib/components/ui/page";
  import { Skeleton } from "$lib/components/ui/skeleton";
  import * as Table from "$lib/components/ui/table";
  import { MIN_UPTIME_THRESHOLDS } from "$lib/constants";
  import { getMainRPC, whenReady } from "$lib/services/mainRPC";
  import { currentRoute, previousRoute } from "$lib/services/navigationStore";
  import { formatMs, formatUptime } from "$lib/utils/metrics-data";
  import { formatDate } from "$shared/date-helpers";
  import type { AgentUptimeSummary, UptimeReport } from "$shared/reportTypes";
  import type { TimeRange } from "$shared/types";
  import { toast } from "svelte-sonner";

  type ReportRangeOption = { value: TimeRange; label: string };
  type SortKey = "name" | "uptime" | "checks" | "incidents" | "avgResponse";

  let sortKey = $state<SortKey>("name");
  let sortAsc = $state(true);

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
  let range = $state<TimeRange>("30d");

  function getUptimeColor(
    pct: number,
    colorType: "bg" | "text" = "text",
  ): string {
    if (pct >= MIN_UPTIME_THRESHOLDS.ok)
      return colorType === "bg"
        ? "bg-green-600 dark:bg-green-500"
        : "text-green-600 dark:text-green-500";
    if (pct >= MIN_UPTIME_THRESHOLDS.good)
      return colorType === "bg"
        ? "bg-amber-400 dark:bg-amber-400"
        : "text-amber-400 dark:text-amber-400";
    if (pct >= MIN_UPTIME_THRESHOLDS.meh)
      return colorType === "bg" ? "bg-orange-500" : "text-orange-500";
    return colorType === "bg"
      ? "bg-red-600 dark:bg-red-500"
      : "text-red-600 dark:text-red-500";
  }

  function sortedAgents(agents: AgentUptimeSummary[]): AgentUptimeSummary[] {
    const sorted = [...agents].sort((a, b) => {
      const dir = sortAsc ? 1 : -1;
      switch (sortKey) {
        case "name":
          return dir * a.agentName.localeCompare(b.agentName);
        case "uptime":
          return dir * (a.uptimePct - b.uptimePct);
        case "checks":
          return dir * (a.totalChecks - b.totalChecks);
        case "incidents":
          return dir * (a.incidentCount - b.incidentCount);
        case "avgResponse":
          return dir * (a.avgResponseMs - b.avgResponseMs);
        default:
          return 0;
      }
    });
    return sorted;
  }

  function sortArrow(key: SortKey, type: "char" | "numeric") {
    if (sortKey !== key) return "";
    if (type === "char") {
      return sortAsc ? "arrowUpChar" : "arrowDownChar";
    } else {
      return sortAsc ? "arrowUpNumeric" : "arrowDownNumeric";
    }
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      sortAsc = !sortAsc;
    } else {
      sortKey = key;
      sortAsc = true;
    }
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
        toast.success("HTML report exported", {
          description: `Saved to ${downloadsPath}`,
          action: {
            label: "Show in Folder",
            onClick: async () => {
              await rpc.request.openFolder({ path: downloadsPath });
            },
          },
        });
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
        <div class={["grid gap-3 lg:gap-4 mb-6", "grid-cols-2 lg:grid-cols-4"]}>
          <Skeleton class="h-21 w-full rounded-lg" />
          <Skeleton class="h-21 w-full rounded-lg" />
          <Skeleton class="h-21 w-full rounded-lg" />
          <Skeleton class="h-21 w-full rounded-lg" />
        </div>
        <div>
          <Skeleton class="h-8 w-32 rounded-lg" />
        </div>
        <Skeleton class="h-48 w-full rounded-lg" />
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
                ? "text-red-600 dark:text-red-500"
                : "text-green-600 dark:text-green-500",
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

      <Table.Root>
        <Table.Header>
          <Table.Row>
            <Table.Head class="w-2/8">
              <button
                class="hover:text-foreground flex items-center gap-1"
                onclick={() => toggleSort("name")}
              >
                Agent{#if sortKey === "name"}
                  <Icon name={sortArrow("name", "char")} class="size-4" />
                {/if}
              </button>
            </Table.Head>
            <Table.Head>
              <button
                class="hover:text-foreground flex items-center gap-1"
                onclick={() => toggleSort("uptime")}
              >
                Uptime{#if sortKey === "uptime"}
                  <Icon name={sortArrow("uptime", "numeric")} class="size-4" />
                {/if}
              </button>
            </Table.Head>
            <Table.Head class="w-1/8">
              <button
                class="hover:text-foreground flex items-center gap-1"
                onclick={() => toggleSort("checks")}
              >
                Checks{#if sortKey === "checks"}
                  <Icon name={sortArrow("checks", "numeric")} class="size-4" />
                {/if}
              </button>
            </Table.Head>
            <Table.Head class="w-1/8">
              <button
                class="hover:text-foreground flex items-center gap-1"
                onclick={() => toggleSort("incidents")}
              >
                Incidents{#if sortKey === "incidents"}
                  <Icon
                    name={sortArrow("incidents", "numeric")}
                    class="size-4"
                  />
                {/if}
              </button>
            </Table.Head>
            <Table.Head class="w-1/8">
              <button
                class="hover:text-foreground flex items-center gap-1"
                onclick={() => toggleSort("avgResponse")}
              >
                Avg Response{#if sortKey === "avgResponse"}
                  <Icon
                    name={sortArrow("avgResponse", "numeric")}
                    class="size-4"
                  />
                {/if}
              </button>
            </Table.Head>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {#each sortedAgents(report.agents) as agent (agent.agentId)}
            <Table.Row>
              <Table.Cell>
                <div class="flex items-center gap-2">
                  <span
                    class="w-2.5 h-2.5 rounded-full shrink-0"
                    style="background-color: {agent.color}"
                  ></span>
                  <span class="font-medium">{agent.agentName}</span>
                </div>
              </Table.Cell>
              <Table.Cell>
                {#if agent.hasData}
                  <div class="flex items-center gap-3">
                    <div
                      class="flex-1 h-2 bg-muted rounded-full overflow-hidden max-w-30"
                    >
                      <div
                        class={[
                          "h-full rounded-full",
                          getUptimeColor(agent.uptimePct, "bg"),
                        ]}
                        style="width: {Math.min(agent.uptimePct, 100)}%;"
                      ></div>
                    </div>
                    <span
                      class={["font-semibold", getUptimeColor(agent.uptimePct)]}
                    >
                      {formatUptime(agent.uptimePct)}
                    </span>
                  </div>
                {:else}
                  <span class="text-muted-foreground">No data</span>
                {/if}
              </Table.Cell>
              <Table.Cell>
                {agent.totalChecks.toLocaleString()}
              </Table.Cell>
              <Table.Cell
                class={agent.incidentCount > 0
                  ? "text-red-600 dark:text-red-500 font-medium"
                  : "text-muted-foreground"}
              >
                {agent.incidentCount.toLocaleString()}
              </Table.Cell>
              <Table.Cell class="text-muted-foreground">
                {agent.hasData ? formatMs(agent.avgResponseMs) : "—"}
              </Table.Cell>
            </Table.Row>
          {/each}
        </Table.Body>
      </Table.Root>
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
