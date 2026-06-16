import { NextRequest, NextResponse } from "next/server";
import { initDb, insertProject, insertArticle, updateArticle, saveAnalysis, saveComparison, fetchProject } from "@/lib/db";
import { extractArticle } from "@/lib/extractor";
import { analyzeArticle, compareProject } from "@/lib/llm";
import type { ArticleAnalysis } from "@/types/biasbuster";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    await initDb();
    const body = await req.json();
    const { topic, articles } = body as { topic: string; articles: { url: string; manual_text?: string }[] };

    const projectId = await insertProject(topic);

    for (const input of articles) {
      const articleId = await insertArticle(projectId, input.url, input.manual_text);
      const extracted = await extractArticle(input.url, input.manual_text);
      await updateArticle(articleId, {
        headline: extracted.headline,
        source_name: extracted.source_name,
        author: extracted.author,
        published_at: extracted.published_at,
        raw_text: extracted.raw_text,
        extraction_status: extracted.extraction_status,
      });
      if (extracted.raw_text.length >= 100) {
        const analysis = await analyzeArticle(extracted.source_name, extracted.headline, extracted.raw_text);
        await saveAnalysis(articleId, analysis);
      }
    }

    const project = await fetchProject(projectId);
    if (!project) return NextResponse.json({ error: "Project not created" }, { status: 500 });

    const validAnalyses = project.articles.map((a: { analysis: ArticleAnalysis | null }) => a.analysis).filter(Boolean) as ArticleAnalysis[];
    if (validAnalyses.length) {
      const comparison = await compareProject(topic, validAnalyses);
      await saveComparison(projectId, comparison);
    }

    return NextResponse.json(await fetchProject(projectId));
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
