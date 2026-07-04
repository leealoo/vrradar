import { prisma } from "./prisma";

export const defaultTagRules = [
  { category: "COMPANY", label: "Meta", keywords: ["meta", "quest", "ray-ban", "rayban"] },
  { category: "COMPANY", label: "Apple", keywords: ["apple", "vision pro", "visionos"] },
  { category: "COMPANY", label: "Pico", keywords: ["pico"] },
  { category: "COMPANY", label: "Rokid", keywords: ["rokid"] },
  { category: "COMPANY", label: "XREAL", keywords: ["xreal", "nreal"] },
  { category: "COMPANY", label: "雷鸟", keywords: ["雷鸟", "rayneo"] },
  { category: "COMPANY", label: "VITURE", keywords: ["viture"] },
  { category: "COMPANY", label: "NVIDIA", keywords: ["nvidia", "geforce", "omniverse"] },
  { category: "COMPANY", label: "Sony", keywords: ["sony", "playstation vr", "ps vr", "psvr"] },
  { category: "COMPANY", label: "Canon", keywords: ["canon"] },
  { category: "TOPIC", label: "VR头显", keywords: ["vr headset", "headset", "头显", "vr一体机", "quest", "pico"] },
  { category: "TOPIC", label: "AR眼镜", keywords: ["ar glasses", "ar眼镜", "增强现实眼镜"] },
  { category: "TOPIC", label: "智能眼镜", keywords: ["smart glasses", "智能眼镜", "ai glasses", "ray-ban"] },
  { category: "TOPIC", label: "空间视频", keywords: ["spatial video", "空间视频", "volumetric"] },
  { category: "TOPIC", label: "游戏", keywords: ["game", "gaming", "游戏", "steamvr", "playstation"] },
  { category: "TOPIC", label: "线下娱乐", keywords: ["location-based", "lbe", "线下娱乐", "大空间", "主题乐园"] },
  { category: "TOPIC", label: "融资", keywords: ["funding", "financing", "raises", "融资", "投资"] },
  { category: "TOPIC", label: "供应链", keywords: ["supply chain", "supplier", "供应链", "面板", "光波导", "micro-oled"] },
  { category: "TOPIC", label: "系统更新", keywords: ["update", "系统更新", "firmware", "visionos", "horizon os"] }
] as const;

export const defaultSearchKeywords = ["Quest", "Vision Pro", "AR眼镜", "智能眼镜", "空间视频"];

export function parseTags(value: string | null | undefined) {
  if (!value) return [];
  try {
    const tags = JSON.parse(value);
    return Array.isArray(tags) ? tags.map(String) : [];
  } catch {
    return [];
  }
}

export function parseKeywords(value: string | null | undefined) {
  return parseTags(value).filter(Boolean);
}

export async function seedKeywordDefaults() {
  const ruleCount = await prisma.tagRule.count();
  if (ruleCount === 0) {
    await prisma.tagRule.createMany({
      data: defaultTagRules.map((rule) => ({
        category: rule.category,
        label: rule.label,
        keywords: JSON.stringify(rule.keywords)
      }))
    });
  }

  const searchCount = await prisma.savedSearchKeyword.count();
  if (searchCount === 0) {
    await prisma.savedSearchKeyword.createMany({
      data: defaultSearchKeywords.map((keyword) => ({ keyword }))
    });
  }
}

function matchRule(title: string, label: string, keywords: string[]) {
  const normalized = title.toLowerCase();
  return (
    normalized.includes(label.toLowerCase()) ||
    keywords.some((keyword) => keyword.trim() && normalized.includes(keyword.trim().toLowerCase()))
  );
}

export async function tagTitle(title: string) {
  await seedKeywordDefaults();
  const rules = await prisma.tagRule.findMany({ orderBy: [{ category: "asc" }, { label: "asc" }] });
  const companyTags: string[] = [];
  const topicTags: string[] = [];

  for (const rule of rules) {
    if (!matchRule(title, rule.label, parseKeywords(rule.keywords))) continue;
    if (rule.category === "COMPANY") companyTags.push(rule.label);
    if (rule.category === "TOPIC") topicTags.push(rule.label);
  }

  return { companyTags, topicTags };
}

export async function retagAllArticles() {
  await seedKeywordDefaults();
  const articles = await prisma.article.findMany({ where: { deleted: false }, select: { id: true, title: true } });

  for (const article of articles) {
    const tags = await tagTitle(article.title);
    await prisma.article.update({
      where: { id: article.id },
      data: {
        companyTags: JSON.stringify(tags.companyTags),
        topicTags: JSON.stringify(tags.topicTags)
      }
    });
  }

  return { updated: articles.length };
}
