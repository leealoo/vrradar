import { prisma } from "./prisma";

const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";

async function getKey(): Promise<string> {
  const setting = await prisma.appSetting.findUnique({ where: { key: "deepseekApiKey" } });
  return setting?.value || "";
}

export async function translateTitle(text: string): Promise<string> {
  const key = await getKey();
  if (!key) return "";

  try {
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

    if (!response.ok) return "";
    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() || "";
  } catch {
    return "";
  }
}
