import { Updater } from "electrobun/main";

export async function getChannel(): Promise<string> {
  try {
    return await Updater.localInfo.channel();
  } catch {
    return "stable";
  }
}
