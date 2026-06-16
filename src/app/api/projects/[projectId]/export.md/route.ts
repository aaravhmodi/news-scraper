import { NextRequest, NextResponse } from "next/server";
import { initDb, fetchProject } from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: { projectId: string } }) {
  await initDb();
  const project = await fetchProject(params.projectId);
  if (!project) return new NextResponse("Not found", { status: 404 });

  const comparison = (project.comparison ?? {}) as Record<string, unknown>;

  const bullet = (items: string[]) => items.length ? items.map(i => `- ${i}`).join("\n") : "- None identified.";
  const table = (headers: string[], rows: string[][]) => {
    if (!rows.length) return "No rows generated.";
    return [
      `| ${headers.join(" | ")} |`,
      `| ${headers.map(() => "---").join(" | ")} |`,
      ...rows.map(row => `| ${row.map(c => (c ?? "n/a").replace(/\|/g, "\\|").replace(/\n/g, " ")).join(" | ")} |`),
    ].join("\n");
  };

  const cmp = (k: string) => (comparison[k] as string) ?? "";
  const arr = <T>(k: string) => (comparison[k] as T[]) ?? [];

  const lines: string[] = [
    `# BiasBuster Report: ${project.topic}`, "",
    "## Disclaimer", "", "BiasBuster analyzes framing patterns in the provided articles. It does not determine absolute truth or rate the moral value of any outlet.", "",
    "## Executive Insight", "", cmp("executive_insight") || "No executive insight generated.", "",
    "## Neutral Summary", "", cmp("neutral_event_summary") || "No comparison generated yet.", "",
    "## Shared Facts", bullet(arr<string>("shared_facts")), "",
    "## Framing Comparison Table", "",
    table(
      ["Source","Main Frame","Core Claim","Responsible Actor","Implied Solution","Evidence Used","Confidence"],
      arr<Record<string,string>>("framing_comparison_table").map(r => [r.source,r.main_frame,r.core_claim,r.responsible_actor_or_cause,r.implied_solution,r.evidence_used,r.confidence])
    ), "",
    "## Final BiasBuster Insight", "", cmp("final_biasbuster_insight") || "No final insight generated.",
  ];

  return new NextResponse(lines.join("\n"), {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Content-Disposition": `attachment; filename="biasbuster-${params.projectId}.md"` },
  });
}
