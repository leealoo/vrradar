import * as cheerio from "cheerio";

const ignoredProtocols = ["mailto:", "tel:", "javascript:", "data:"];
const nonArticlePathSegments = new Set([
  "about",
  "account",
  "contact",
  "contact-us",
  "login",
  "log-in",
  "privacy",
  "privacy-policy",
  "terms",
  "terms-of-service",
  "wp-login.php"
]);
const socialHosts = [
  "addtoany.com",
  "facebook.com",
  "instagram.com",
  "linkedin.com",
  "pinterest.com",
  "snapchat.com",
  "threads.net",
  "tiktok.com",
  "twitter.com",
  "x.com",
  "youtube.com"
];
const genericUiTitles = new Set([
  "about",
  "contact",
  "contact us",
  "browse & customize",
  "get seen & heard",
  "get spatial smart",
  "home",
  "log in",
  "login",
  "more",
  "more news",
  "more news…",
  "read article",
  "see our sister publication: ai engage",
  "skip to content",
  "subscribe & get a free white paper",
  "write for ar insider"
]);
const mediaMarkupPattern = /<(?:img|picture|iframe|video|svg)\b/i;

export function cleanHeadlineText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function normalizeHeadline(rawValue: string | null | undefined): string | null {
  const raw = String(rawValue || "").trim();
  if (!raw) return null;

  const $ = cheerio.load(`<div id="headline-root">${raw}</div>`);
  const root = $("#headline-root");
  root.find("script,style,noscript,template,svg").remove();
  const title = cleanHeadlineText(root.text());
  return title || null;
}

export function extractImageAltHeadline(rawValue: string | null | undefined): string | null {
  const raw = String(rawValue || "").trim();
  if (!mediaMarkupPattern.test(raw)) return null;

  const $ = cheerio.load(`<div id="headline-root">${raw}</div>`);
  for (const image of $("#headline-root img[alt]").toArray()) {
    const title = normalizeHeadline($(image).attr("alt"));
    if (title && title.length >= 6 && !isGenericUiTitle(title)) return title;
  }
  return null;
}

export function isGenericUiTitle(title: string) {
  return genericUiTitles.has(cleanHeadlineText(title).toLowerCase());
}

function matchesHost(hostname: string, expected: string) {
  return hostname === expected || hostname.endsWith(`.${expected}`);
}

export function resolveHeadlineLink(rawHref: string, baseUrl?: string): string | null {
  const raw = rawHref.trim();
  if (!raw || raw.startsWith("#")) return null;
  if (ignoredProtocols.some((protocol) => raw.toLowerCase().startsWith(protocol))) return null;

  try {
    const parsed = baseUrl ? new URL(raw, baseUrl) : new URL(raw);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    if (baseUrl && parsed.hash) {
      const base = new URL(baseUrl);
      if (parsed.origin === base.origin && parsed.pathname === base.pathname) return null;
    }
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return null;
  }
}

export function isLikelyNonArticleLink(link: string, baseUrl?: string) {
  const resolved = resolveHeadlineLink(link, baseUrl);
  if (!resolved) return true;

  const parsed = new URL(resolved);
  const hostname = parsed.hostname.toLowerCase().replace(/^www\./, "");
  if (socialHosts.some((host) => matchesHost(hostname, host))) return true;

  let pathname = parsed.pathname;
  try {
    pathname = decodeURIComponent(pathname);
  } catch {
    // Keep the encoded path when a remote site emits malformed percent escapes.
  }
  const segments = pathname
    .toLowerCase()
    .split("/")
    .filter(Boolean);
  return segments.some((segment) => nonArticlePathSegments.has(segment));
}

export function prepareHeadline(rawTitle: string | null | undefined, link: string, baseUrl?: string): string | null {
  const title = normalizeHeadline(rawTitle);
  if (!title || title.length < 6) return null;
  if (isGenericUiTitle(title) || isLikelyNonArticleLink(link, baseUrl)) return null;
  return title;
}

export type ExistingHeadlineCleanup =
  | { action: "keep" }
  | { action: "repair"; title: string }
  | { action: "delete" };

export function planExistingHeadlineCleanup(title: string, link: string): ExistingHeadlineCleanup {
  const normalized = normalizeHeadline(title);
  const linkIsInvalid = isLikelyNonArticleLink(link);

  if (normalized && !linkIsInvalid && !isGenericUiTitle(normalized)) {
    if (normalized !== cleanHeadlineText(title)) return { action: "repair", title: normalized };
    return { action: "keep" };
  }

  const altTitle = extractImageAltHeadline(title);
  if (altTitle && !linkIsInvalid && !isGenericUiTitle(altTitle)) {
    return { action: "repair", title: altTitle };
  }

  if (linkIsInvalid || (normalized ? isGenericUiTitle(normalized) : mediaMarkupPattern.test(title))) {
    return { action: "delete" };
  }
  return { action: "keep" };
}
