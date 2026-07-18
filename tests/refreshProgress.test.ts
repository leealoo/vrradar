import assert from "node:assert/strict";
import test from "node:test";
import { createRefreshProgressTracker, NdjsonParser, type RefreshProgressSnapshot } from "../lib/refreshProgress";

test("zero-feed progress starts empty and completes at 100 percent semantics", () => {
  const updates: RefreshProgressSnapshot[] = [];
  const tracker = createRefreshProgressTracker(0, (progress) => updates.push(progress));

  tracker.initialize();
  tracker.complete();

  assert.deepEqual(updates.map(({ stage, completedFeeds, remainingFeeds }) => ({ stage, completedFeeds, remainingFeeds })), [
    { stage: "starting", completedFeeds: 0, remainingFeeds: 0 },
    { stage: "completed", completedFeeds: 0, remainingFeeds: 0 }
  ]);
});

test("progress counts each committed article and every completed website", () => {
  const updates: RefreshProgressSnapshot[] = [];
  const tracker = createRefreshProgressTracker(2, (progress) => updates.push(progress));

  tracker.initialize();
  tracker.startFeed({ id: "one", name: "First site" });
  tracker.articleCreated();
  tracker.articleCreated();
  tracker.finishFeed();
  tracker.startFeed({ id: "two", name: "Failed site" });
  tracker.finishFeed();
  const final = tracker.complete();

  assert.equal(updates[1].currentFeed?.name, "First site");
  assert.equal(updates[2].created, 1);
  assert.equal(updates[3].created, 2);
  assert.equal(updates[4].remainingFeeds, 1);
  assert.equal(updates[6].remainingFeeds, 0);
  assert.deepEqual(final, {
    stage: "completed",
    totalFeeds: 2,
    completedFeeds: 2,
    remainingFeeds: 0,
    created: 2,
    currentFeed: null
  });
});

test("a throwing progress listener does not interrupt refresh tracking", () => {
  const tracker = createRefreshProgressTracker(1, () => {
    throw new Error("client disconnected");
  });

  assert.doesNotThrow(() => {
    tracker.initialize();
    tracker.startFeed({ id: "one", name: "One" });
    tracker.articleCreated();
    tracker.finishFeed();
    tracker.complete();
  });
  assert.equal(tracker.getSnapshot().created, 1);
});

test("NDJSON parser handles full lines, split lines, multiple lines and trailing data", () => {
  const messages: Array<{ value: number }> = [];
  const parser = new NdjsonParser<{ value: number }>((message) => messages.push(message));

  parser.push('{"value":1}\n');
  parser.push('{"val');
  parser.push('ue":2}\n{"value":3}\n{"value":');
  parser.push("4}");
  parser.finish();

  assert.deepEqual(messages, [{ value: 1 }, { value: 2 }, { value: 3 }, { value: 4 }]);
});
