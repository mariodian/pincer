import { dlopen, FFIType, type Pointer } from "bun:ffi";
import { BrowserWindow } from "electrobun/bun";
import { existsSync } from "node:fs";
import { join } from "node:path";

export interface WindowConfig {
  titleBarStyle: "hiddenInset" | "hidden" | "default";
  titleBarTransparent: boolean;
  transparent: boolean;
  vibrancy: boolean;
  trafficLights: boolean;
  trafficLightsX: number;
  trafficLightsY: number;
  nativeDragRegion: boolean;
  nativeDragRegionX: number;
  nativeDragRegionHeight: number;
}

export type WindowAppearance = "system" | "light" | "dark";

export type WindowName = "main" | "config" | "popover";

type MacWindowEffectsLibrary = {
  symbols: {
    enableWindowVibrancy: (
      windowPtr: Pointer,
      titleBarTransparent: boolean,
      appearanceMode: number,
    ) => boolean;
    setWindowAppearance: (
      windowPtr: Pointer,
      appearanceMode: number,
    ) => boolean;
    ensureWindowShadow: (windowPtr: Pointer) => boolean;
    setWindowTrafficLightsPosition: (
      windowPtr: Pointer,
      x: number,
      yFromTop: number,
    ) => boolean;
    setTrafficLightsVisible: (windowPtr: Pointer, visible: boolean) => boolean;
    setNativeWindowDragRegion: (
      windowPtr: Pointer,
      x: number,
      height: number,
    ) => boolean;
  };
};

let currentWindowAppearance: WindowAppearance = "system";
let macWindowEffectsLib: MacWindowEffectsLibrary | null = null;
const trackedMacOSWindows: Record<WindowName, Set<BrowserWindow>> = {
  main: new Set<BrowserWindow>(),
  config: new Set<BrowserWindow>(),
  popover: new Set<BrowserWindow>(),
};

export const DEFAULT_WINDOW_CONFIGS: Record<WindowName, WindowConfig> = {
  main: {
    // titleBarStyle: "hiddenInset",
    titleBarTransparent: false,
    titleBarStyle: "default",
    transparent: true,
    vibrancy: true,
    trafficLights: true,
    trafficLightsX: 14,
    trafficLightsY: 7,
    nativeDragRegion: false,
    nativeDragRegionX: 92,
    nativeDragRegionHeight: 40,
  },
  config: {
    titleBarStyle: "hiddenInset",
    titleBarTransparent: true,
    transparent: true,
    vibrancy: true,
    trafficLights: true,
    trafficLightsX: 14,
    trafficLightsY: 12,
    nativeDragRegion: true,
    nativeDragRegionX: 92,
    nativeDragRegionHeight: 40,
  },
  popover: {
    titleBarStyle: "hiddenInset",
    titleBarTransparent: true,
    transparent: true,
    vibrancy: true,
    trafficLights: false,
    trafficLightsX: 14,
    trafficLightsY: 12,
    nativeDragRegion: false,
    nativeDragRegionX: 0,
    nativeDragRegionHeight: 0,
  },
};

export async function readWindowConfig(
  name: WindowName,
): Promise<WindowConfig> {
  return DEFAULT_WINDOW_CONFIGS[name];
}

function toNativeWindowAppearance(appearance: WindowAppearance): number {
  switch (appearance) {
    case "light":
      return 1;
    case "dark":
      return 2;
    case "system":
    default:
      return 0;
  }
}

