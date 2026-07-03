import { NextResponse } from "next/server";
import { ensureDatabaseSchema } from "@/lib/dbInit";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  await ensureDatabaseSchema();
  const body = await request.json();
  const data: { name?: string; url?: string; enabled?: boolean; type?: "RSS" | "WEB" } = {};

  if (typeof body.name === "string") data.name = body.name.trim();
  if (typeof body.url === "string") data.url = body.url.trim();
  if (typeof body.enabled === "boolean") data.enabled = body.enabled;
  if (body.type === "RSS" || body.type === "WEB") data.type = body.type;

  const feed = await prisma.feed.update({
    where: { id: params.id },
    data
  });

  return NextResponse.json(feed);
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  await ensureDatabaseSchema();
  await prisma.feed.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
