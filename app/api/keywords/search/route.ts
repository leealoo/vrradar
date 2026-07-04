import { NextResponse } from "next/server";
import { ensureDatabaseSchema } from "@/lib/dbInit";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  await ensureDatabaseSchema();
  const body = await request.json();
  const keyword = String(body.keyword || "").trim();

  if (!keyword) {
    return NextResponse.json({ error: "搜索关键词不能为空" }, { status: 400 });
  }

  const saved = await prisma.savedSearchKeyword.create({ data: { keyword } });
  return NextResponse.json(saved, { status: 201 });
}
