import { NextRequest, NextResponse } from "next/server";
import { initDb, updateArticle, saveAnalysis } from "@/lib/db";
import { analyzeArticle } from "@/lib/llm";

export const maxDuration = 60;

export async function POST(req: NextRequest, { params }: { params: { articleId: string } }) {
  try {
    await initDb();
    const body = await req.json();
    const { headline, source_name, raw_text } = body as { headline?: string; source_name?: string; raw_text: string };

    await updateArticle(params.articleId, {
      headline: headline ?? "Manual article text",
      source_name: source_name ?? "Manual source",
      raw_text,
      extraction_status: "manual",
    });

    const analysis = await analyzeArticle(source_name ?? "Manual source", headline ?? "Manual article text", raw_text);
    await saveAnalysis(params.articleId, analysis);

    return NextResponse.json({ status: "saved" });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
