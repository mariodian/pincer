import { BrowserView, Updater } from "electrobun/bun";
import { Agent } from "../agentService";
import { AgentStatusInfo } from "../storage/types";
import { KEY_AGENTS, KEY_STATUSES } from "../config";

export async function syncAgentData(
  agents: Agent[],
  statuses: AgentStatusInfo[],
): Promise<void> {
  const channel = await Updater.localInfo.channel();
  const suffix = channel === "dev" ? "_dev" : "";
  const keyAgents = `${KEY_AGENTS}${suffix}`;
  const keyStatuses = `${KEY_STATUSES}${suffix}`;

  const agentsJson = JSON.stringify(agents);
  const statusesJson = JSON.stringify(statuses);

  const js = `(() => {
    try {
      localStorage.setItem("${keyAgents}", ${JSON.stringify(agentsJson)});
      localStorage.setItem("${keyStatuses}", ${JSON.stringify(statusesJson)});
      window.dispatchEvent(new StorageEvent("storage", {
        key: "${keyAgents}",
        newValue: localStorage.getItem("${keyAgents}")
      }));
    } catch(e) { console.warn("syncAgentData failed", e); }
  })()`;

  for (const view of BrowserView.getAll()) {
    view.executeJavascript(js);
  }
}
