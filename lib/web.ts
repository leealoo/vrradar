import * as cheerio from "cheerio";

export type WebHeadline = {
  title: string;
  link: string;
};

const ignoredProtocols = ["mailto:", "tel:", "javascript:"];
const userAgent = "VR Radar Lite/0.1";
const timezoneOffsets: Record<string, string> = {
  ET: "-04:00",
  EDT: "-04:00",
  EST: "-05:00",
  PT: "-07:00",
  PDT: "-07:00",
  PST: "-08:00",
  CT: "-05:00",
  CDT: "-05:00",
  CST: "-06:00",
  MT: "-06:00",
  MDT: "-06:00",
  MST: "-07:00",
  UTC: "Z",
  GMT: "Z"
};

function cleanTitle(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function validDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseEnglishPublishedText(value: string) {
  const cleaned = cleanTitle(value);
  const match = cleaned.match(
    /\b(?:published|posted|updated)\s+(?:on\s+)?([A-Z][a-z]+\.?\s+\d{1,2},\s+\d{4})(?:,?\s+(?:at\s+)?(\d{1,2}:\d{2})\s*(am|pm)\s*([A-Z]{2,4})?)?/i
  );
  if (!match) return null;

  const [, datePart, timePart, meridiem, timezone] = match;
  if (!timePart) return validDate(datePart);

  const zone = timezone ? timezoneOffsets[timezone.toUpperCase()] : "";
  return validDate(`${datePart} ${timePart} ${meridiem.toUpperCase()} ${zone}`.trim());
}

function valuesFromJsonLd(value: unknown): string[] {
  if (!value || typeof value !== "object") return [];
  if (Array.isArray(value)) return value.flatMap(valuesFromJsonLd);

  const record = value as Record<string, unknown>;
  const values: string[] = [];
  const published = record.datePublished || record.dateCreated || record.uploadDate;
  if (typeof published === "string") values.push(published);

  const graph = record["@graph"];
  if (graph) values.push(...valuesFromJsonLd(graph));

  return values;
}

export async function extractWebHeadlines(url: string): Promise<WebHeadline[]> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": userAgent
    }
  });

  if (!response.ok) {
    throw new Error(`网页请求失败：${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);
  const seen = new Set<string>();
  const headlines: WebHeadline[] = [];

  $("a[href]").each((_index, element) => {
    const rawHref = String($(element).attr("href") || "").trim();
    const title =
      cleanTitle($(element).find("h1,h2,h3,h4").first().text()) ||
      cleanTitle($(element).attr("title") || "") ||
      cleanTitle($(element).text());

    if (!rawHref || !title || title.length < 6) return;
    if (ignoredProtocols.some((protocol) => rawHref.toLowerCase().startsWith(protocol))) return;

    let link: string;
    try {
      link = new URL(rawHref, url).toString();
    } catch {
      return;
    }

    if (seen.has(link)) return;
    seen.add(link);
    headlines.push({ title, link });
  });

  return headlines.slice(0, 100);
}

export async function extractArticlePublishedAt(url: string): Promise<Date | null> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": userAgent
    }
  });

  if (!response.ok) {
    throw new Error(`网页请求失败：${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  const metaSelectors = [
    `meta[property="article:published_time"]`,
    `meta[property="og:article:published_time"]`,
    `meta[name="article:published_time"]`,
    `meta[name="date"]`,
    `meta[name="pubdate"]`,
    `meta[name="publishdate"]`,
    `meta[name="publish_date"]`,
    `meta[name="published-date"]`,
    `meta[name="datePublished"]`,
    `meta[itemprop="datePublished"]`
  ];

  for (const selector of metaSelectors) {
    const date = validDate($(selector).first().attr("content"));
    if (date) return date;
  }

  for (const element of $("script[type='application/ld+json']").toArray()) {
    try {
      const parsed = JSON.parse($(element).contents().text());
      for (const value of valuesFromJsonLd(parsed)) {
        const date = validDate(value);
        if (date) return date;
      }
    } catch {
      // Ignore malformed JSON-LD; visible text parsing below can still succeed.
    }
  }

  for (const element of $("time").toArray()) {
    const date = validDate($(element).attr("datetime") || $(element).attr("content") || $(element).text());
    if (date) return date;
  }

  const visibleText = cleanTitle($("body").text());
  return parseEnglishPublishedText(visibleText);
}
