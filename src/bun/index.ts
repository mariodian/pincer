import { ApplicationMenu, BrowserWindow, Updater, Utils } from "electrobun/bun";
import { dlopen, FFIType } from "bun:ffi";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { initializeTray, cleanupTray } from "./trayManager";
import { agentRPC } from "./agentRPC";

const DEV_SERVER_PORT = 5173;
const DEV_SERVER_URL = `http://localhost:${DEV_SERVER_PORT}`;
const MAC_TRAFFIC_LIGHTS_X = 14;
const MAC_TRAFFIC_LIGHTS_Y = 12;
const MAC_NATIVE_DRAG_REGION_X = 92;
const MAC_NATIVE_DRAG_REGION_HEIGHT = 40;

// Check if Vite dev server is running for HMR
async function getMainViewUrl(): Promise<string> {
	const channel = await Updater.localInfo.channel();
	if (channel === "dev") {
		try {
			await fetch(DEV_SERVER_URL, { method: "HEAD" });
			console.log(`HMR enabled: Using Vite dev server at ${DEV_SERVER_URL}`);
			return DEV_SERVER_URL;
		} catch {
			console.log(
				"Vite dev server not running. Run 'bun run dev:hmr' for HMR support.",
			);
		}
	}
	return "views://mainview/index.html";
}

// Create the main application window
const url = await getMainViewUrl();
const isMacOS = process.platform === "darwin";

// Initialize tray icon
initializeTray();

export function applyMacOSWindowEffects(mainWindow: BrowserWindow) {
	const dylibPath = join(import.meta.dir, "libMacWindowEffects.dylib");

	if (!existsSync(dylibPath)) {
		console.warn(
			`Native macOS effects lib not found at ${dylibPath}. Falling back to transparent-only mode.`,
		);
		return;
	}

	try {
		const lib = dlopen(dylibPath, {
			enableWindowVibrancy: {
				args: [FFIType.ptr],
				returns: FFIType.bool,
			},
			ensureWindowShadow: {
				args: [FFIType.ptr],
				returns: FFIType.bool,
			},
			setWindowTrafficLightsPosition: {
				args: [FFIType.ptr, FFIType.f64, FFIType.f64],
				returns: FFIType.bool,
			},
			setNativeWindowDragRegion: {
				args: [FFIType.ptr, FFIType.f64, FFIType.f64],
				returns: FFIType.bool,
			},
		});

		const vibrancyEnabled = lib.symbols.enableWindowVibrancy(mainWindow.ptr);
		const shadowEnabled = lib.symbols.ensureWindowShadow(mainWindow.ptr);
		const alignButtons = () =>
			lib.symbols.setWindowTrafficLightsPosition(
				mainWindow.ptr,
				MAC_TRAFFIC_LIGHTS_X,
				MAC_TRAFFIC_LIGHTS_Y,
			);
		const alignNativeDragRegion = () =>
			lib.symbols.setNativeWindowDragRegion(
				mainWindow.ptr,
				MAC_NATIVE_DRAG_REGION_X,
				MAC_NATIVE_DRAG_REGION_HEIGHT,
			);
		const buttonsAlignedNow = alignButtons();
		const dragRegionAlignedNow = alignNativeDragRegion();
		setTimeout(() => {
			alignButtons();
			alignNativeDragRegion();
		}, 120);
		mainWindow.on("resize", () => {
			alignButtons();
			alignNativeDragRegion();
		});

		console.log(
			`macOS effects applied (vibrancy=${vibrancyEnabled}, shadow=${shadowEnabled}, trafficLights=${buttonsAlignedNow}, nativeDrag=${dragRegionAlignedNow})`,
		);
	} catch (error) {
		console.warn("Failed to apply native macOS effects:", error);
	}
}

function setupMacOSMenu(mainWindow: BrowserWindow) {
	ApplicationMenu.setApplicationMenu([
		{
			submenu: [{ role: "quit" }],
		},
		{
			label: "File",
			submenu: [
				{
					label: "Close Window",
					action: "close-main-window",
					accelerator: "w",
				},
				{ type: "separator" },
				{ role: "quit" },
			],
		},
		{
			label: "Window",
			submenu: [{ role: "minimize" }, { role: "zoom" }, { role: "bringAllToFront" }],
		},
	]);

	ApplicationMenu.on("application-menu-clicked", (event: unknown) => {
		const action = (event as { data?: { action?: string } })?.data?.action;
		if (action === "close-main-window") {
			mainWindow.close();
		}
	});
}

const mainWindow = new BrowserWindow({
	title: "React + Tailwind + Vite",
	url,
	frame: {
		width: 900,
		height: 700,
		x: 200,
		y: 200,
	},
	rpc: agentRPC,
	...(isMacOS
		? {
				// Borderless custom title area while keeping native traffic-light controls.
				titleBarStyle: "hiddenInset" as const,
				// Required for glass-like/translucent UI from the renderer.
				transparent: true,
			}
		: {}),
});

// Apply macOS-specific window effects
if (isMacOS) {
  applyMacOSWindowEffects(mainWindow);
  setupMacOSMenu(mainWindow);
}

// Set up application menu for all platforms
ApplicationMenu.setApplicationMenu([
  {
    submenu: [{ role: "quit" }],
  },
  {
    label: "File",
    submenu: [
      {
        label: "Close Window",
        action: "close-main-window",
        accelerator: "w",
      },
      { type: "separator" },
      { role: "quit" },
    ],
  },
  {
    label: "Window",
    submenu: [{ role: "minimize" }, { role: "zoom" }, { role: "bringAllToFront" }],
  },
]);

ApplicationMenu.on("application-menu-clicked", (event: unknown) => {
  const action = (event as { data?: { action?: string } })?.data?.action;
  if (action === "close-main-window") {
    mainWindow.close();
  }
});

// Quit the app when the main window is closed
mainWindow.on("close", () => {
	cleanupTray();
	Utils.quit();
});

console.log("React Tailwind Vite app started!");
