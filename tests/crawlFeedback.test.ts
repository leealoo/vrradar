import assert from "node:assert/strict";
import test from "node:test";
import {
  buildFeedbackRules,
  evaluateCandidateFeedback,
  normalizeFeedbackLink
} from "../lib/crawlFeedback";

const candidate = {
  link: "https://example.com/news/story",
  contextSignature: "MAIN_ANCHOR:article.card",
  pathKind: "OTHER"
};

test("feedback normalizes tracking parameters and applies exact rejection immediately", () => {
  const rules = buildFeedbackRules([{
    ...candidate,
    link: "https://example.com/news/story?utm_source=home#top",
    verdict: "REJECTED"
  }]);
  assert.equal(normalizeFeedbackLink(candidate.link), "https://example.com/news/story");
  assert.equal(evaluateCandidateFeedback(candidate, rules), "REJECTED");
});

test("structural rejection requires two negatives and no correct counterexample", () => {
  const oneNegative = buildFeedbackRules([{ ...candidate, verdict: "REJECTED" }]);
  assert.equal(evaluateCandidateFeedback({ ...candidate, link: "https://example.com/news/new" }, oneNegative), "UNREVIEWED");

  const twoNegatives = buildFeedbackRules([
    { ...candidate, verdict: "REJECTED" },
    { ...candidate, link: "https://example.com/news/other", verdict: "REJECTED" }
  ]);
  assert.equal(evaluateCandidateFeedback({ ...candidate, link: "https://example.com/news/new" }, twoNegatives), "REJECTED");

  const withCorrect = buildFeedbackRules([
    { ...candidate, verdict: "REJECTED" },
    { ...candidate, link: "https://example.com/news/other", verdict: "REJECTED" },
    { ...candidate, link: "https://example.com/news/good", verdict: "CORRECT" }
  ]);
  assert.equal(evaluateCandidateFeedback({ ...candidate, link: "https://example.com/news/new" }, withCorrect), "UNREVIEWED");
  assert.equal(evaluateCandidateFeedback({ ...candidate, link: "https://example.com/news/good" }, withCorrect), "CORRECT");
});
