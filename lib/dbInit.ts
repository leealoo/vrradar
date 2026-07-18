import { prisma } from "./prisma";
import { runInvalidHeadlineCleanupOnce } from "./headlineCleanup";
import { tagTitle } from "./tags";
import {
  classifyPathKind,
  isCollectionPathKind,
  isStandaloneEnglishDateTitle,
  normalizeFeedbackLink,
  normalizeSiteHost
} from "./crawlFeedback";

let initialized = false;
let initializing: Promise<void> | null = null;

const statements = [
  `CREATE TABLE IF NOT EXISTS "Feed" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'RSS',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "Article" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "translatedTitle" TEXT NOT NULL DEFAULT '',
    "link" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "publishedAt" DATETIME,
    "publishedAtSource" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "discoveredFromUrl" TEXT NOT NULL DEFAULT '',
    "extractionMethod" TEXT NOT NULL DEFAULT 'LEGACY',
    "contextSignature" TEXT NOT NULL DEFAULT 'LEGACY',
    "companyTags" TEXT NOT NULL DEFAULT '[]',
    "topicTags" TEXT NOT NULL DEFAULT '[]',
    "favorite" BOOLEAN NOT NULL DEFAULT false,
    "favoritedAt" DATETIME,
    "note" TEXT NOT NULL DEFAULT '',
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "feedId" TEXT,
    CONSTRAINT "Article_feedId_fkey" FOREIGN KEY ("feedId") REFERENCES "Feed" ("id") ON DELETE SET NULL ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "CrawlFeedback" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "articleId" TEXT NOT NULL,
    "feedId" TEXT,
    "siteHost" TEXT NOT NULL,
    "verdict" TEXT NOT NULL,
    "origin" TEXT NOT NULL DEFAULT 'USER',
    "titleSnapshot" TEXT NOT NULL,
    "linkSnapshot" TEXT NOT NULL,
    "normalizedLink" TEXT NOT NULL,
    "discoveredFromUrl" TEXT NOT NULL DEFAULT '',
    "extractionMethod" TEXT NOT NULL DEFAULT 'LEGACY',
    "contextSignature" TEXT NOT NULL DEFAULT 'LEGACY',
    "pathKind" TEXT NOT NULL DEFAULT 'OTHER',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CrawlFeedback_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CrawlFeedback_feedId_fkey" FOREIGN KEY ("feedId") REFERENCES "Feed" ("id") ON DELETE SET NULL ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "TagRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "category" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "keywords" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "SavedSearchKeyword" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "keyword" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "AppSetting" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Feed_url_key" ON "Feed"("url")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Article_link_key" ON "Article"("link")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "CrawlFeedback_articleId_key" ON "CrawlFeedback"("articleId")`,
  `CREATE INDEX IF NOT EXISTS "CrawlFeedback_siteHost_verdict_idx" ON "CrawlFeedback"("siteHost", "verdict")`,
  `CREATE INDEX IF NOT EXISTS "CrawlFeedback_feedId_verdict_idx" ON "CrawlFeedback"("feedId", "verdict")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "TagRule_category_label_key" ON "TagRule"("category", "label")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "SavedSearchKeyword_keyword_key" ON "SavedSearchKeyword"("keyword")`
];

