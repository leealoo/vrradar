import * as cheerio from "cheerio";
import {
  classifyPathKind,
  evaluateCandidateFeedback,
  isCollectionPathKind,
  normalizeFeedbackLink,
  type CrawlFeedbackRules
} from "./crawlFeedback";
import { cleanHeadlineText, prepareHeadline, resolveHeadlineLink } from "./headlines";

export type WebHeadline = { title: string; link: string };

export type WebCandidate = WebHeadline & {
  publishedAt: Date | null;
  discoveredFromUrl: string;
  extractionMethod: string;
  contextSignature: string;
  pathKind: string;
};

export type InspectedWebPage = {
  kind: "ARTICLE" | "COLLECTION" | "UNKNOWN";
  publishedAt: Date | null;
  headlines: WebCandidate[];
};

export type DiscoveredWebArticle = WebCandidate & {
  requiresReliableDate: boolean;
};

type FetchPage = (url: string) => Promise<string>;

const userAgent = "VR Radar Lite/0.1";
const timezoneOffsets: Record<string, string> = {
  ET: "-04:00", EDT: "-04:00", EST: "-05:00",
  PT: "-07:00", PDT: "-07:00", PST: "-08:00",
  CT: "-05:00", CDT: "-05:00", CST: "-06:00",
  MT: "-06:00", MDT: "-06:00", MST: "-07:00",
  UTC: "Z", GMT: "Z"
};

const excludedContextSelector = [
  "header", "nav", "footer", "form", '[role="navigation"]', '[role="banner"]', '[role="contentinfo"]',
  '[class*="cookie-banner"]', '[id*="cookie-banner"]', '[class*="cookie-consent"]', '[id*="cookie-consent"]',
  '[class*="advert"]', '[id*="advert"]', '[class*="sponsor"]', '[id*="sponsor"]',
  '[class*="promo"]', '[id*="promo"]', '[class*="social-share"]', '[class*="share-buttons"]'
].join(",");

const articleContextSelector = [
  "article", '[class*="article"]', '[class*="post-"]', '[class~="post"]', '[class*="story"]', '[class*="entry"]'
].join(",");

const mainContentSelector = ["main", '[role="main"]', "#content", '[class~="content"]', '[class*="main-content"]'].join(",");
const monthPattern = "January|February|March|April|May|June|July|August|September|October|November|December";

function validDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseEnglishDateText(value: string) {
  const cleaned = cleanHeadlineText(value);
  const published = cleaned.match(
    new RegExp(`\\b(?:published|posted|updated)\\s+(?:on\\s+)?(${monthPattern}\\.?\\s+\\d{1,2},\\s+\\d{4})(?:,?\\s+(?:at\\s+)?(\\d{1,2}:\\d{2})\\s*(am|pm)\\s*([A-Z]{2,4})?)?`, "i")
  );
  const standalone = cleaned.match(new RegExp(`\\b(${monthPattern})\\.?\\s+\\d{1,2},\\s+\\d{4}\\b`, "i"));
  if (!published) return standalone ? validDate(standalone[0]) : null;

  const [, datePart, timePart, meridiem, timezone] = published;
  if (!timePart) return validDate(datePart);
  const zone = timezone ? timezoneOffsets[timezone.toUpperCase()] : "";
  return validDate(`${datePart} ${timePart} ${meridiem.toUpperCase()} ${zone}`.trim());
}

function jsonLdRecords(value: unknown): Array<Record<string, unknown>> {
  if (!value || typeof value !== "object") return [];
  if (Array.isArray(value)) return value.flatMap(jsonLdRecords);
  const record = value as Record<string, unknown>;
  return [record, ...jsonLdRecords(record["@graph"]), ...jsonLdRecords(record.itemListElement)];
}

function stableContextSignature(anchor: cheerio.Cheerio<any>, method: string) {
  const semantic = anchor.closest(articleContextSelector).first();
  const container = semantic.length ? semantic : anchor.parent();
  const element = container.get(0);
  const tag = element && "tagName" in element ? String(element.tagName).toLowerCase() : "unknown";
  const classes = String(container.attr("class") || "")
    .split(/\s+/)
    .filter((value) => value && !/\d{3,}/.test(value))
    .slice(0, 3)
    .sort()
    .join(".");
  return `${method}:${tag}${classes ? `.${classes}` : ""}`;
}

