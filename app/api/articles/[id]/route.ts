import { NextResponse } from "next/server";
import { ensureDatabaseSchema } from "@/lib/dbInit";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  await ensureDatabaseSchema();
  const body = await request.json();
  const data: { favorite?: boolean; favoritedAt?: Date | null; note?: string } = {};

  if (typeof body.favorite === "boolean") {
    data.favorite = body.favorite;
    data.favoritedAt = body.favorite ? new Date() : null;
  }
  if (typeof body.note === "string") data.note = body.note;

  const article = await prisma.article.update({
    where: { id: params.id },
    data
  });

  return NextResponse.json(article);
}
