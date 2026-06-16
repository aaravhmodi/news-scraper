"use client";

import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { exportUrl } from "@/lib/api";
import type { Article, Project } from "@/types/biasbuster";
import { ArticleDetailModal } from "./ArticleDetailModal";
import { Badge, Card } from "./ui";

export function ResultsDashboard({ project }: { project: Project }) {
  const [selected, setSelected] = useState<Article | null>(null);
  const analyzed = project.articles.filter((article) => article.analysis);
  const comparison = project.comparison;
  const framingRows = comparison?.framing_comparison_table || [];
  const headlineRows = comparison?.headline_framing_analysis || [];
  const loadedLanguage = comparison?.loaded_language || [];
  const sourceAnalyses = comparison?.source_by_source_analysis || [];
  const emphasisRows = comparison?.emphasis_underemphasis || [];
  const diagnosis = comparison?.cross_source_diagnosis;
  const points = useMemo(
    () =>
      analyzed.map((article) => ({
        id: article.id,
        source: article.source_name,
        headline: article.headline,
        support: article.analysis?.tone.score ?? 0,
        emotion: article.analysis?.emotional_intensity ?? 0,
        spin: article.analysis?.spin_direction ?? "neutral",
        article
      })),
    [analyzed]
  );

  // Bias type stacked bar — count detections per type per source
  const BIAS_TYPES = ["coverage bias", "gatekeeping bias", "statement bias", "spin bias", "ideology bias"] as const;
  const BIAS_COLORS: Record<string, string> = {
    "coverage bias": "oklch(0.55 0.15 250)",
    "gatekeeping bias": "oklch(0.55 0.15 30)",
    "statement bias": "oklch(0.55 0.15 140)",
    "spin bias": "oklch(0.55 0.15 320)",
    "ideology bias": "oklch(0.55 0.15 60)",
  };
  const biasChartData = useMemo(() =>
    analyzed.map((a) => {
      const counts: Record<string, number> = Object.fromEntries(BIAS_TYPES.map(t => [t, 0]));
      (a.analysis?.detected_biases ?? []).forEach(b => { counts[b.bias_type] = (counts[b.bias_type] ?? 0) + 1; });
      return { source: a.source_name, ...counts };
    }),
    [analyzed]
  );

  // NRC emotion radar — one axis per emotion, one series per source
  const EMOTION_KEYS = ["anger", "fear", "trust", "disgust", "anticipation", "joy", "sadness", "surprise"];
  const SOURCE_COLORS = ["oklch(0.43 0.085 205)", "oklch(0.57 0.11 78)", "oklch(0.55 0.15 30)", "oklch(0.55 0.15 140)", "oklch(0.55 0.15 320)"];
  const emotionRadarData = useMemo(() =>
    EMOTION_KEYS.map(emotion => {
      const row: Record<string, string | number> = { emotion };
      analyzed.forEach(a => {
        row[a.source_name] = (a.analysis?.emotion_scores?.[emotion] ?? 0) * 1000;
      });
      return row;
    }),
    [analyzed]
  );

  // Horizontal tone comparison bar
  const toneData = useMemo(() =>
    analyzed.map(a => ({
      source: a.source_name,
      tone: a.analysis?.tone.score ?? 0,
      spin: a.analysis?.spin_direction ?? "neutral",
    })),
    [analyzed]
  );

  const spinColor = (spin: string) =>
    spin === "positive" ? "oklch(0.55 0.15 140)" :
    spin === "negative" ? "oklch(0.55 0.15 30)" :
    spin === "mixed" ? "oklch(0.55 0.15 60)" : "oklch(0.5 0 0)";

  return (
    <main className="min-h-screen px-4 py-6 md:px-6 md:py-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col justify-between gap-4 border-b border-line pb-6 md:flex-row md:items-end">
          <div>
            <Badge tone="blue">Coverage analysis</Badge>
            <h1 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">{project.topic}</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">
              Interpretive framing analysis from the supplied articles. Treat possible omissions as prompts for review, not proven failures.
            </p>
          </div>
          <a
            className="inline-flex items-center justify-center rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-ink focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-paper"
            href={exportUrl(project.id)}
          >
            <Download className="mr-2 h-4 w-4" />
            Export Markdown
          </a>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="border-accent/25 bg-accentSoft/60 lg:col-span-3">
            <h2 className="text-lg font-semibold">Executive Insight</h2>
            <p className="mt-3 max-w-5xl text-base leading-7 text-ink">
              {comparison?.executive_insight || "No executive insight was generated yet. At least two articles need extracted text and analysis."}
            </p>
          </Card>
          <Card className="lg:col-span-2">
            <h2 className="text-lg font-semibold">Neutral Summary</h2>
            <p className="mt-3 leading-7 text-ink">
              {comparison?.neutral_event_summary || "No comparison was generated yet. At least one article needs extracted text and analysis."}
            </p>
          </Card>
          <Card>
            <h2 className="text-lg font-semibold">Pipeline Status</h2>
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

        <Card className="mt-5">
          <h2 className="text-lg font-semibold">Framing Comparison Table</h2>
          <p className="mt-1 text-sm text-muted">The core difference is usually diagnostic: each source points the reader toward a different cause, actor, and policy path.</p>
          <div className="mt-4 overflow-x-auto rounded-lg border border-line">
            <table className="w-full min-w-[1120px] text-left text-sm">
              <thead className="bg-paper text-muted">
                <tr>
                  <th className="px-3 py-3">Source</th>
                  <th className="px-3 py-3">Main Frame</th>
                  <th className="px-3 py-3">Core Claim</th>
                  <th className="px-3 py-3">Responsible Actor / Cause</th>
                  <th className="px-3 py-3">Implied Solution</th>
                  <th className="px-3 py-3">Evidence Used</th>
                  <th className="px-3 py-3">Confidence</th>
                </tr>
              </thead>
              <tbody>
                {framingRows.length ? framingRows.map((row) => (
                  <tr key={`${row.source}-${row.main_frame}`} className="border-t border-line align-top">
                    <td className="max-w-40 px-3 py-4 font-semibold">{row.source}</td>
                    <td className="max-w-44 px-3 py-4">{row.main_frame}</td>
                    <td className="max-w-xs px-3 py-4 leading-6">{row.core_claim}</td>
                    <td className="max-w-xs px-3 py-4 leading-6">{row.responsible_actor_or_cause}</td>
                    <td className="max-w-xs px-3 py-4 leading-6">{row.implied_solution}</td>
                    <td className="max-w-xs px-3 py-4 leading-6">{row.evidence_used}</td>
                    <td className="px-3 py-4"><ConfidenceBadge value={row.confidence} /></td>
                  </tr>
                )) : (
                  <tr><td className="py-4 text-muted" colSpan={7}>No framing table generated.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <ComparisonList title="Shared Facts" items={comparison?.shared_facts || []} />
          <Card>
            <h2 className="text-lg font-semibold">Cross-Source Diagnosis</h2>
            {diagnosis ? (
              <dl className="mt-4 space-y-3 text-sm leading-6 text-ink">
                <DiagnosisItem label="Issue" value={diagnosis.issue_exists} />
                <DiagnosisItem label="Cause" value={diagnosis.cause} />
                <DiagnosisItem label="Responsibility" value={diagnosis.responsible_actors} />
                <DiagnosisItem label="Solutions" value={diagnosis.implied_solutions} />
                <DiagnosisItem label="Evidence" value={diagnosis.evidence_used} />
              </dl>
            ) : (
              <p className="mt-4 text-sm text-muted">No diagnosis generated.</p>
            )}
          </Card>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <Card>
            <h2 className="text-lg font-semibold">Headline Framing Analysis</h2>
            <div className="mt-4 space-y-4">
              {headlineRows.length ? headlineRows.map((row) => (
                <div key={`${row.source}-${row.headline}`} className="border-t border-line pt-4 first:border-t-0 first:pt-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge>{row.source}</Badge>
                    <ConfidenceBadge value={row.confidence} />
                  </div>
                  <p className="mt-2 text-sm font-semibold text-ink">{row.headline}</p>
                  <p className="mt-2 text-sm leading-6 text-ink">{row.effect}</p>
                  <p className="mt-2 text-xs font-semibold text-muted">Focus: {row.reader_focus}</p>
                  {Array.isArray(row.key_framing_words) && row.key_framing_words.length > 0 && <p className="mt-2 text-sm text-muted">Key wording: {row.key_framing_words.join(", ")}</p>}
                </div>
              )) : <p className="text-sm text-muted">No headline analysis generated.</p>}
            </div>
          </Card>

          <Card>
            <h2 className="text-lg font-semibold">Loaded Language and Word Choice</h2>
            <div className="mt-4 overflow-x-auto rounded-lg border border-line">
              <table className="w-full min-w-[620px] text-left text-sm">
                <thead className="bg-paper text-muted">
                  <tr>
                    <th className="px-3 py-3">Phrase</th>
                    <th className="px-3 py-3">Source</th>
                    <th className="px-3 py-3">Framing Effect</th>
                    <th className="px-3 py-3">Confidence</th>
                  </tr>
                </thead>
                <tbody>
                  {loadedLanguage.length ? loadedLanguage.map((item) => (
                    <tr key={`${item.source}-${item.phrase}`} className="border-t border-line align-top">
                      <td className="px-3 py-4 font-semibold">{item.phrase}</td>
                      <td className="px-3 py-4">{item.source}</td>
                      <td className="px-3 py-4 leading-6">{item.framing_effect}</td>
                      <td className="px-3 py-4"><ConfidenceBadge value={item.confidence} /></td>
                    </tr>
                  )) : (
                    <tr><td className="py-4 text-muted" colSpan={4}>No loaded language identified.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <SourceAnalysisList rows={sourceAnalyses} />
          <EmphasisList rows={emphasisRows} />
        </div>

        {/* Charts row 1 */}
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <Card>
            <h2 className="text-lg font-semibold">Framing Map</h2>
            <p className="mt-1 text-sm text-muted">
              Tone score (x) vs emotional intensity (y). Color = spin direction. Click a point to inspect.
              <span className="ml-3 text-xs">[Entman 1993 · Levin et al. 1998]</span>
            </p>
            <div className="mt-4 h-80">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 20, right: 30, bottom: 20, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" dataKey="support" domain={[-1, 1]} name="Tone score"
                    label={{ value: "← Critical · Supportive →", position: "insideBottom", offset: -8, fontSize: 11 }} />
                  <YAxis type="number" dataKey="emotion" domain={[0, 1]} name="Emotional intensity"
                    label={{ value: "Emotional intensity", angle: -90, position: "insideLeft", fontSize: 11 }} />
                  <ReferenceLine x={0} stroke="#999" strokeDasharray="4 4" label={{ value: "neutral", position: "top", fontSize: 10 }} />
                  <Tooltip cursor={{ strokeDasharray: "3 3" }} content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const p = payload[0].payload;
                    return (
                      <div className="max-w-xs rounded-lg border border-line bg-white p-3 text-sm shadow-soft">
                        <b>{p.source}</b>
                        <div className="mt-1 text-muted">{p.headline}</div>
                        <div className="mt-1">Tone: {p.support.toFixed(2)} · Emotion: {p.emotion.toFixed(2)}</div>
                        <div className="mt-0.5 text-xs capitalize">Spin: {p.spin}</div>
                      </div>
                    );
                  }} />
                  {(["positive", "negative", "neutral", "mixed"] as const).map(spin => {
                    const group = points.filter(p => p.spin === spin);
                    if (!group.length) return null;
                    return (
                      <Scatter key={spin} name={spin} data={group}
                        fill={spinColor(spin)} onClick={(p) => setSelected(p.article)}>
                        <LabelList dataKey="source" position="top" style={{ fontSize: 10, fill: "#555" }} />
                      </Scatter>
                    );
                  })}
                  <Legend formatter={(v) => <span className="text-xs capitalize">{v} spin</span>} />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card>
            <h2 className="text-lg font-semibold">Tone Comparison</h2>
            <p className="mt-1 text-sm text-muted">
              Tone score per source (−1 = fully critical, +1 = fully supportive). Color = spin direction.
              <span className="ml-3 text-xs">[Levin et al. 1998 · Valence Framing]</span>
            </p>
            <div className="mt-4 h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={toneData} layout="vertical" margin={{ left: 10, right: 30, top: 10, bottom: 10 }}>
                  <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                  <XAxis type="number" domain={[-1, 1]}
                    label={{ value: "← Critical · Supportive →", position: "insideBottom", offset: -2, fontSize: 11 }} />
                  <YAxis type="category" dataKey="source" tick={{ fontSize: 11 }} width={90} />
                  <ReferenceLine x={0} stroke="#999" strokeDasharray="4 4" />
                  <Tooltip formatter={(v: number) => v.toFixed(2)} />
                  <Bar dataKey="tone" radius={[0, 6, 6, 0]}>
                    {toneData.map((entry, i) => (
                      <Cell key={i} fill={spinColor(entry.spin)} />
                    ))}
                    <LabelList dataKey="tone" position="right" formatter={(v: number) => v.toFixed(2)} style={{ fontSize: 11 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        {/* Charts row 2 */}
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <Card>
            <h2 className="text-lg font-semibold">Bias Type Profile</h2>
            <p className="mt-1 text-sm text-muted">
              Number of detected bias instances per type per source.
              <span className="ml-3 text-xs">[Rodrigo-Ginés et al. 2024]</span>
            </p>
            <div className="mt-4 h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={biasChartData} margin={{ top: 10, right: 20, bottom: 20, left: 0 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="source" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} label={{ value: "Detections", angle: -90, position: "insideLeft", fontSize: 11 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {BIAS_TYPES.map(type => (
                    <Bar key={type} dataKey={type} stackId="a" fill={BIAS_COLORS[type]} radius={type === "ideology bias" ? [4, 4, 0, 0] : undefined} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card>
            <h2 className="text-lg font-semibold">Emotion Profile</h2>
            <p className="mt-1 text-sm text-muted">
              NRC Emotion Lexicon frequency scores per source. Higher = more words in that emotion category.
              <span className="ml-3 text-xs">[Mohammad & Turney 2013]</span>
            </p>
            <div className="mt-4 h-80">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={emotionRadarData} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="emotion" tick={{ fontSize: 11 }} />
                  <PolarRadiusAxis tick={{ fontSize: 9 }} />
                  {analyzed.map((a, i) => (
                    <Radar key={a.id} name={a.source_name} dataKey={a.source_name}
                      stroke={SOURCE_COLORS[i % SOURCE_COLORS.length]}
                      fill={SOURCE_COLORS[i % SOURCE_COLORS.length]} fillOpacity={0.18} />
                  ))}
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => (v / 1000).toFixed(4)} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        <Card className="mt-5">
          <h2 className="text-lg font-semibold">Final BiasBuster Insight</h2>
          <p className="mt-3 max-w-5xl leading-7 text-ink">
            {comparison?.final_biasbuster_insight || "No final insight generated."}
          </p>
        </Card>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {project.articles.map((article) => (
            <Card key={article.id} className="cursor-pointer transition hover:-translate-y-0.5" onClick={() => setSelected(article)}>
              <div className="flex items-center justify-between gap-3">
                <Badge>{article.source_name || "Unknown source"}</Badge>
                <Badge tone={article.extraction_status === "failed" ? "red" : "green"}>{article.extraction_status}</Badge>
              </div>
              <h3 className="mt-4 line-clamp-3 text-base font-semibold leading-6">{article.headline || "Untitled article"}</h3>
              <p className="mt-3 line-clamp-4 text-sm leading-6 text-muted">{article.analysis?.summary || "No analysis available."}</p>
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
      <h2 className="text-lg font-semibold">{title}</h2>
      <ul className="mt-4 space-y-3 text-sm leading-6 text-ink">
        {items.length ? items.map((item) => <li key={item}>- {item}</li>) : <li className="text-muted">None identified.</li>}
      </ul>
    </Card>
  );
}

function ConfidenceBadge({ value }: { value: "high" | "medium" | "low" }) {
  const tone = value === "high" ? "green" : value === "medium" ? "amber" : "slate";
  return <Badge tone={tone}>{value}</Badge>;
}

function DiagnosisItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-semibold text-ink">{label}</dt>
      <dd>{value || "No comparison generated."}</dd>
    </div>
  );
}

function SourceAnalysisList({ rows }: { rows: NonNullable<Project["comparison"]>["source_by_source_analysis"] }) {
  return (
    <Card>
      <h2 className="text-lg font-semibold">Source-by-Source Analysis</h2>
      <div className="mt-4 space-y-5">
        {rows?.length ? rows.map((row) => (
          <div key={row.source} className="border-t border-line pt-4 first:border-t-0 first:pt-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge>{row.source}</Badge>
              <Badge tone="blue">{row.main_frame}</Badge>
              <ConfidenceBadge value={row.confidence} />
            </div>
            <p className="mt-3 text-sm leading-6 text-ink">{row.central_claim}</p>
            <p className="mt-2 text-sm text-muted"><b className="text-ink">Implied solution:</b> {row.implied_solution}</p>
            <MiniList label="Evidence" items={row.supporting_evidence} />
            <MiniList label="Blame / credit" items={row.blamed_or_credited} />
            <MiniList label="Notable wording" items={row.notable_wording} />
          </div>
        )) : <p className="text-sm text-muted">No source-by-source analysis generated.</p>}
      </div>
    </Card>
  );
}

function EmphasisList({ rows }: { rows: NonNullable<Project["comparison"]>["emphasis_underemphasis"] }) {
  return (
    <Card>
      <h2 className="text-lg font-semibold">Emphasis vs Underemphasis</h2>
      <div className="mt-4 space-y-5">
        {rows?.length ? rows.map((row) => (
          <div key={row.source} className="border-t border-line pt-4 first:border-t-0 first:pt-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge>{row.source}</Badge>
              <ConfidenceBadge value={row.confidence} />
            </div>
            <MiniList label="Emphasizes" items={row.emphasizes} />
            <MiniList label="May underemphasize" items={row.may_underemphasize} />
          </div>
        )) : <p className="text-sm text-muted">No emphasis analysis generated.</p>}
      </div>
    </Card>
  );
}

function MiniList({ label, items }: { label: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div className="mt-3">
      <p className="text-sm font-semibold text-ink">{label}</p>
      <ul className="mt-1 space-y-1 text-sm leading-6 text-ink">
        {items.map((item) => <li key={item}>- {item}</li>)}
      </ul>
    </div>
  );
}
