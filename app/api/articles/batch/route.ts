import { NextResponse } from "next/server";
import { ensureDatabaseSchema } from "@/lib/dbInit";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const actions = ["delete", "favorite", "unfavorite"] as const;
type BatchAction = (typeof actions)[number];

function isBatchAction(value: unknown): value is BatchAction {
  return typeof value === "string" && actions.includes(value as BatchAction);
}

function parseIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const ids = value
    .filter((id): id is string => typeof id === "string" && id.trim().length > 0)
    .map((id) => id.trim());
  return Array.from(new Set<string>(ids));
}

export async function POST(request: Request) {
  try {
    await ensureDatabaseSchema();
    const body = await request.json().catch(() => ({}));
    const ids = parseIds(body.ids);

    if (ids.length === 0) {
      return NextResponse.json({ error: "请选择要操作的文章" }, { status: 400 });
    }
    if (!isBatchAction(body.action)) {
      return NextResponse.json({ error: "不支持的批量操作" }, { status: 400 });
    }

    const data =
      body.action === "delete"
        ? { deleted: true }
        : body.action === "favorite"
          ? { favorite: true, favoritedAt: new Date() }
          : { favorite: false, favoritedAt: null };

    const result = await prisma.article.updateMany({
      where: {
        id: { in: ids },
        deleted: false
      },
      data
    });

    return NextResponse.json({ updated: result.count });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
