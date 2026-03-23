// Window Service - Shared window configuration and types

import { MAIN_WINDOW } from "../config";

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
  minWidth?: number;
  minHeight?: number;
}

export type WindowName = "main" | "popover";

export const DEFAULT_WINDOW_CONFIGS: Record<WindowName, WindowConfig> = {
  main: {
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
    minWidth: MAIN_WINDOW.minWidth,
    minHeight: MAIN_WINDOW.minHeight,
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
