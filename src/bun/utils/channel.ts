import { Updater } from "electrobun/bun";

export async function getChannel(): Promise<string> {
  try {
    return await Updater.localInfo.channel();
  } catch {
    return "stable";
  }
}
