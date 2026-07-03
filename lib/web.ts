import * as cheerio from "cheerio";

export type WebHeadline = {
  title: string;
  link: string;
};

const ignoredProtocols = ["mailto:", "tel:", "javascript:"];

function cleanTitle(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export async function extractWebHeadlines(url: string): Promise<WebHeadline[]> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "VR Radar Lite/0.1"
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
