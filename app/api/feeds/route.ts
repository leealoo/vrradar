import { NextResponse } from "next/server";
import { ensureDatabaseSchema } from "@/lib/dbInit";
import { prisma } from "@/lib/prisma";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    await ensureDatabaseSchema();
    const feeds = await prisma.feed.findMany({ orderBy: { createdAt: "desc" }, include: { _count: { select: { articles: true } } } });
    return NextResponse.json(feeds);
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }); }
}
export async function POST(req: Request) {
  try {
    await ensureDatabaseSchema();
    const body = await req.json();
    if (Array.isArray(body)) {
      const results = [];
      for (const item of body) {
        const name = String(item.name || "").trim();
        const url = String(item.url || "").trim();
        const type = item.type === "WEB" ? "WEB" : "RSS";
        if (!name || !url) { results.push({ url, error: "Name and URL required" }); continue; }
        try { new URL(url); } catch { results.push({ url, error: "Invalid URL" }); continue; }
        try { const feed = await prisma.feed.create({ data: { name, url, type } }); results.push({ id: feed.id, name, url, type }); } catch (e) { results.push({ url, error: String(e) }); }
      }
      return NextResponse.json({ created: results.filter(r=>r.id).length, results }, { status: 201 });
    }
    const name = String(body.name || "").trim();
    const url = String(body.url || "").trim();
    const type = body.type === "WEB" ? "WEB" : "RSS";
    if (!name || !url) return NextResponse.json({ error: "Name and URL required" }, { status: 400 });
    try { new URL(url); } catch { return NextResponse.json({ error: "Invalid URL" }, { status: 400 }); }
    const feed = await prisma.feed.create({ data: { name, url, type } });
    return NextResponse.json(feed, { status: 201 });
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }); }
}
