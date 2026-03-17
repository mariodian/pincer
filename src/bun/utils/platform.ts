export function isMacOS(): boolean {
  return process.platform === "darwin";
}

export function isWindows(): boolean {
  return process.platform === "win32";
}

export function getPlatform(): "macos" | "win" | "linux" {
  const p = process.platform;
  return p === "darwin" ? "macos" : p === "win32" ? "win" : "linux";
}
