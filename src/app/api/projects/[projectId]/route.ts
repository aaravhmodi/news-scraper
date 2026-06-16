import { NextRequest, NextResponse } from "next/server";
import { initDb, fetchProject, saveComparison } from "@/lib/db";
import { compareProject } from "@/lib/llm";
import type { ArticleAnalysis } from "@/types/biasbuster";

export const maxDuration = 60;

export async function GET(_req: NextRequest, { params }: { params: { projectId: string } }) {
  try {
    await initDb();
    const project = await fetchProject(params.projectId);
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    // Regenerate comparison if missing
    const comparison = project.comparison ?? {};
    if (!comparison.executive_insight || !comparison.framing_comparison_table) {
      const validAnalyses = project.articles.map((a: { analysis: ArticleAnalysis | null }) => a.analysis).filter(Boolean) as ArticleAnalysis[];
      if (validAnalyses.length) {
        const regenerated = await compareProject(project.topic as string, validAnalyses);
        await saveComparison(params.projectId, regenerated);
        return NextResponse.json(await fetchProject(params.projectId));
      }
    }

    return NextResponse.json(project);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
