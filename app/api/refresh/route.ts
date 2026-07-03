import { NextResponse } from "next/server";
import { ensureDatabaseSchema } from "@/lib/dbInit";
import { refreshFeeds } from "@/lib/rss";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    await ensureDatabaseSchema();
    const body = await request.json().catch(() => ({}));
    const result = await refreshFeeds(body.feedId);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
