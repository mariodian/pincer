import { mount } from "svelte";
import AgentConfig from "./AgentConfig.svelte";
import "./index.css";

const app = mount(AgentConfig, {
  target: document.getElementById("root")!,
});

export default app;