import { subDays, endOfDay, startOfDay } from "date-fns";
import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { ensureDatabaseSchema } from "@/lib/dbInit";
import { prisma } from "@/lib/prisma";
import { parseTags } from "@/lib/tags";
import { articleWithCrawlVerdict } from "@/lib/feedbackStore";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await ensureDatabaseSchema();
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim();
    const date = searchParams.get("date");
    const days = searchParams.get("days");
    const favorite = searchParams.get("favorite");
    const company = searchParams.get("company");
    const topic = searchParams.get("topic");

    const where: Prisma.ArticleWhereInput = {
      deleted: false,
      OR: [{ crawlFeedback: { is: null } }, { crawlFeedback: { is: { verdict: { not: "REJECTED" } } } }]
    };
    if (q) where.title = { contains: q };
    if (favorite === "true") where.favorite = true;
    if (date) {
      const parsed = new Date(date + "T00:00:00");
      where.publishedAt = { gte: startOfDay(parsed), lte: endOfDay(parsed) };
    }
    if (days) {
      const since = subDays(new Date(), parseInt(days));
      where.publishedAt = { gte: since };
    }

    const articles = await prisma.article.findMany({
      where,
      include: { crawlFeedback: { select: { verdict: true } } },
      orderBy: [{ createdAt: "desc" }],
      take: 500
    });

    const filtered = articles.filter((article) => {
      const companyOk = !company || parseTags(article.companyTags).includes(company);
      const topicOk = !topic || parseTags(article.topicTags).includes(topic);
      return companyOk && topicOk;
    });

    return NextResponse.json(filtered.map(articleWithCrawlVerdict));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
