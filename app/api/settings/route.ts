import { NextResponse } from "next/server";
import { ensureDatabaseSchema } from "@/lib/dbInit";
import { prisma } from "@/lib/prisma";
import { readAppConfig, writeAppConfig } from "@/lib/settings";
const DATA_DIR_KEY = "dataDir";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    await ensureDatabaseSchema();
    const fileConfig = await readAppConfig();
    const configured = await prisma.appSetting.findUnique({ where: { key: DATA_DIR_KEY } });
    const apiKey = await prisma.appSetting.findUnique({ where: { key: "deepseekApiKey" } });
    return NextResponse.json({ dataDir: fileConfig.dataDir || configured?.value || process.env.VR_RADAR_DATA_DIR || "", defaultDataDir: process.env.VR_RADAR_DEFAULT_DATA_DIR || "", deepseekApiKey: apiKey?.value || "", restartRequired: false });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
export async function PATCH(request: Request) {
  try {
    await ensureDatabaseSchema();
    const body = await request.json();
    const dataDir = String(body.dataDir || "").trim();
    const deepseekApiKey = String(body.deepseekApiKey || "").trim();
    if (dataDir) {
      await prisma.appSetting.upsert({ where: { key: DATA_DIR_KEY }, create: { key: DATA_DIR_KEY, value: dataDir }, update: { value: dataDir } });
      await writeAppConfig({ ...(await readAppConfig()), dataDir });
    }
    if (deepseekApiKey) {
      await prisma.appSetting.upsert({ where: { key: "deepseekApiKey" }, create: { key: "deepseekApiKey", value: deepseekApiKey }, update: { value: deepseekApiKey } });
    }
    return NextResponse.json({ dataDir, deepseekApiKey, restartRequired: !!dataDir });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
