import { format } from "date-fns";
import { parseTags } from "./tags";

type ExportArticle = {
  title: string;
  link: string;
  source: string;
  publishedAt: Date | null;
  companyTags: string;
  topicTags: string;
  note: string;
};

function lineFor(article: ExportArticle) {
  const date = article.publishedAt ? format(article.publishedAt, "yyyy-MM-dd HH:mm") : "未标注时间";
  const companies = parseTags(article.companyTags).join(", ");
  const topics = parseTags(article.topicTags).join(", ");
  const tags = [companies && `公司: ${companies}`, topics && `主题: ${topics}`].filter(Boolean).join(" / ");
  const note = article.note ? `\n  - 备注：${article.note}` : "";
  return `- [${article.title}](${article.link})\n  - 来源：${article.source}｜发布时间：${date}${tags ? `｜${tags}` : ""}${note}`;
}

export function todayPoolMarkdown(articles: ExportArticle[]) {
  return [`# 今日标题池`, "", ...articles.map(lineFor), ""].join("\n");
}

export function weeklyFavoritesMarkdown(articles: ExportArticle[]) {
  return [`# 本周收藏标题`, "", ...articles.map(lineFor), ""].join("\n");
}

export function companyGroupedMarkdown(articles: ExportArticle[]) {
  const grouped = new Map<string, ExportArticle[]>();
  for (const article of articles) {
    const companies = parseTags(article.companyTags);
    const keys = companies.length ? companies : ["未分类公司"];
    for (const key of keys) {
      grouped.set(key, [...(grouped.get(key) || []), article]);
    }
  }

  const sections = Array.from(grouped.entries()).map(([company, items]) =>
    [`## ${company}`, "", ...items.map(lineFor), ""].join("\n")
  );

  return [`# 按公司分类的标题`, "", ...sections].join("\n");
}
