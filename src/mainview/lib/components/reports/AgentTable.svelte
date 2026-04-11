<script lang="ts">
  import { Icon } from "$lib/components/ui/icon";
  import * as Table from "$lib/components/ui/table";
  import {
    formatMs,
    formatUptime,
    getUptimeColor,
  } from "$lib/utils/metrics-data";
  import type { AgentUptimeSummary } from "$shared/reportTypes";
  import { format } from "@layerstack/utils";

  type SortKey = "name" | "uptime" | "checks" | "incidents" | "avgResponse";

  interface Props {
    agents: AgentUptimeSummary[];
    sortKey: SortKey;
    sortAsc: boolean;
    onSort: (key: SortKey) => void;
  }

  let { agents, sortKey, sortAsc, onSort }: Props = $props();

  function sortedAgents(items: AgentUptimeSummary[]): AgentUptimeSummary[] {
    const sorted = [...items].sort((a, b) => {
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
</script>

<Table.Root>
  <Table.Header>
    <Table.Row>
      <Table.Head class="w-2/8">
        <button
          class="hover:text-foreground flex items-center gap-1"
          onclick={() => onSort("name")}
        >
          Agent{#if sortKey === "name"}
            <Icon name={sortArrow("name", "char")} class="size-4" />
          {/if}
        </button>
      </Table.Head>
      <Table.Head>
        <button
          class="hover:text-foreground flex items-center gap-1"
          onclick={() => onSort("uptime")}
        >
          Uptime{#if sortKey === "uptime"}
            <Icon name={sortArrow("uptime", "numeric")} class="size-4" />
          {/if}
        </button>
      </Table.Head>
      <Table.Head class="w-1/8">
        <button
          class="hover:text-foreground flex items-center gap-1"
          onclick={() => onSort("checks")}
        >
          Checks{#if sortKey === "checks"}
            <Icon name={sortArrow("checks", "numeric")} class="size-4" />
          {/if}
        </button>
      </Table.Head>
      <Table.Head class="w-1/8">
        <button
          class="hover:text-foreground flex items-center gap-1"
          onclick={() => onSort("incidents")}
        >
          Incidents{#if sortKey === "incidents"}
            <Icon name={sortArrow("incidents", "numeric")} class="size-4" />
          {/if}
        </button>
      </Table.Head>
      <Table.Head class="w-1/8">
        <button
          class="hover:text-foreground flex items-center gap-1"
          onclick={() => onSort("avgResponse")}
        >
          Avg Response{#if sortKey === "avgResponse"}
            <Icon name={sortArrow("avgResponse", "numeric")} class="size-4" />
          {/if}
        </button>
      </Table.Head>
    </Table.Row>
  </Table.Header>
  <Table.Body>
    {#each sortedAgents(agents) as agent (agent.agentId)}
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
              <span class={["font-semibold", getUptimeColor(agent.uptimePct)]}>
                {formatUptime(agent.uptimePct)}
              </span>
            </div>
          {:else}
            <span class="text-muted-foreground">No data</span>
          {/if}
        </Table.Cell>
        <Table.Cell>
          {format(agent.totalChecks, "metric")}
        </Table.Cell>
        <Table.Cell
          class={agent.incidentCount > 0
            ? "text-red-600 dark:text-red-500 font-medium"
            : "text-muted-foreground"}
        >
          {format(agent.incidentCount, "metric")}
        </Table.Cell>
        <Table.Cell class="text-muted-foreground">
          {agent.hasData ? formatMs(agent.avgResponseMs) : "—"}
        </Table.Cell>
      </Table.Row>
    {/each}
  </Table.Body>
</Table.Root>
