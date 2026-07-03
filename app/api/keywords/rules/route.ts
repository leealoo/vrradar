import { NextResponse } from "next/server";
import { ensureDatabaseSchema } from "@/lib/dbInit";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  await ensureDatabaseSchema();
  const body = await request.json();
  const category = body.category === "TOPIC" ? "TOPIC" : "COMPANY";
  const label = String(body.label || "").trim();
  const keywords: string[] = Array.isArray(body.keywords)
    ? body.keywords.map(String).map((keyword: string) => keyword.trim()).filter(Boolean)
    : [];

  if (!label) {
    return NextResponse.json({ error: "标签名称不能为空" }, { status: 400 });
  }

  const rule = await prisma.tagRule.create({
    data: {
      category,
      label,
      keywords: JSON.stringify(keywords)
    }
  });

  return NextResponse.json(rule, { status: 201 });
}
