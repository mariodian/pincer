// macOS Window Effects - Native macOS visual effects via FFI
import { existsSync } from "node:fs";
import { join } from "node:path";

import { dlopen, FFIType, type Pointer } from "bun:ffi";
import { BrowserWindow } from "electrobun/main";

import type { DragRegion } from "../../shared/dragRegion";
import { logger } from "../services/loggerService";
import type { WindowConfig, WindowName } from "./windowConfig";

export type WindowAppearance = "system" | "light" | "dark";

type MacWindowEffectsLibrary = {
  symbols: {
    setWindowMinSize: (
      windowPtr: Pointer,
      width?: number,
      height?: number,
    ) => boolean;
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
      maxX: number,
    ) => boolean;
  };
};

const MAX_DRAG_COORDINATE = 10000;

let currentWindowAppearance: WindowAppearance = "system";
let mainDragRegion: DragRegion | null = null;
let macWindowEffectsLib: MacWindowEffectsLibrary | null = null;
const trackedMacOSWindows: Record<WindowName, Set<BrowserWindow>> = {
  main: new Set<BrowserWindow>(),
  popover: new Set<BrowserWindow>(),
};
const trackedWindowConfigs = new WeakMap<BrowserWindow, WindowConfig>();

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

function readWindowPtr(window: BrowserWindow): Pointer | null {
  const ptr = window.ptr;
  if (ptr === null) {
    logger.warn("native", "Native window pointer is unavailable");
  }
  return ptr;
}

function getMacWindowEffectsLibrary(): MacWindowEffectsLibrary | null {
  if (macWindowEffectsLib !== null) {
    return macWindowEffectsLib;
  }

  const dylibPath = join(import.meta.dir, "libs", "libMacOS.dylib");

  if (!existsSync(dylibPath)) {
    logger.warn(
      "native",
      `Native macOS lib not found at ${dylibPath}. Falling back to transparent-only mode.`,
    );
    return null;
  }

  try {
    macWindowEffectsLib = dlopen(dylibPath, {
      setWindowMinSize: {
        args: [FFIType.ptr, FFIType.f64, FFIType.f64],
        returns: FFIType.bool,
      },
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
        args: [FFIType.ptr, FFIType.f64, FFIType.f64, FFIType.f64],
        returns: FFIType.bool,
      },
    }) as unknown as MacWindowEffectsLibrary;
  } catch (error) {
    logger.warn("native", "Failed to load native macOS effects lib:", error);
    return null;
  }

  return macWindowEffectsLib;
}

function trackMacOSWindow(
  windowName: WindowName,
  window: BrowserWindow,
  windowConfig: WindowConfig,
) {
  trackedWindowConfigs.set(window, windowConfig);
  const windows = trackedMacOSWindows[windowName];

  if (windows.has(window)) {
    return;
  }

  windows.add(window);
  window.on("close", () => {
    windows.delete(window);
    trackedWindowConfigs.delete(window);
  });
}

function isDragCoordinate(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= MAX_DRAG_COORDINATE
  );
}

function isDragRegion(value: unknown): value is DragRegion {
  if (value === null || typeof value !== "object") {
    return false;
  }

  const region = value as { x: unknown; height: unknown; maxX: unknown };
  return (
    isDragCoordinate(region.x) &&
    isDragCoordinate(region.height) &&
    isDragCoordinate(region.maxX)
  );
}

function dragRegionFor(
  windowName: WindowName,
  windowConfig: WindowConfig,
): DragRegion {
  if (windowName === "main" && mainDragRegion !== null) {
    return mainDragRegion;
  }

  return {
    x: windowConfig.nativeDragRegionX,
    height: windowConfig.nativeDragRegionHeight,
    maxX: windowConfig.nativeDragRegionMaxX,
  };
}

function applyDragRegion(
  window: BrowserWindow,
  windowName: WindowName,
  windowConfig: WindowConfig,
): boolean {
  const lib = getMacWindowEffectsLibrary();
  if (lib === null || !windowConfig.nativeDragRegion) {
    return false;
  }

  const ptr = readWindowPtr(window);
  if (ptr === null) {
    return false;
  }

  const region = dragRegionFor(windowName, windowConfig);
  return lib.symbols.setNativeWindowDragRegion(
    ptr,
    region.x,
    region.height,
    region.maxX,
  );
}

function applyTrackedMainDragRegion(): boolean {
  const windows = trackedMacOSWindows.main;
  if (windows.size === 0) {
    return true;
  }

  let success = true;
  for (const window of windows) {
    const windowConfig = trackedWindowConfigs.get(window);
    if (windowConfig === undefined) {
      success = false;
      continue;
    }

    success = applyDragRegion(window, "main", windowConfig) && success;
  }

  return success;
}

function getWindowAppearance(windowName: WindowName): WindowAppearance {
  return windowName === "main" ? currentWindowAppearance : "system";
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
    const ptr = readWindowPtr(window);
    if (ptr === null) {
      success = false;
      continue;
    }

    const applied = lib.symbols.setWindowAppearance(ptr, nativeAppearance);
    success = applied && success;
  }

  if (!success) {
    logger.warn(
      "native",
      `setMacOSWindowAppearance(${appearance}) returned false - some windows may not have received the appearance change`,
    );
  }

  return success;
}

/** Store the main-window drag strip and apply it to tracked main windows. */
export function setMacOSMainDragRegion(region: DragRegion): boolean {
  if (!isDragRegion(region)) {
    return false;
  }

  mainDragRegion = region;
  return applyTrackedMainDragRegion();
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

  trackMacOSWindow(windowName, mainWindow, windowConfig);

  const windowPtr = readWindowPtr(mainWindow);
  if (windowPtr === null) {
    return;
  }

  const windowAppearance = getWindowAppearance(windowName);

  try {
    const minSizeSet = lib.symbols.setWindowMinSize(
      windowPtr,
      windowConfig.minWidth,
      windowConfig.minHeight,
    );
    const vibrancyEnabled = windowConfig.vibrancy
      ? lib.symbols.enableWindowVibrancy(
          windowPtr,
          windowConfig.titleBarTransparent,
          toNativeWindowAppearance(windowAppearance),
        )
      : false;
    const appearanceEnabled = lib.symbols.setWindowAppearance(
      windowPtr,
      toNativeWindowAppearance(windowAppearance),
    );
    const shadowEnabled = lib.symbols.ensureWindowShadow(windowPtr);
    lib.symbols.setTrafficLightsVisible(windowPtr, windowConfig.trafficLights);
    const alignButtons = () => {
      const ptr = readWindowPtr(mainWindow);
      return windowConfig.trafficLights && ptr !== null
        ? lib.symbols.setWindowTrafficLightsPosition(
            ptr,
            windowConfig.trafficLightsX,
            windowConfig.trafficLightsY,
          )
        : false;
    };
    const alignNativeDragRegion = () =>
      applyDragRegion(mainWindow, windowName, windowConfig);

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

    logger.info(
      "native",
      `macOS effects applied (window=${windowName}, minSize=${minSizeSet}, vibrancy=${vibrancyEnabled}, appearance=${appearanceEnabled}, shadow=${shadowEnabled}, trafficLights=${windowConfig.trafficLights}, nativeDrag=${windowConfig.nativeDragRegion}, theme=${windowAppearance})`,
    );
  } catch (error) {
    logger.warn("native", "Failed to apply native macOS effects:", error);
  }
}
