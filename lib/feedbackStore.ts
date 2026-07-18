import { prisma } from "./prisma";
import {
  buildFeedbackRules,
  classifyPathKind,
  normalizeFeedbackLink,
  normalizeSiteHost,
  type CrawlVerdict
} from "./crawlFeedback";

export async function setArticleCrawlVerdict(articleId: string, verdict: CrawlVerdict | null) {
  const article = await prisma.article.findUnique({
    where: { id: articleId },
    include: { feed: { select: { url: true } }, crawlFeedback: true }
  });
  if (!article) return null;

  if (!verdict) {
    await prisma.crawlFeedback.deleteMany({ where: { articleId } });
  } else {
    const feedUrl = article.feed?.url || "";
    const data = {
      feedId: article.feedId,
      siteHost: normalizeSiteHost(feedUrl || article.link),
      verdict,
      origin: "USER",
      titleSnapshot: article.title,
      linkSnapshot: article.link,
      normalizedLink: normalizeFeedbackLink(article.link),
      discoveredFromUrl: article.discoveredFromUrl || feedUrl,
      extractionMethod: article.extractionMethod || "LEGACY",
      contextSignature: article.contextSignature || "LEGACY",
      pathKind: classifyPathKind(article.link)
    };
    await prisma.crawlFeedback.upsert({
      where: { articleId },
      create: { articleId, ...data },
      update: data
    });
  }

  return prisma.article.findUnique({ where: { id: articleId }, include: { crawlFeedback: true } });
}

export async function setManyArticleCrawlVerdicts(articleIds: string[], verdict: CrawlVerdict | null) {
  let updated = 0;
  for (const id of articleIds) {
    if (await setArticleCrawlVerdict(id, verdict)) updated += 1;
  }
  return updated;
}

export async function loadFeedbackRulesForFeed(feedId: string, siteUrl?: string) {
  const siteHost = normalizeSiteHost(siteUrl || "");
  const feedback = await prisma.crawlFeedback.findMany({
    where: siteHost ? { siteHost } : { feedId },
    select: {
      verdict: true,
      normalizedLink: true,
      linkSnapshot: true,
      contextSignature: true,
      pathKind: true
    }
  });
  return buildFeedbackRules(
    feedback
      .filter((item): item is typeof item & { verdict: CrawlVerdict } => item.verdict === "CORRECT" || item.verdict === "REJECTED")
      .map((item) => ({
        verdict: item.verdict,
        normalizedLink: item.normalizedLink,
        link: item.linkSnapshot,
        contextSignature: item.contextSignature,
        pathKind: item.pathKind
      }))
  );
}

export function articleWithCrawlVerdict<T extends { crawlFeedback?: { verdict: string } | null }>(article: T) {
  const { crawlFeedback, ...rest } = article;
  return { ...rest, crawlVerdict: crawlFeedback?.verdict || null };
}