async function ensureArticleColumns() {
  const columns = await prisma.$queryRawUnsafe<Array<{ name: string }>>(`PRAGMA table_info("Article")`);
  const columnNames = new Set(columns.map((column) => column.name));

  if (!columnNames.has("translatedTitle")) {
    await prisma.$executeRawUnsafe(`ALTER TABLE "Article" ADD COLUMN "translatedTitle" TEXT NOT NULL DEFAULT ''`);
  }
  if (!columnNames.has("deleted")) {
    await prisma.$executeRawUnsafe(`ALTER TABLE "Article" ADD COLUMN "deleted" BOOLEAN NOT NULL DEFAULT false`);
  }
  if (!columnNames.has("publishedAtSource")) {
    await prisma.$executeRawUnsafe(`ALTER TABLE "Article" ADD COLUMN "publishedAtSource" TEXT NOT NULL DEFAULT 'UNKNOWN'`);
  }
  if (!columnNames.has("discoveredFromUrl")) {
    await prisma.$executeRawUnsafe(`ALTER TABLE "Article" ADD COLUMN "discoveredFromUrl" TEXT NOT NULL DEFAULT ''`);
  }
  if (!columnNames.has("extractionMethod")) {
    await prisma.$executeRawUnsafe(`ALTER TABLE "Article" ADD COLUMN "extractionMethod" TEXT NOT NULL DEFAULT 'LEGACY'`);
  }
  if (!columnNames.has("contextSignature")) {
    await prisma.$executeRawUnsafe(`ALTER TABLE "Article" ADD COLUMN "contextSignature" TEXT NOT NULL DEFAULT 'LEGACY'`);
  }
}

async function backfillLegacyProvenance() {
  await prisma.$executeRawUnsafe(`
    UPDATE "Article"
    SET "discoveredFromUrl" = COALESCE((SELECT "url" FROM "Feed" WHERE "Feed"."id" = "Article"."feedId"), '')
    WHERE "discoveredFromUrl" = ''
  `);
}

async function recordObviousCollectionFeedback() {
  const articles = await prisma.article.findMany({
    where: { crawlFeedback: null },
    select: {
      id: true,
      title: true,
      link: true,
      feedId: true,
      discoveredFromUrl: true,
      extractionMethod: true,
      contextSignature: true,
      feed: { select: { url: true } }
    }
  });

  for (const article of articles) {
    const pathKind = classifyPathKind(article.link);
    if (!isStandaloneEnglishDateTitle(article.title) || !isCollectionPathKind(pathKind)) continue;
    await prisma.crawlFeedback.create({
      data: {
        articleId: article.id,
        feedId: article.feedId,
        siteHost: normalizeSiteHost(article.feed?.url || article.link),
        verdict: "REJECTED",
        origin: "SYSTEM",
        titleSnapshot: article.title,
        linkSnapshot: article.link,
        normalizedLink: normalizeFeedbackLink(article.link),
        discoveredFromUrl: article.discoveredFromUrl || article.feed?.url || "",
        extractionMethod: article.extractionMethod,
        contextSignature: article.contextSignature,
        pathKind
      }
    });
  }
}

async function cleanupInvalidHeadlinesOnce() {
  await runInvalidHeadlineCleanupOnce({
    async hasCompleted(key) {
      return Boolean(await prisma.appSetting.findUnique({ where: { key } }));
    },
    async listActiveArticles() {
      return prisma.article.findMany({
        where: { deleted: false },
        select: { id: true, title: true, link: true }
      });
    },
    async repairArticle(id, title) {
      const tags = await tagTitle(title);
      await prisma.article.update({
        where: { id },
        data: {
          title,
          translatedTitle: "",
          companyTags: JSON.stringify(tags.companyTags),
          topicTags: JSON.stringify(tags.topicTags)
        }
      });
    },
    async softDeleteArticle(id) {
      await prisma.article.update({ where: { id }, data: { deleted: true } });
    },
    async markCompleted(key, summary) {
      const value = JSON.stringify(summary);
      await prisma.appSetting.upsert({ where: { key }, create: { key, value }, update: { value } });
    }
  });
}

async function initializeDatabaseSchema() {
  for (const statement of statements) {
    await prisma.$executeRawUnsafe(statement);
  }
  await ensureArticleColumns();
  await backfillLegacyProvenance();
  await cleanupInvalidHeadlinesOnce();
  await recordObviousCollectionFeedback();
}

export async function ensureDatabaseSchema() {
  if (initialized) return;
  if (!initializing) {
    initializing = initializeDatabaseSchema().then(() => {
      initialized = true;
    }).finally(() => {
      initializing = null;
    });
  }
  await initializing;
}
