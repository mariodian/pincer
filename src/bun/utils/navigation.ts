import { Utils } from "electrobun/bun";
import { getMainWindow } from "../rpc/windowRegistry";
import { syncAgentsFromKnownStatuses } from "../trayManager";
import { getViewUrl, stripHash } from "./url";

/** Route to navigate to after the renderer signals ready (used when window is recreated). */
let pendingRoute: string | null = null;

/** Get the pending route set during window creation. */
export function getPendingRoute(): string | null {
  return pendingRoute;
}

/** Clear the pending route after navigation has been dispatched. */
export function clearPendingRoute(): void {
  pendingRoute = null;
}

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
    // Store route so notifyRendererReady can return it in the response,
    // letting the renderer apply it before showing any content.
    pendingRoute = page;
  } else {
    // Existing window — loadURL works because the webview is already loaded
    // and handles hash changes internally without re-invoking the protocol.
    const baseUrl = stripHash(
      win.webview.url ?? (await getViewUrl("index.html")),
    );
    win.webview.loadURL(`${baseUrl}#/${page}`);
  }

  win.focus();

  // Push current statuses so the renderer has fresh data immediately
  void syncAgentsFromKnownStatuses(false);
}
