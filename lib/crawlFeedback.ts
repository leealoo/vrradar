export type CrawlVerdict = "CORRECT" | "REJECTED";
export type FeedbackOrigin = "USER" | "SYSTEM";

export type CrawlCandidateIdentity = {
  link: string;
  contextSignature: string;
  pathKind: string;
};

export type CrawlFeedbackSample = CrawlCandidateIdentity & {
  verdict: CrawlVerdict;
  normalizedLink?: string;
};

export type CrawlFeedbackRules = {
  correctLinks: Set<string>;
  rejectedLinks: Set<string>;
  rejectedStructures: Set<string>;
};

const trackingParameters = new Set(["fbclid", "gclid", "mc_cid", "mc_eid"]);

export function normalizeSiteHost(value: string) {
  try {
    return new URL(value).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function normalizeFeedbackLink(value: string) {
  try {
    const url = new URL(value);
    url.hash = "";
    for (const key of Array.from(url.searchParams.keys())) {
      if (key.toLowerCase().startsWith("utm_") || trackingParameters.has(key.toLowerCase())) {
        url.searchParams.delete(key);
      }
    }
    if (url.pathname !== "/") url.pathname = url.pathname.replace(/\/+$/, "");
    url.hostname = url.hostname.toLowerCase();
    return url.toString();
  } catch {
    return value.trim();
  }
}

export function classifyPathKind(value: string) {
  try {
    const { pathname, search } = new URL(value);
    const path = pathname.toLowerCase().replace(/\/+$/, "") || "/";
    if (/\/\d{4}\/\d{1,2}(?:\/page\/\d+)?$/.test(path)) return "DATE_ARCHIVE";
    if (/\/(?:category|tag|author)\//.test(path)) return "TAXONOMY";
    if (/\/page\/\d+$/.test(path)) return "PAGINATION";
    if (path.includes("/search") || /(?:^|[?&])s=/.test(search)) return "SEARCH";
    if (/\/\d{4}\/\d{1,2}\/\d{1,2}\//.test(`${path}/`)) return "DATED_ARTICLE";
    return "OTHER";
  } catch {
    return "OTHER";
  }
}

export function isCollectionPathKind(pathKind: string) {
  return ["DATE_ARCHIVE", "TAXONOMY", "PAGINATION", "SEARCH"].includes(pathKind);
}

function structureKey(candidate: Pick<CrawlCandidateIdentity, "contextSignature" | "pathKind">) {
  return `${candidate.contextSignature || "LEGACY"}\u0000${candidate.pathKind || "OTHER"}`;
}

export function buildFeedbackRules(samples: CrawlFeedbackSample[]): CrawlFeedbackRules {
  const correctLinks = new Set<string>();
  const rejectedLinks = new Set<string>();
  const structureCounts = new Map<string, { correct: number; rejected: number }>();

  for (const sample of samples) {
    const link = sample.normalizedLink || normalizeFeedbackLink(sample.link);
    if (sample.verdict === "CORRECT") correctLinks.add(link);
    else rejectedLinks.add(link);

    if (!sample.contextSignature || sample.contextSignature === "LEGACY") continue;
    const key = structureKey(sample);
    const counts = structureCounts.get(key) || { correct: 0, rejected: 0 };
    counts[sample.verdict === "CORRECT" ? "correct" : "rejected"] += 1;
    structureCounts.set(key, counts);
  }

  const rejectedStructures = new Set<string>();
  for (const [key, counts] of Array.from(structureCounts.entries())) {
    if (counts.rejected >= 2 && counts.correct === 0) rejectedStructures.add(key);
  }

  return { correctLinks, rejectedLinks, rejectedStructures };
}

export function evaluateCandidateFeedback(candidate: CrawlCandidateIdentity, rules: CrawlFeedbackRules) {
  const link = normalizeFeedbackLink(candidate.link);
  if (rules.correctLinks.has(link)) return "CORRECT" as const;
  if (rules.rejectedLinks.has(link) || rules.rejectedStructures.has(structureKey(candidate))) {
    return "REJECTED" as const;
  }
  return "UNREVIEWED" as const;
}

export function isStandaloneEnglishDateTitle(value: string) {
  return /^(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}$/i.test(
    value.trim()
  );
}
