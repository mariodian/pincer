import { execSync } from "node:child_process";
import { platform } from "node:os";

export async function getMachineId(): Promise<string> {
  const p = platform();

  if (p === "darwin") {
    const out = execSync(
      "ioreg -rd1 -c IOPlatformExpertDevice | awk '/IOPlatformUUID/ {print $3}'",
    )
      .toString()
      .trim()
      .replace(/"/g, "");
    return out;
  }

  if (p === "linux") {
    try {
      return (await Bun.file("/etc/machine-id").text()).trim();
    } catch {
      return (await Bun.file("/var/lib/dbus/machine-id").text()).trim();
    }
  }

  if (p === "win32") {
    const out = execSync(
      "reg query HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Cryptography /v MachineGuid",
    ).toString();
    const match = out.match(/MachineGuid\s+REG_SZ\s+(.+)/);
    return match?.[1].trim() ?? crypto.randomUUID();
  }

  return crypto.randomUUID();
}
