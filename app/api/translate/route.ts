import { NextResponse } from "next/server";
import { ensureDatabaseSchema } from "@/lib/dbInit";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";

async function getKey(): Promise<string> {
  const setting = await prisma.appSetting.findUnique({ where: { key: "deepseekApiKey" } });
  return setting?.value || "";
}

async function translateText(text: string, key: string): Promise<string> {
  const response = await fetch(DEEPSEEK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: "你是一个专业翻译助手。将输入的英文标题翻译成简洁流畅的中文，只返回翻译结果，不要加任何解释。" },
        { role: "user", content: text }
      ],
      temperature: 0.3
    })
  });

  if (!response.ok) throw new Error(`DeepSeek API 错误: ${response.status}`);
  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || "";
}

export async function POST(request: Request) {
  try {
    await ensureDatabaseSchema();
    const apiKey = await getKey();
    if (!apiKey) {
      return NextResponse.json({ error: "请先在设置页面配置 DeepSeek API Key" }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const articleId = body.articleId as string | undefined;

    if (!articleId) {
      const articles = await prisma.article.findMany({
        where: { translatedTitle: "" },
        orderBy: { createdAt: "desc" }
      });

      let translated = 0;
      let failed = 0;

      for (const article of articles) {
        try {
          const translatedTitle = await translateText(article.title, apiKey);
          if (!translatedTitle) {
            failed += 1;
            continue;
          }

          await prisma.article.update({
            where: { id: article.id },
            data: { translatedTitle }
          });
          translated += 1;
        } catch {
          failed += 1;
        }
      }

      const remaining = await prisma.article.count({ where: { translatedTitle: "" } });
      return NextResponse.json({ translated, total: articles.length, failed, remaining });
    }

    const article = await prisma.article.findUnique({ where: { id: articleId } });
    if (!article) return NextResponse.json({ error: "文章不存在" }, { status: 404 });

    const translatedTitle = await translateText(article.title, apiKey);
    if (!translatedTitle) return NextResponse.json({ error: "翻译结果为空" }, { status: 502 });

    await prisma.article.update({
      where: { id: articleId },
      data: { translatedTitle }
    });

    return NextResponse.json({ translatedTitle });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
