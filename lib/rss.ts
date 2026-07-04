import Parser from "rss-parser";
import { prisma } from "./prisma";
import { tagTitle } from "./tags";
import { translateTitle } from "./translate";
import { extractArticlePublishedAt, extractWebHeadlines } from "./web";

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
  feedId: string;
}) {
  const tags = await tagTitle(data.title);

  await prisma.article.create({
    data: {
      title: data.title,
      link: data.link,
      source: data.source,
      publishedAt: data.publishedAt,
      publishedAtSource: data.publishedAtSource,
      companyTags: JSON.stringify(tags.companyTags),
      topicTags: JSON.stringify(tags.topicTags),
      feedId: data.feedId
    }
  });

  try {
    const translatedTitle = await translateTitle(data.title);
    if (translatedTitle) {
      await prisma.article.update({
        where: { link: data.link },
        data: { translatedTitle }
      });
    }
  } catch {
    // Translation is best-effort during refresh; manual batch translation can fill gaps later.
  }
}

export async function refreshFeeds(feedId?: string) {
  const feeds = await prisma.feed.findMany({
    where: {
      enabled: true,
      ...(feedId ? { id: feedId } : {})
    },
    orderBy: { createdAt: "desc" }
  });

  let created = 0;
  const errors: Array<{ feed: string; message: string }> = [];
  const existing = await loadExistingArticleKeys();
  const cutoff = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

  for (const feed of feeds) {
    try {
      if (feed.type === "WEB") {
        const headlines = await extractWebHeadlines(feed.url);
        const source = feed.name || new URL(feed.url).hostname;

        for (const item of headlines) {
          const title = item.title.trim();
          const link = item.link.trim();
          const normalizedTitle = normalizeTitle(title);
          if (!title || !link || existing.titles.has(normalizedTitle) || existing.links.has(link)) continue;
          const parsedPublishedAt = await extractArticlePublishedAt(link).catch(() => null);
          const publishedAt = parsedPublishedAt || new Date();
          const publishedAtSource = parsedPublishedAt ? "PAGE" : "CRAWLED";
          if (!isRecentPublishedAt(publishedAt, cutoff)) continue;

          await createArticle({
            title,
            link,
            source,
            publishedAt,
            publishedAtSource,
            feedId: feed.id
          });

          existing.titles.add(normalizedTitle);
          existing.links.add(link);
          created += 1;
        }

        continue;
      }

      const parsed = await parser.parseURL(feed.url);
      const source = feed.name || parsed.title || new URL(feed.url).hostname;

      for (const item of parsed.items) {
        const title = item.title?.trim();
        const link = item.link?.trim() || item.guid?.trim();
        if (!title || !link) continue;

        const normalizedTitle = normalizeTitle(title);
        if (existing.titles.has(normalizedTitle) || existing.links.has(link)) continue;

        const publishedAt = item.isoDate || item.pubDate ? new Date(item.isoDate || item.pubDate || "") : null;
        const validPublishedAt = publishedAt && !Number.isNaN(publishedAt.getTime()) ? publishedAt : null;
        if (!isRecentPublishedAt(validPublishedAt, cutoff)) continue;

        await createArticle({
          title,
          link,
          source,
          publishedAt: validPublishedAt,
          publishedAtSource: "FEED",
          feedId: feed.id
        });

        existing.titles.add(normalizedTitle);
        existing.links.add(link);
        created += 1;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown RSS error";
      errors.push({ feed: feed.name, message });
    }
  }

  return { created, checkedFeeds: feeds.length, errors };
}
