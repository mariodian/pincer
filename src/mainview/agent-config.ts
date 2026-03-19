import { mount } from "svelte";
import AgentConfig from "./AgentConfig.svelte";

const app = mount(AgentConfig, {
  target: document.getElementById("root")!,
});

export default app;
