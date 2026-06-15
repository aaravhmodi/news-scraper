"use client";

import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { asText } from "@/lib/utils";
import { exportUrl } from "@/lib/api";
import type { Article, Project } from "@/types/biasbuster";
import { ArticleDetailModal } from "./ArticleDetailModal";
import { Badge, Card } from "./ui";

export function ResultsDashboard({ project }: { project: Project }) {
  const [selected, setSelected] = useState<Article | null>(null);
  const analyzed = project.articles.filter((article) => article.analysis);
  const comparison = project.comparison;
  const points = useMemo(
    () =>
      analyzed.map((article) => ({
        id: article.id,
        source: article.source_name,
        headline: article.headline,
        support: article.analysis?.tone.score ?? 0,
        emotion: article.analysis?.emotional_intensity ?? 0,
        article
      })),
    [analyzed]
  );

  return (
    <main className="min-h-screen px-5 py-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <Badge tone="blue">Coverage analysis</Badge>
            <h1 className="mt-4 text-4xl font-black tracking-tight">{project.topic}</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
              Interpretive framing analysis from the supplied articles. Treat possible omissions as prompts for review, not proven failures.
            </p>
          </div>
          <a
            className="inline-flex items-center justify-center rounded-2xl bg-ink px-5 py-3 text-sm font-semibold text-white"
            href={exportUrl(project.id)}
          >
            <Download className="mr-2 h-4 w-4" />
            Export Markdown
          </a>
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <h2 className="text-xl font-bold">Neutral Summary</h2>
            <p className="mt-3 leading-7 text-slate-700">
              {comparison?.neutral_event_summary || "No comparison was generated yet. At least one article needs extracted text and analysis."}
            </p>
          </Card>
          <Card>
            <h2 className="text-xl font-bold">Pipeline Status</h2>
            <div className="mt-4 space-y-3 text-sm">
              {project.articles.map((article) => (
                <div key={article.id} className="flex items-center justify-between gap-3">
                  <span className="truncate">{article.source_name || article.url}</span>
                  <Badge tone={article.extraction_status === "failed" ? "red" : article.analysis ? "green" : "amber"}>
                    {article.extraction_status}
                  </Badge>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <Card>
            <h2 className="text-xl font-bold">Framing Map</h2>
            <p className="mt-1 text-sm text-muted">X-axis: critical to supportive. Y-axis: emotional intensity.</p>
            <div className="mt-4 h-80">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 10 }}>
                  <CartesianGrid />
                  <XAxis type="number" dataKey="support" domain={[-1, 1]} name="tone" />
                  <YAxis type="number" dataKey="emotion" domain={[0, 1]} name="emotion" />
                  <Tooltip cursor={{ strokeDasharray: "3 3" }} content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const point = payload[0].payload;
                    return <div className="max-w-xs rounded-xl bg-white p-3 text-sm shadow-soft"><b>{point.source}</b><br />{point.headline}</div>;
                  }} />
                  <Scatter data={points} fill="#2563eb" onClick={(point) => setSelected(point.article)} />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card>
            <h2 className="text-xl font-bold">Emotional Intensity</h2>
            <div className="mt-4 h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={points}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="source" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 1]} />
                  <Tooltip />
                  <Bar dataKey="emotion" fill="#f59e0b" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <ComparisonList title="Shared Facts" items={comparison?.shared_facts || []} />
          <ComparisonList title="Coverage Gaps" items={comparison?.coverage_gaps || []} />
          <ObjectList title="Headline Comparison" items={comparison?.headline_comparison || []} />
          <ObjectList title="Blame / Credit Map" items={comparison?.blame_credit_map || []} />
        </div>

        <Card className="mt-5">
          <h2 className="text-xl font-bold">Article Comparison Table</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="text-slate-500">
                <tr>
                  <th className="py-3">Source</th>
                  <th>Headline</th>
                  <th>Tone</th>
                  <th>Frame</th>
                  <th>Claims</th>
                </tr>
              </thead>
              <tbody>
                {project.articles.map((article) => (
                  <tr key={article.id} className="border-t border-slate-100 align-top">
                    <td className="py-4 font-semibold">{article.source_name || "Unknown"}</td>
                    <td className="max-w-xs py-4">
                      <button className="text-left text-blue-700 hover:underline" onClick={() => setSelected(article)}>
                        {article.headline || article.url}
                      </button>
                    </td>
                    <td>{article.analysis?.tone.overall || "n/a"}</td>
                    <td>{article.analysis?.frame_label || "n/a"}</td>
                    <td className="max-w-md">{article.analysis?.main_claims?.slice(0, 2).join(" | ") || "No analysis"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {project.articles.map((article) => (
            <Card key={article.id} className="cursor-pointer transition hover:-translate-y-0.5" onClick={() => setSelected(article)}>
              <div className="flex items-center justify-between gap-3">
                <Badge>{article.source_name || "Unknown source"}</Badge>
                <Badge tone={article.extraction_status === "failed" ? "red" : "green"}>{article.extraction_status}</Badge>
              </div>
              <h3 className="mt-4 line-clamp-3 text-lg font-bold">{article.headline || "Untitled article"}</h3>
              <p className="mt-3 line-clamp-4 text-sm leading-6 text-slate-600">{article.analysis?.summary || "No analysis available."}</p>
            </Card>
          ))}
        </div>
      </div>
      <ArticleDetailModal article={selected} onClose={() => setSelected(null)} />
    </main>
  );
}

function ComparisonList({ title, items }: { title: string; items: string[] }) {
  return (
    <Card>
      <h2 className="text-xl font-bold">{title}</h2>
      <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-700">
        {items.length ? items.map((item) => <li key={item}>- {item}</li>) : <li className="text-muted">None identified.</li>}
      </ul>
    </Card>
  );
}

function ObjectList({ title, items }: { title: string; items: Record<string, unknown>[] }) {
  return (
    <Card>
      <h2 className="text-xl font-bold">{title}</h2>
      <div className="mt-4 space-y-3 text-sm leading-6 text-slate-700">
        {items.length ? items.map((item, index) => <p key={index} className="rounded-2xl bg-slate-50 p-3">{asText(item)}</p>) : <p className="text-muted">None identified.</p>}
      </div>
    </Card>
  );
}
