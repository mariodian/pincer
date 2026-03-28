import { Utils } from "electrobun/bun";
import { getMainWindow } from "../rpc/windowRegistry";
import { syncAgentsFromKnownStatuses } from "../trayManager";
import { getViewUrl, stripHash } from "./url";

/**
 * Show and focus the main window, creating it if it was previously closed.
 * Navigates to the specified page route and pushes current statuses.
 */
export async function showMainWindow(page: string): Promise<void> {
  Utils.setDockIconVisible(true);

  let win = getMainWindow();

  if (!win) {
    // Dynamic import to avoid circular dependency with index.ts
    const { createMainWindow } = await import("../index");
    win = await createMainWindow();
  }

  win.focus();

  // Always use loadURL with a cache-busting query param so the webview
  // treats the URL as new (hash-only differences are ignored otherwise).
  const baseUrl = stripHash(
    win.webview.url ?? (await getViewUrl("index.html")),
  );
  win.webview.loadURL(`${baseUrl}?_t=${Date.now()}#/${page}`);

  // Push current statuses so the renderer has fresh data immediately
  void syncAgentsFromKnownStatuses(false);
}
