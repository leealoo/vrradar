import { NextResponse } from "next/server";
import { ensureDatabaseSchema } from "@/lib/dbInit";
import { prisma } from "@/lib/prisma";
import { articleWithCrawlVerdict, setArticleCrawlVerdict } from "@/lib/feedbackStore";
import type { CrawlVerdict } from "@/lib/crawlFeedback";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  await ensureDatabaseSchema();
  const body = await request.json();
  const data: { favorite?: boolean; favoritedAt?: Date | null; deleted?: boolean } = {};

  if (typeof body.favorite === "boolean") {
    data.favorite = body.favorite;
    data.favoritedAt = body.favorite ? new Date() : null;
  }
  if (typeof body.deleted === "boolean") data.deleted = body.deleted;

  const requestedVerdict: CrawlVerdict | null | undefined =
    body.crawlVerdict === "CORRECT" || body.crawlVerdict === "REJECTED"
      ? body.crawlVerdict
      : body.crawlVerdict === null
        ? null
        : undefined;

  await prisma.article.update({
    where: { id: params.id },
    data
  });

  const article = requestedVerdict === undefined
    ? await prisma.article.findUnique({ where: { id: params.id }, include: { crawlFeedback: true } })
    : await setArticleCrawlVerdict(params.id, requestedVerdict);

  if (!article) return NextResponse.json({ error: "文章不存在" }, { status: 404 });
  return NextResponse.json(articleWithCrawlVerdict(article));
}