function dateFromContainer($: cheerio.CheerioAPI, container: cheerio.Cheerio<any>) {
  for (const element of container.find("time").addBack("time").toArray()) {
    const item = $(element);
    const date = validDate(item.attr("datetime") || item.attr("content")) || parseEnglishDateText(item.text());
    if (date) return date;
  }
  const dateText = container
    .find('[class*="date"], [class*="published"], [class*="time"], .entry-meta, .post-meta')
    .first()
    .text();
  return parseEnglishDateText(dateText);
}

type RankedCandidate = WebCandidate & { score: number; order: number };

export function extractWebCandidatesFromHtml(html: string, url: string): WebCandidate[] {
  const $ = cheerio.load(html);
  $("script,style,noscript,template,svg").remove();
  const candidates = new Map<string, RankedCandidate>();

  $("a[href]").each((index, element) => {
    const anchor = $(element);
    if (anchor.closest(excludedContextSelector).length) return;
    const link = resolveHeadlineLink(String(anchor.attr("href") || "").trim(), url);
    if (!link) return;

    const innerHeading = anchor.find("h1,h2,h3,h4").first();
    const outerHeading = anchor.closest("h1,h2,h3,h4");
    const headingText = cleanHeadlineText((innerHeading.length ? innerHeading : outerHeading).first().text());
    const anchorText = cleanHeadlineText(anchor.text());
    const titleAttribute = cleanHeadlineText(anchor.attr("title") || "");
    const inArticle = anchor.closest(articleContextSelector).length > 0;
    const inMainContent = anchor.closest(mainContentSelector).length > 0;

    let rawTitle = "";
    let score = 0;
    let extractionMethod = "";
    if (headingText) {
      rawTitle = headingText; score = 400; extractionMethod = "HEADING";
    } else if (/^(?:…|\.\.\.)?\s*(?:continue reading|read more)$/i.test(anchorText) && titleAttribute) {
      rawTitle = titleAttribute; score = 350; extractionMethod = "CONTINUATION_TITLE";
    } else if (anchorText && inArticle) {
      rawTitle = anchorText; score = 300; extractionMethod = "ARTICLE_ANCHOR";
    } else if (anchorText && inMainContent) {
      rawTitle = anchorText; score = 200; extractionMethod = "MAIN_ANCHOR";
    } else if (titleAttribute && (inArticle || inMainContent)) {
      rawTitle = titleAttribute; score = 100; extractionMethod = "TITLE_ATTRIBUTE";
    } else return;

    const title = prepareHeadline(rawTitle, link, url);
    if (!title) return;
    const card = anchor.closest(articleContextSelector).first();
    const publishedAt = dateFromContainer($, card.length ? card : anchor.parent());
    const ranked: RankedCandidate = {
      title,
      link,
      publishedAt,
      discoveredFromUrl: url,
      extractionMethod,
      contextSignature: stableContextSignature(anchor, extractionMethod),
      pathKind: classifyPathKind(link),
      score,
      order: index
    };
    const current = candidates.get(link);
    if (!current || score > current.score || (score === current.score && title.length > current.title.length)) {
      candidates.set(link, ranked);
    }
  });

  return Array.from(candidates.values())
    .sort((left, right) => left.order - right.order)
    .slice(0, 100)
    .map(({ score: _score, order: _order, ...candidate }) => candidate);
}

export function extractWebHeadlinesFromHtml(html: string, url: string): WebHeadline[] {
  return extractWebCandidatesFromHtml(html, url).map(({ title, link }) => ({ title, link }));
}

function extractPublishedAtFromHtml(html: string) {
  const $ = cheerio.load(html);
  const metaSelectors = [
    'meta[property="article:published_time"]', 'meta[property="og:article:published_time"]',
    'meta[name="article:published_time"]', 'meta[name="date"]', 'meta[name="pubdate"]',
    'meta[name="publishdate"]', 'meta[name="publish_date"]', 'meta[name="published-date"]',
    'meta[name="datePublished"]', 'meta[itemprop="datePublished"]'
  ];
  for (const selector of metaSelectors) {
    const date = validDate($(selector).first().attr("content"));
    if (date) return date;
  }

  for (const element of $("script[type='application/ld+json']").toArray()) {
    try {
      for (const record of jsonLdRecords(JSON.parse($(element).contents().text()))) {
        const value = record.datePublished || record.dateCreated || record.uploadDate;
        if (typeof value === "string") {
          const date = validDate(value);
          if (date) return date;
        }
      }
    } catch {
      // Malformed JSON-LD is ignored; visible article metadata is checked next.
    }
  }

  const articleHeader = $("article, main, [role='main']").first();
  const scoped = articleHeader.length ? articleHeader : $("body");
  const structuredDate = dateFromContainer($, scoped);
  if (structuredDate) return structuredDate;
  return parseEnglishDateText(scoped.find("h1").first().parent().text());
}

