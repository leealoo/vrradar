import { NextResponse } from "next/server";
import { ensureDatabaseSchema } from "@/lib/dbInit";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    await ensureDatabaseSchema();
    const verdict = new URL(request.url).searchParams.get("verdict");
    const feedback = await prisma.crawlFeedback.findMany({
      where: {
        feedId: params.id,
        ...(verdict === "CORRECT" || verdict === "REJECTED" ? { verdict } : {})
      },
      orderBy: { updatedAt: "desc" },
      take: 500,
      include: { article: { select: { deleted: true } } }
    });
    return NextResponse.json(feedback);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
