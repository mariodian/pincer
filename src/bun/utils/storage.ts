import { BrowserView } from "electrobun/bun";
import { Agent, AgentStatus } from "../agentService";

const KEY_AGENTS = "crabAgents";
const KEY_STATUSES = "crabAgentStatuses";

export function syncAgentData(
  agents: Agent[],
  statuses: AgentStatus[],
): Promise<void> {
  const agentsJson = JSON.stringify(agents);
  const statusesJson = JSON.stringify(statuses);

  const js = `(() => {
    try {
      localStorage.setItem("${KEY_AGENTS}", ${JSON.stringify(agentsJson)});
      localStorage.setItem("${KEY_STATUSES}", ${JSON.stringify(statusesJson)});
      window.dispatchEvent(new StorageEvent("storage", {
        key: "${KEY_AGENTS}",
        newValue: localStorage.getItem("${KEY_AGENTS}")
      }));
    } catch(e) { console.warn("syncAgentData failed", e); }
  })()`;

  for (const view of BrowserView.getAll()) {
    view.executeJavascript(js);
  }
  return Promise.resolve();
}
