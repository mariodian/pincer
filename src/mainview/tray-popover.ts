import { mount } from "svelte";

import TrayPopover from "./TrayPopover.svelte";

declare global {
  interface Window {
    electrobun: {
      ipcRenderer: {
        invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;
      };
    };
  }
}

const app = mount(TrayPopover, {
  target: document.getElementById("root")!,
});

export default app;