function getMacWindowEffectsLibrary(): MacWindowEffectsLibrary | null {
  if (macWindowEffectsLib !== null) {
    return macWindowEffectsLib;
  }

  const dylibPath = join(import.meta.dir, "libs", "libMacWindowEffects.dylib");

  if (!existsSync(dylibPath)) {
    console.warn(
      `Native macOS effects lib not found at ${dylibPath}. Falling back to transparent-only mode.`,
    );
    return null;
  }

  try {
    macWindowEffectsLib = dlopen(dylibPath, {
      enableWindowVibrancy: {
        args: [FFIType.ptr, FFIType.bool, FFIType.i32],
        returns: FFIType.bool,
      },
      setWindowAppearance: {
        args: [FFIType.ptr, FFIType.i32],
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
      setTrafficLightsVisible: {
        args: [FFIType.ptr, FFIType.bool],
        returns: FFIType.bool,
      },
      setNativeWindowDragRegion: {
        args: [FFIType.ptr, FFIType.f64, FFIType.f64],
        returns: FFIType.bool,
      },
    }) as unknown as MacWindowEffectsLibrary;
  } catch (error) {
    console.warn("Failed to load native macOS effects lib:", error);
    return null;
  }

  return macWindowEffectsLib;
}

function getWindowAppearance(windowName: WindowName): WindowAppearance {
  return windowName === "main" ? currentWindowAppearance : "system";
}

function trackMacOSWindow(windowName: WindowName, window: BrowserWindow) {
  const windows = trackedMacOSWindows[windowName];

  if (windows.has(window)) {
    return;
  }

  windows.add(window);
  window.on("close", () => {
    windows.delete(window);
  });
}

export function setMacOSWindowAppearance(
  appearance: WindowAppearance,
): boolean {
  currentWindowAppearance = appearance;

  const lib = getMacWindowEffectsLibrary();
  if (lib === null) {
    return false;
  }

  const windows = trackedMacOSWindows.main;
  if (windows.size === 0) {
    return true;
  }

  const nativeAppearance = toNativeWindowAppearance(appearance);
  let success = true;

  for (const window of windows) {
    const applied = lib.symbols.setWindowAppearance(
      window.ptr,
      nativeAppearance,
    );
    success = applied && success;
  }

  return success;
}

export function applyMacOSWindowEffects(
  windowName: WindowName,
  mainWindow: BrowserWindow,
  windowConfig: WindowConfig,
) {
  const lib = getMacWindowEffectsLibrary();
  if (lib === null) {
    return;
  }

  trackMacOSWindow(windowName, mainWindow);

  const windowAppearance = getWindowAppearance(windowName);

  try {
    const vibrancyEnabled = windowConfig.vibrancy
      ? lib.symbols.enableWindowVibrancy(
          mainWindow.ptr,
          windowConfig.titleBarTransparent,
          toNativeWindowAppearance(windowAppearance),
        )
      : false;
    const appearanceEnabled = lib.symbols.setWindowAppearance(
      mainWindow.ptr,
      toNativeWindowAppearance(windowAppearance),
    );
    const shadowEnabled = lib.symbols.ensureWindowShadow(mainWindow.ptr);
    lib.symbols.setTrafficLightsVisible(
      mainWindow.ptr,
      windowConfig.trafficLights,
    );
    const alignButtons = () =>
      windowConfig.trafficLights
        ? lib.symbols.setWindowTrafficLightsPosition(
            mainWindow.ptr,
            windowConfig.trafficLightsX,
            windowConfig.trafficLightsY,
          )
        : false;
    const alignNativeDragRegion = () =>
      windowConfig.nativeDragRegion
        ? lib.symbols.setNativeWindowDragRegion(
            mainWindow.ptr,
            windowConfig.nativeDragRegionX,
            windowConfig.nativeDragRegionHeight,
          )
        : false;

    const alignMacOSControls = () => {
      alignButtons();
      alignNativeDragRegion();
    };

    const scheduleAlignMacOSControls = (() => {
      let alignTimeout: ReturnType<typeof setTimeout> | null = null;

      return (delayMs: number) => {
        if (alignTimeout !== null) {
          clearTimeout(alignTimeout);
        }

        alignTimeout = setTimeout(() => {
          alignTimeout = null;
          alignMacOSControls();
        }, delayMs);
      };
    })();

    mainWindow.on("resize", () => {
      // Keep controls pinned during live resize.
      alignMacOSControls();

      // Re-apply once Cocoa finishes the current resize pass.
      scheduleAlignMacOSControls(70);
    });

    // Initial alignment once the window is fully created and laid out.
    scheduleAlignMacOSControls(120);

    console.log(
      `macOS effects applied (window=${windowName}, vibrancy=${vibrancyEnabled}, appearance=${appearanceEnabled}, shadow=${shadowEnabled}, trafficLights=${windowConfig.trafficLights}, nativeDrag=${windowConfig.nativeDragRegion}, theme=${windowAppearance})`,
    );
  } catch (error) {
    console.warn("Failed to apply native macOS effects:", error);
  }
}