export function inspectWebPageFromHtml(html: string, url: string): InspectedWebPage {
  const $ = cheerio.load(html);
  const headlines = extractWebCandidatesFromHtml(html, url);
  const pathKind = classifyPathKind(url);
  let hasArticleSchema = $('meta[property="og:type"][content="article" i]').length > 0;
  let hasCollectionSchema = false;

  for (const element of $("script[type='application/ld+json']").toArray()) {
    try {
      for (const record of jsonLdRecords(JSON.parse($(element).contents().text()))) {
        const types = Array.isArray(record["@type"]) ? record["@type"] : [record["@type"]];
        hasArticleSchema ||= types.some((type) => ["Article", "NewsArticle", "BlogPosting"].includes(String(type)));
        hasCollectionSchema ||= types.some((type) => ["CollectionPage", "ItemList"].includes(String(type)));
      }
    } catch {
      // Structural HTML checks below remain available.
    }
  }

  const heading = cleanHeadlineText($("h1").first().text());
  const archiveHeading = /^(?:month|category|tag|author|archive|search results?)\s*:/i.test(heading);
  const kind = hasArticleSchema
    ? "ARTICLE"
    : (isCollectionPathKind(pathKind) && headlines.length > 0) || hasCollectionSchema || archiveHeading
      ? "COLLECTION"
      : "UNKNOWN";
  return { kind, publishedAt: extractPublishedAtFromHtml(html), headlines };
}

async function defaultFetchPage(url: string) {
  const response = await fetch(url, { headers: { "User-Agent": userAgent } });
  if (!response.ok) throw new Error(`网页请求失败：${response.status} ${response.statusText}`);
  return response.text();
}

export async function inspectWebPage(url: string, fetchPage: FetchPage = defaultFetchPage) {
  return inspectWebPageFromHtml(await fetchPage(url), url);
}

export async function crawlWebFeed(
  url: string,
  options: { fetchPage?: FetchPage; feedbackRules?: CrawlFeedbackRules; maxCollections?: number; maxArticles?: number } = {}
): Promise<DiscoveredWebArticle[]> {
  const fetchPage = options.fetchPage || defaultFetchPage;
  const feedbackRules = options.feedbackRules || { correctLinks: new Set(), rejectedLinks: new Set(), rejectedStructures: new Set() };
  const maxCollections = options.maxCollections ?? 10;
  const maxArticles = options.maxArticles ?? 100;
  const origin = new URL(url).origin;
  const root = inspectWebPageFromHtml(await fetchPage(url), url);
  const queue = root.headlines.map((candidate) => ({ candidate, collectionDepth: 0 }));
  const visited = new Set<string>();
  const articles: DiscoveredWebArticle[] = [];
  let inspectedArticles = 0;
  let inspectedCollections = 0;

  while (queue.length && inspectedArticles < maxArticles && articles.length < maxArticles) {
    const next = queue.shift()!;
    const key = normalizeFeedbackLink(next.candidate.link);
    if (visited.has(key)) continue;
    visited.add(key);

    let inspection: InspectedWebPage = { kind: "UNKNOWN", publishedAt: null, headlines: [] };
    try {
      inspection = await inspectWebPage(next.candidate.link, fetchPage);
    } catch {
      // Root-level candidates retain the previous crawl-time fallback; nested candidates require a reliable date.
    }

    const feedback = evaluateCandidateFeedback(next.candidate, feedbackRules);
    const isCollection = inspection.kind === "COLLECTION" && feedback !== "CORRECT";
    if (isCollection) {
      if (
        inspectedCollections < maxCollections &&
        next.collectionDepth < 1 &&
        new URL(next.candidate.link).origin === origin
      ) {
        inspectedCollections += 1;
        for (const child of inspection.headlines) queue.push({ candidate: child, collectionDepth: next.collectionDepth + 1 });
      }
      continue;
    }

    inspectedArticles += 1;
    if (feedback === "REJECTED") continue;
    articles.push({
      ...next.candidate,
      publishedAt: next.candidate.publishedAt || inspection.publishedAt,
      requiresReliableDate: next.collectionDepth > 0
    });
  }
  return articles;
}

export async function extractWebHeadlines(url: string): Promise<WebHeadline[]> {
  return extractWebHeadlinesFromHtml(await defaultFetchPage(url), url);
}

export async function extractArticlePublishedAt(url: string): Promise<Date | null> {
  return (await inspectWebPage(url)).publishedAt;
}
