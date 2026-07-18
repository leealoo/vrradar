export type RefreshProgressStage = "starting" | "fetching" | "completed";

export type RefreshProgressFeed = {
  id: string;
  name: string;
};

export type RefreshProgressSnapshot = {
  stage: RefreshProgressStage;
  totalFeeds: number;
  completedFeeds: number;
  remainingFeeds: number;
  created: number;
  currentFeed: RefreshProgressFeed | null;
};

export type RefreshResult = {
  created: number;
  checkedFeeds: number;
  errors: Array<{ feed: string; message: string }>;
};

export type RefreshStreamMessage =
  | { type: "progress"; progress: RefreshProgressSnapshot }
  | { type: "complete"; result: RefreshResult }
  | { type: "error"; message: string };

type ProgressListener = (progress: RefreshProgressSnapshot) => void;

export function createRefreshProgressTracker(totalFeeds: number, listener?: ProgressListener) {
  let completedFeeds = 0;
  let created = 0;
  let currentFeed: RefreshProgressFeed | null = null;
  let stage: RefreshProgressStage = "starting";

  function snapshot(): RefreshProgressSnapshot {
    return {
      stage,
      totalFeeds,
      completedFeeds,
      remainingFeeds: Math.max(0, totalFeeds - completedFeeds),
      created,
      currentFeed: currentFeed ? { ...currentFeed } : null
    };
  }

  function publish() {
    const progress = snapshot();
    try {
      listener?.(progress);
    } catch {
      // Progress reporting is observational and must never interrupt a refresh.
    }
    return progress;
  }

  return {
    initialize() {
      return publish();
    },
    startFeed(feed: RefreshProgressFeed) {
      stage = "fetching";
      currentFeed = { ...feed };
      return publish();
    },
    articleCreated() {
      created += 1;
      return publish();
    },
    finishFeed() {
      completedFeeds = Math.min(totalFeeds, completedFeeds + 1);
      return publish();
    },
    complete() {
      stage = "completed";
      completedFeeds = totalFeeds;
      currentFeed = null;
      return publish();
    },
    getSnapshot: snapshot
  };
}

export class NdjsonParser<T> {
  private buffer = "";

  constructor(private readonly onMessage: (message: T) => void) {}

  push(chunk: string) {
    this.buffer += chunk;
    const lines = this.buffer.split("\n");
    this.buffer = lines.pop() ?? "";
    for (const line of lines) this.parseLine(line);
  }

  finish() {
    if (this.buffer.trim()) this.parseLine(this.buffer);
    this.buffer = "";
  }

  private parseLine(line: string) {
    const value = line.trim();
    if (value) this.onMessage(JSON.parse(value) as T);
  }
}

export async function readNdjsonStream<T>(
  stream: ReadableStream<Uint8Array>,
  onMessage: (message: T) => void
) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  const parser = new NdjsonParser<T>(onMessage);

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    parser.push(decoder.decode(value, { stream: true }));
  }

  parser.push(decoder.decode());
  parser.finish();
}
