import { endOfDay, startOfDay, startOfWeek } from "date-fns";
import { NextResponse } from "next/server";
import { ensureDatabaseSchema } from "@/lib/dbInit";
import { prisma } from "@/lib/prisma";
import { companyGroupedMarkdown, todayPoolMarkdown, weeklyFavoritesMarkdown } from "@/lib/markdown";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await ensureDatabaseSchema();
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") || "today";
  const now = new Date();

  if (type === "weekly-favorites") {
    const articles = await prisma.article.findMany({
      where: {
        deleted: false,
        favorite: true,
        favoritedAt: { gte: startOfWeek(now, { weekStartsOn: 1 }) }
      },
      orderBy: [{ favoritedAt: "desc" }, { publishedAt: "desc" }]
    });
    return NextResponse.json({ markdown: weeklyFavoritesMarkdown(articles) });
  }

  if (type === "company") {
    const articles = await prisma.article.findMany({
      where: { deleted: false },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      take: 500
    });
    return NextResponse.json({ markdown: companyGroupedMarkdown(articles) });
  }

  const articles = await prisma.article.findMany({
    where: {
      deleted: false,
      publishedAt: { gte: startOfDay(now), lte: endOfDay(now) }
    },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }]
  });

  return NextResponse.json({ markdown: todayPoolMarkdown(articles) });
}
