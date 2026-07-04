import { NextResponse } from "next/server";
import { ensureDatabaseSchema } from "@/lib/dbInit";
import { retagAllArticles } from "@/lib/tags";

export const dynamic = "force-dynamic";

export async function POST() {
  await ensureDatabaseSchema();
  const result = await retagAllArticles();
  return NextResponse.json(result);
}
