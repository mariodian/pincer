import { Config, readConfig, writeConfig } from "./agentsService";

export interface WindowConfig {
  titleBarStyle: "hiddenInset" | "hidden" | "default";
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
    titleBarStyle: "hiddenInset",
    transparent: true,
    vibrancy: true,
    trafficLights: true,
    trafficLightsX: 14,
    trafficLightsY: 12,
    nativeDragRegion: true,
    nativeDragRegionX: 92,
    nativeDragRegionHeight: 40,
  },
  config: {
    titleBarStyle: "hiddenInset",
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

type StoredWindows = Partial<Record<WindowName, Partial<WindowConfig>>>;

function getStoredWindows(config: Config): StoredWindows {
  return (config.windows as StoredWindows | undefined) ?? {};
}

/**
 * Read window configuration for a specific window, merging with defaults
 */
export async function readWindowConfig(
  name: WindowName,
): Promise<WindowConfig> {
  const config = await readConfig();
  const windows = getStoredWindows(config);
  return { ...DEFAULT_WINDOW_CONFIGS[name], ...(windows[name] ?? {}) };
}

/**
 * Update window configuration for a specific window (merges with existing)
 */
export async function updateWindowConfig(
  name: WindowName,
  updates: Partial<WindowConfig>,
): Promise<WindowConfig> {
  const config = await readConfig();
  const windows = getStoredWindows(config);
  const updatedWindow: WindowConfig = {
    ...DEFAULT_WINDOW_CONFIGS[name],
    ...(windows[name] ?? {}),
    ...updates,
  };

  await writeConfig({
    ...config,
    windows: { ...windows, [name]: updatedWindow },
  });

  return updatedWindow;
}
