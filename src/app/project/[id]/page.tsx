import { initDb, fetchProject } from "@/lib/db";
import { compareProject } from "@/lib/llm";
import { saveComparison } from "@/lib/db";
import { ResultsDashboard } from "@/components/ResultsDashboard";
import type { ArticleAnalysis, Project } from "@/types/biasbuster";
import { notFound } from "next/navigation";

export default async function ProjectPage({ params }: { params: { id: string } }) {
  await initDb();
  let project = await fetchProject(params.id);
  if (!project) notFound();

  const comparison = (project.comparison ?? {}) as Record<string, unknown>;
  if (!comparison.executive_insight || !comparison.framing_comparison_table) {
    const articles = (project.articles as { analysis: ArticleAnalysis | null }[]);
    const validAnalyses = articles.map(a => a.analysis).filter(Boolean) as ArticleAnalysis[];
    if (validAnalyses.length) {
      const regenerated = await compareProject(project.topic as string, validAnalyses);
      await saveComparison(params.id, regenerated);
      project = await fetchProject(params.id);
    }
  }

  return <ResultsDashboard project={project as unknown as Project} />;
}
