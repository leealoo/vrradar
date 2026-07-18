import Parser from "rss-parser";
import { prisma } from "./prisma";
import { tagTitle } from "./tags";
import { translateTitle } from "./translate";
import { crawlWebFeed } from "./web";
import { prepareHeadline, resolveHeadlineLink } from "./headlines";
import { createRefreshProgressTracker, type RefreshProgressSnapshot } from "./refreshProgress";
import { loadFeedbackRulesForFeed } from "./feedbackStore";
import { classifyPathKind, evaluateCandidateFeedback } from "./crawlFeedback";

const parser = new Parser({
  timeout: 15000,
  headers: {
    "User-Agent": "VR Radar Lite/0.1"
  }
});

function normalizeTitle(title: string) {
  return title.trim().replace(/\s+/g, " ").toLowerCase();
}

async function loadExistingArticleKeys() {
  const articles = await prisma.article.findMany({ select: { title: true, link: true } });
  return {
    titles: new Set(articles.map((article) => normalizeTitle(article.title))),
    links: new Set(articles.map((article) => article.link))
  };
}

function isRecentPublishedAt(publishedAt: Date | null, cutoff: Date) {
  return Boolean(publishedAt && !Number.isNaN(publishedAt.getTime()) && publishedAt >= cutoff);
}

async function createArticle(data: {
  title: string;
  link: string;
  source: string;
  publishedAt: Date | null;
  publishedAtSource: "FEED" | "PAGE" | "CRAWLED" | "UNKNOWN";
  discoveredFromUrl: string;
  extractionMethod: string;
  contextSignature: string;
  feedId: string;
}, onCreated?: () => void) {
  const title = prepareHeadline(data.title, data.link);
  const link = resolveHeadlineLink(data.link);
  if (!title || !link) return false;

  const tags = await tagTitle(title);

  await prisma.article.create({
    data: {
      title,
      link,
      source: data.source,
      publishedAt: data.publishedAt,
      publishedAtSource: data.publishedAtSource,
      discoveredFromUrl: data.discoveredFromUrl,
      extractionMethod: data.extractionMethod,
      contextSignature: data.contextSignature,
      companyTags: JSON.stringify(tags.companyTags),
      topicTags: JSON.stringify(tags.topicTags),
      feedId: data.feedId
    }
  });

  onCreated?.();

  try {
    const translatedTitle = await translateTitle(title);
    if (translatedTitle) {
      await prisma.article.update({
        where: { link },
        data: { translatedTitle }
      });
    }
  } catch {
    // Translation is best-effort during refresh; manual batch translation can fill gaps later.
  }

  return true;
}

export async function refreshFeeds(
  feedId?: string,
  onProgress?: (progress: RefreshProgressSnapshot) => void
) {
  const feeds = await prisma.feed.findMany({
    where: {
      enabled: true,
      ...(feedId ? { id: feedId } : {})
    },
    orderBy: { createdAt: "desc" }
  });

  let created = 0;
  const errors: Array<{ feed: string; message: string }> = [];
  const progress = createRefreshProgressTracker(feeds.length, onProgress);
  progress.initialize();
  const existing = await loadExistingArticleKeys();
  const cutoff = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

  for (const feed of feeds) {
    progress.startFeed({ id: feed.id, name: feed.name || new URL(feed.url).hostname });
    try {
      const feedbackRules = await loadFeedbackRulesForFeed(feed.id, feed.url);
      if (feed.type === "WEB") {
        const headlines = await crawlWebFeed(feed.url, { feedbackRules });
        const source = feed.name || new URL(feed.url).hostname;

        for (const item of headlines) {
          const link = resolveHeadlineLink(item.link.trim(), feed.url);
          const title = link ? prepareHeadline(item.title, link, feed.url) : null;
          if (!title || !link) continue;
          const normalizedTitle = normalizeTitle(title);
          if (existing.titles.has(normalizedTitle) || existing.links.has(link)) continue;
          if (item.requiresReliableDate && !item.publishedAt) continue;
          const publishedAt = item.publishedAt || new Date();
          const publishedAtSource = item.publishedAt ? "PAGE" : "CRAWLED";
          if (!isRecentPublishedAt(publishedAt, cutoff)) continue;

          await createArticle({
            title,
            link,
            source,
            publishedAt,
            publishedAtSource,
            discoveredFromUrl: item.discoveredFromUrl,
            extractionMethod: item.extractionMethod,
            contextSignature: item.contextSignature,
            feedId: feed.id
          }, () => {
            existing.titles.add(normalizedTitle);
            existing.links.add(link);
            created += 1;
            progress.articleCreated();
          });
        }

        continue;
      }

      const parsed = await parser.parseURL(feed.url);
      const source = feed.name || parsed.title || new URL(feed.url).hostname;

      for (const item of parsed.items) {
        const rawLink = item.link?.trim() || item.guid?.trim();
        const link = rawLink ? resolveHeadlineLink(rawLink, feed.url) : null;
        const title = link ? prepareHeadline(item.title, link, feed.url) : null;
        if (!title || !link) continue;

        const normalizedTitle = normalizeTitle(title);
        if (existing.titles.has(normalizedTitle) || existing.links.has(link)) continue;
        if (evaluateCandidateFeedback({
          link,
          contextSignature: "RSS",
          pathKind: classifyPathKind(link)
        }, feedbackRules) === "REJECTED") continue;

        const publishedAt = item.isoDate || item.pubDate ? new Date(item.isoDate || item.pubDate || "") : null;
        const validPublishedAt = publishedAt && !Number.isNaN(publishedAt.getTime()) ? publishedAt : null;
        if (!isRecentPublishedAt(validPublishedAt, cutoff)) continue;

        await createArticle({
          title,
          link,
          source,
          publishedAt: validPublishedAt,
          publishedAtSource: "FEED",
          discoveredFromUrl: feed.url,
          extractionMethod: "RSS",
          contextSignature: "RSS",
          feedId: feed.id
        }, () => {
          existing.titles.add(normalizedTitle);
          existing.links.add(link);
          created += 1;
          progress.articleCreated();
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown RSS error";
      errors.push({ feed: feed.name, message });
    } finally {
      progress.finishFeed();
    }
  }

  progress.complete();

  return { created, checkedFeeds: feeds.length, errors };
}
