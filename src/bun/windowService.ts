import { dlopen, FFIType } from "bun:ffi";
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

export type WindowName = "main" | "config" | "popover";

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

export function applyMacOSWindowEffects(
  mainWindow: BrowserWindow,
  windowConfig: WindowConfig,
) {
  const dylibPath = join(import.meta.dir, "libs", "libMacWindowEffects.dylib");

  if (!existsSync(dylibPath)) {
    console.warn(
      `Native macOS effects lib not found at ${dylibPath}. Falling back to transparent-only mode.`,
    );
    return;
  }

  try {
    const lib = dlopen(dylibPath, {
      enableWindowVibrancy: {
        args: [FFIType.ptr, FFIType.bool],
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
    });

    const vibrancyEnabled = windowConfig.vibrancy
      ? lib.symbols.enableWindowVibrancy(
          mainWindow.ptr,
          windowConfig.titleBarTransparent,
        )
      : false;
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
      `macOS effects applied (vibrancy=${vibrancyEnabled}, shadow=${shadowEnabled}, trafficLights=${windowConfig.trafficLights}, nativeDrag=${windowConfig.nativeDragRegion})`,
    );
  } catch (error) {
    console.warn("Failed to apply native macOS effects:", error);
  }
}
