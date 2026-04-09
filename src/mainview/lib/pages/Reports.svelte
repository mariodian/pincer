<script lang="ts">
  import { AgentTable, KpiSummary } from "$lib/components/reports";
  import { Button } from "$lib/components/ui/button";
  import * as Empty from "$lib/components/ui/empty/index.js";
  import { ErrorState } from "$lib/components/ui/error-state/index.js";
  import { Icon } from "$lib/components/ui/icon";
  import { PageBody, PageHeader } from "$lib/components/ui/page";
  import { Skeleton } from "$lib/components/ui/skeleton";
  import { getMainRPC, whenReady } from "$lib/services/mainRPC";
  import { currentRoute, previousRoute } from "$lib/services/navigationStore";
  import type { UptimeReport } from "$shared/reportTypes";
  import {
    RANGE_SHORT_LABELS,
    REPORT_RANGES,
  } from "$shared/time-range-helpers";
  import type { TimeRange } from "$shared/types";
  import { toast } from "svelte-sonner";

  type SortKey = "name" | "uptime" | "checks" | "incidents" | "avgResponse";

  let sortKey = $state<SortKey>("uptime");
  let sortAsc = $state(false);

  let currentPath = $derived($currentRoute);
  let prevPath = $derived($previousRoute);

  let loading = $state(true);
  let exporting = $state(false);
  let error = $state<string | null>(null);
  let report = $state<UptimeReport | null>(null);
  let range = $state<TimeRange>("30d");

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      sortAsc = !sortAsc;
    } else {
      sortKey = key;
      sortAsc = key !== "uptime" && key !== "checks";
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
    description="Agent performance overview"
    {prevPath}
    {currentPath}
  >
    {#snippet actions()}
      <div class="flex items-center gap-2">
        <div
          class="flex items-center gap-1 rounded-lg border bg-background p-1"
        >
          {#each REPORT_RANGES as r}
            <button
              type="button"
              class={[
                "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                range === r
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted",
              ]}
              onclick={() => (range = r)}
            >
              {RANGE_SHORT_LABELS[r]}
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
      <KpiSummary {report} />

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

      <AgentTable
        agents={report.agents}
        {sortKey}
        {sortAsc}
        onSort={toggleSort}
      />
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
