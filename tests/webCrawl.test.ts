import assert from "node:assert/strict";
import test from "node:test";
import { crawlWebFeed, inspectWebPageFromHtml } from "../lib/web";

const rootUrl = "https://www.auganix.org/";
const archiveUrl = "https://www.auganix.org/2026/06/";
const recentUrl = "https://www.auganix.org/recent-xr-story/";
const oldUrl = "https://www.auganix.org/old-xr-story/";
const missingDateUrl = "https://www.auganix.org/missing-date/";

const pages = new Map<string, string>([
  [rootUrl, `
    <main>
      <article class="post-card"><h3><a href="/recent-xr-story/">A Recent XR Story Worth Keeping</a></h3></article>
      <article class="post-card"><a href="/2026/06/">June 16, 2026</a></article>
    </main>`],
  [archiveUrl, `
    <main><h1>Month: June 2026</h1>
      <article class="post-card"><h3><a href="/old-xr-story/">An Older XR Article From the Archive</a></h3><p><a href="/old-xr-story/" title="An Older XR Article From the Archive">… continue reading</a></p></article>
      <article class="post-card"><h3><a href="/missing-date/">An Archive Article Without a Date</a></h3></article>
      <article class="post-card"><a href="/2026/06/">June 16, 2026</a></article>
    </main>`],
  [recentUrl, `<html><head><meta property="og:type" content="article"><meta property="article:published_time" content="2026-07-17T09:00:00Z"></head><body><main><h1>A Recent XR Story Worth Keeping</h1></main></body></html>`],
  [oldUrl, `<html><head><meta property="og:type" content="article"><meta property="article:published_time" content="2026-06-16T09:00:00Z"></head><body><main><h1>An Older XR Article From the Archive</h1></main></body></html>`],
  [missingDateUrl, `<html><head><meta property="og:type" content="article"></head><body><main><h1>An Archive Article Without a Date</h1></main></body></html>`]
]);

async function fetchFixture(url: string) {
  const html = pages.get(url);
  if (!html) throw new Error(`Unexpected URL: ${url}`);
  return html;
}

test("date archives are collection pages rather than articles", () => {
  const inspection = inspectWebPageFromHtml(pages.get(archiveUrl)!, archiveUrl);
  assert.equal(inspection.kind, "COLLECTION");
  assert.equal(inspection.headlines.find((item) => item.link === oldUrl)?.title, "An Older XR Article From the Archive");
});

test("crawler traverses one collection level, avoids loops, and marks nested dates as required", async () => {
  const articles = await crawlWebFeed(rootUrl, { fetchPage: fetchFixture });
  assert.deepEqual(articles.map((item) => item.link), [recentUrl, oldUrl, missingDateUrl]);
  assert.equal(articles.find((item) => item.link === recentUrl)?.requiresReliableDate, false);
  assert.equal(articles.find((item) => item.link === oldUrl)?.publishedAt?.toISOString(), "2026-06-16T09:00:00.000Z");
  assert.equal(articles.find((item) => item.link === missingDateUrl)?.requiresReliableDate, true);
  assert.equal(articles.some((item) => item.link === archiveUrl), false);
});

test("correct feedback can override a collection-path heuristic", async () => {
  const articles = await crawlWebFeed(rootUrl, {
    fetchPage: fetchFixture,
    feedbackRules: {
      correctLinks: new Set([archiveUrl.replace(/\/$/, "")]),
      rejectedLinks: new Set(),
      rejectedStructures: new Set()
    }
  });
  assert.ok(articles.some((item) => item.link === archiveUrl));
  assert.equal(articles.some((item) => item.link === oldUrl), false);
});
