import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { runInvalidHeadlineCleanupOnce, type CleanupArticle, type HeadlineCleanupStore } from "../lib/headlineCleanup";
import { normalizeHeadline, planExistingHeadlineCleanup, prepareHeadline } from "../lib/headlines";
import { extractWebHeadlinesFromHtml } from "../lib/web";

test("web extraction selects the best title per URL and filters site chrome and image ads", async () => {
  const fixture = await readFile(path.join(process.cwd(), "tests", "fixtures", "arinsider-home.html"), "utf8");
  const headlines = extractWebHeadlinesFromHtml(fixture, "https://arinsider.co/");

  assert.deepEqual(headlines, [
    {
      title: "The Real Article Headline",
      link: "https://arinsider.co/2026/06/17/real-article/"
    },
    {
      title: "External XR News Worth Keeping",
      link: "https://news.example.com/2026/external-xr-story"
    },
    {
      title: "What Contact and About Mean for Spatial Computing",
      link: "https://arinsider.co/2026/07/contact-about-spatial-computing/"
    }
  ]);
});

test("RSS-style titles share HTML cleanup and validation", () => {
  assert.equal(normalizeHeadline("Breaking <b>XR News</b> &amp; Analysis"), "Breaking XR News & Analysis");
  assert.equal(
    prepareHeadline("Breaking <b>XR News</b> &amp; Analysis", "https://example.com/news/breaking-xr"),
    "Breaking XR News & Analysis"
  );
  assert.equal(
    prepareHeadline('<img src="ad.jpg" alt="" />', "https://example.com/landing?utm_source=feed"),
    null
  );
});

test("existing headline cleanup repairs meaningful image alt text and deletes high-confidence junk", () => {
  assert.deepEqual(
    planExistingHeadlineCleanup(
      '<img src="article.jpg" alt="A Legitimate Spatial Computing Headline" />',
      "https://example.com/2026/07/legitimate-article/"
    ),
    { action: "repair", title: "A Legitimate Spatial Computing Headline" }
  );
  assert.deepEqual(
    planExistingHeadlineCleanup('<img class="wp-image-26391" src="specs.jpg" alt="" />', "https://specs.com/?utm_source=ad"),
    { action: "delete" }
  );
  assert.deepEqual(planExistingHeadlineCleanup("Contact", "https://example.com/contact/"), { action: "delete" });
  assert.deepEqual(planExistingHeadlineCleanup("A Normal Article Headline", "https://example.com/news/normal"), { action: "keep" });
});

test("historical cleanup is idempotent and only acts on active articles supplied by the store", async () => {
  const articles: CleanupArticle[] = [
    {
      id: "repair",
      title: '<img src="article.jpg" alt="Recovered Article Headline" />',
      link: "https://example.com/news/recovered"
    },
    { id: "delete", title: "Contact", link: "https://example.com/contact/" },
    { id: "keep", title: "Existing Valid Headline", link: "https://example.com/news/valid" }
  ];
  const repairs: Array<[string, string]> = [];
  const deletions: string[] = [];
  let completed = false;
  let listCalls = 0;
  const store: HeadlineCleanupStore = {
    async hasCompleted() {
      return completed;
    },
    async listActiveArticles() {
      listCalls += 1;
      return articles;
    },
    async repairArticle(id, title) {
      repairs.push([id, title]);
    },
    async softDeleteArticle(id) {
      deletions.push(id);
    },
    async markCompleted() {
      completed = true;
    }
  };

  assert.deepEqual(await runInvalidHeadlineCleanupOnce(store), { repaired: 1, deleted: 1, skipped: false });
  assert.deepEqual(await runInvalidHeadlineCleanupOnce(store), { repaired: 0, deleted: 0, skipped: true });
  assert.deepEqual(repairs, [["repair", "Recovered Article Headline"]]);
  assert.deepEqual(deletions, ["delete"]);
  assert.equal(listCalls, 1);
});
