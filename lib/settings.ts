import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

export type AppConfig = {
  dataDir?: string;
};

export function getConfigPath() {
  return process.env.VR_RADAR_CONFIG_PATH || "";
}

export async function readAppConfig(): Promise<AppConfig> {
  const configPath = getConfigPath();
  if (!configPath) return {};

  try {
    return JSON.parse(await readFile(configPath, "utf8")) as AppConfig;
  } catch {
    return {};
  }
}

export async function writeAppConfig(config: AppConfig) {
  const configPath = getConfigPath();
  if (!configPath) return;

  await mkdir(path.dirname(configPath), { recursive: true });
  await writeFile(configPath, JSON.stringify(config, null, 2), "utf8");
}
