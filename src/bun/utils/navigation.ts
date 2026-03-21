import { getMainWindow } from "../rpc/windowRegistry";
import { getViewUrl, stripHash } from "./url";

/**
 * Navigate the main window to a specific page route.
 * No-op if the main window doesn't exist.
 */
export async function navigateMainWindow(page: string): Promise<void> {
  const win = getMainWindow();
  if (win) {
    // @TODO: do NOT delete yet, may be used when we start closing tray menu after click
    // win.focus(); - Don't focus the window to avoid interrupting the user
    const baseUrl = stripHash(
      win.webview.url ?? (await getViewUrl("index.html")),
    );
    win.webview.loadURL(`${baseUrl}#/${page}`);
  }
}
