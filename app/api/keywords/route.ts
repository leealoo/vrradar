import { NextResponse } from "next/server";
import { ensureDatabaseSchema } from "@/lib/dbInit";
import { prisma } from "@/lib/prisma";
import { parseKeywords, seedKeywordDefaults } from "@/lib/tags";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await ensureDatabaseSchema();
    await seedKeywordDefaults();
    const [tagRules, savedSearchKeywords] = await Promise.all([
      prisma.tagRule.findMany({ orderBy: [{ category: "asc" }, { label: "asc" }] }),
      prisma.savedSearchKeyword.findMany({ orderBy: { keyword: "asc" } })
    ]);

    return NextResponse.json({
      tagRules: tagRules.map((rule) => ({
        ...rule,
        keywords: parseKeywords(rule.keywords)
      })),
      savedSearchKeywords
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
