import { NextResponse } from "next/server";
import { ensureDatabaseSchema } from "@/lib/dbInit";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  await ensureDatabaseSchema();
  const body = await request.json();
  const data: { category?: "COMPANY" | "TOPIC"; label?: string; keywords?: string } = {};

  if (body.category === "COMPANY" || body.category === "TOPIC") data.category = body.category;
  if (typeof body.label === "string") data.label = body.label.trim();
  if (Array.isArray(body.keywords)) {
    const keywords: string[] = body.keywords.map(String).map((keyword: string) => keyword.trim()).filter(Boolean);
    data.keywords = JSON.stringify(keywords);
  }

  const rule = await prisma.tagRule.update({
    where: { id: params.id },
    data
  });

  return NextResponse.json(rule);
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  await ensureDatabaseSchema();
  await prisma.tagRule.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
