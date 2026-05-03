<script lang="ts">
  import {
    RANGE_SHORT_LABELS,
    REPORT_RANGES,
  } from "$shared/time-range-helpers";
  import type { TimeRange } from "$shared/types";
  import { toast } from "svelte-sonner";

  import { AgentTable } from "$lib/components/reports";
  import KpiSummary from "$lib/components/reports/KpiSummary.svelte";
  import { Button } from "$lib/components/ui/button";
  import { DataPage } from "$lib/components/ui/data-page";
  import * as Empty from "$lib/components/ui/empty";
  import { Icon } from "$lib/components/ui/icon";
  import { Skeleton } from "$lib/components/ui/skeleton";
  import { getMainRPC, whenReady } from "$lib/services/mainRPC";
  import { currentRoute, previousRoute } from "$lib/services/navigationStore";
  import { cn } from "$lib/utils";
  import { createPolledPage } from "$lib/utils/polled-page.svelte";

  const REPORT_RANGE_OPTIONS = REPORT_RANGES.map((r) => ({
    value: r,
    label: RANGE_SHORT_LABELS[r],
  }));

  type SortKey = "name" | "uptime" | "checks" | "incidents" | "avgResponse";

  let sortKey = $state<SortKey>("uptime");
  let sortAsc = $state(false);
  let exporting = $state(false);

  const page = createPolledPage({
    defaultRange: "30d",
    fetch: (rpc, range) => rpc.getUptimeReport({ range }),
  });

  let isEmpty = $derived(
    page.data === null || !page.data.agents.some((agent) => agent.hasData),
  );

  async function handleExportHtml(range: TimeRange) {
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

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      sortAsc = !sortAsc;
    } else {
      sortKey = key;
      sortAsc = key !== "uptime" && key !== "checks";
    }
  }
</script>

<DataPage
  title="Uptime Reports"
  description="Agent performance overview"
  prevPath={$previousRoute}
  currentPath={$currentRoute}
  errorTitle="Failed to load report"
  error={page.error}
  initialLoading={page.initialLoading}
  refreshing={page.refreshing}
  showRefreshing={page.showRefreshing}
  timeRange={page.timeRange}
  timeRangeOptions={REPORT_RANGE_OPTIONS}
  onTimeRangeChange={page.handleTimeRangeChange}
  onRefresh={page.refresh}
  lastUpdated={page.shouldShowLastUpdated ? page.anchorDate : undefined}
  onRetry={() => page.retry()}
  {isEmpty}
>
  {#snippet skeleton()}
    <div class="space-y-4">
      <div class={["mb-6 grid gap-3 lg:gap-4", "grid-cols-2 lg:grid-cols-4"]}>
        <Skeleton class="h-25 w-full rounded-lg" />
        <Skeleton class="h-25 w-full rounded-lg" />
        <Skeleton class="h-25 w-full rounded-lg" />
        <Skeleton class="h-25 w-full rounded-lg" />
      </div>
      <div>
        <Skeleton class="h-8 w-32 rounded-lg" />
      </div>
      <Skeleton class="h-48 w-full rounded-lg" />
    </div>
  {/snippet}

  {#snippet content()}
    <KpiSummary
      class={cn(["mb-6 grid gap-3 lg:gap-4", "grid-cols-2 lg:grid-cols-4"])}
      data={page.data!}
    />

    <div class="mb-4 flex items-center justify-between">
      <div class="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={exporting || page.refreshing || page.initialLoading}
          onclick={() => handleExportHtml(page.timeRange)}
        >
          <Icon name="download" />
          {exporting ? "Exporting..." : "Export HTML"}
        </Button>
      </div>
    </div>

    <AgentTable
      agents={page.data!.agents}
      {sortKey}
      {sortAsc}
      onSort={toggleSort}
    />
  {/snippet}

  {#snippet empty()}
    <Empty.Root class="border border-dashed">
      <Empty.Header>
        <Empty.Media variant="icon">
          <Icon name="barChart" class="text-muted-foreground" />
        </Empty.Media>
        <Empty.Title>No report data</Empty.Title>
        <Empty.Description>
          There isn't enough data yet to generate a report.
        </Empty.Description>
      </Empty.Header>
    </Empty.Root>
  {/snippet}
</DataPage>
