import { NextResponse } from "next/server";
import { ensureDatabaseSchema } from "@/lib/dbInit";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  await ensureDatabaseSchema();
  const body = await request.json();
  const keyword = String(body.keyword || "").trim();

  if (!keyword) {
    return NextResponse.json({ error: "搜索关键词不能为空" }, { status: 400 });
  }

  const saved = await prisma.savedSearchKeyword.update({
    where: { id: params.id },
    data: { keyword }
  });

  return NextResponse.json(saved);
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  await ensureDatabaseSchema();
  await prisma.savedSearchKeyword.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
