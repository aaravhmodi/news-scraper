"use client";

import type { Article } from "@/types/biasbuster";
import { Badge, Button, Card } from "./ui";

export function ArticleDetailModal({
  article,
  onClose
}: {
  article: Article | null;
  onClose: () => void;
}) {
  if (!article) return null;
  const analysis = article.analysis;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/55 p-4">
      <Card className="max-h-[88vh] w-full max-w-4xl overflow-y-auto">
        <div className="mb-6 flex items-start justify-between gap-4 border-b border-line pb-5">
          <div>
            <Badge>{article.source_name || "Unknown source"}</Badge>
            <h2 className="mt-3 text-2xl font-semibold leading-8">{article.headline || "Untitled article"}</h2>
            <a className="mt-2 block break-all text-sm text-blue-700" href={article.url} target="_blank">
              {article.url}
            </a>
          </div>
          <Button className="border border-line bg-white text-ink hover:bg-paper" onClick={onClose}>
            Close
          </Button>
        </div>

        {!analysis ? (
          <p className="text-sm text-muted">No analysis available. Extraction may have failed; paste manual text through the API or retry with another URL.</p>
        ) : (
          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <h3 className="font-semibold">Summary</h3>
              <p className="mt-2 text-sm leading-6 text-ink">{analysis.summary}</p>
            </div>
            <div>
              <h3 className="font-semibold">Tone and Frame</h3>
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge tone="blue">{analysis.tone.overall}</Badge>
                <Badge tone="amber">{analysis.frame_label}</Badge>
                <Badge>emotion {analysis.emotional_intensity.toFixed(2)}</Badge>
                {analysis.spin_direction && analysis.spin_direction !== "neutral" && (
                  <Badge tone={analysis.spin_direction === "positive" ? "blue" : "red"}>
                    {analysis.spin_direction} spin
                  </Badge>
                )}
              </div>
            </div>
            <List title="Main Claims" items={analysis.main_claims} />
            <List title="Loaded Words" items={analysis.loaded_words.map((w) => `${w.word}: ${w.reason}`)} />
            <List title="Blame / Credit" items={analysis.blame_or_credit.map((b) => `${b.entity} ${b.role}: ${b.evidence}`)} />
            <List title="Possibly Omitted Context" items={analysis.possibly_omitted_context} />

            {analysis.detected_biases?.length > 0 && (
              <div className="md:col-span-2">
                <h3 className="font-semibold">Detected Bias Types</h3>
                <div className="mt-2 space-y-2">
                  {analysis.detected_biases.map((b, i) => (
                    <div key={i} className="rounded-lg border border-line bg-paper p-3 text-sm">
                      <div className="flex items-center gap-2">
                        <Badge tone="red">{b.bias_type}</Badge>
                        <Badge>{b.confidence} confidence</Badge>
                      </div>
                      <p className="mt-1 text-ink">{b.evidence}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {analysis.quoted_sources?.length > 0 && (
              <div className="md:col-span-2">
                <h3 className="font-semibold">Quoted Sources</h3>
                <div className="mt-2 flex flex-wrap gap-2">
                  {analysis.quoted_sources.map((qs, i) => (
                    <div key={i} className="rounded border border-line bg-paper px-3 py-1.5 text-sm">
                      <span className="font-medium">{qs.name}</span>
                      {qs.affiliation && <span className="text-muted"> · {qs.affiliation}</span>}
                      <span className="ml-2 text-muted">({qs.stance})</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}

function List({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h3 className="font-semibold">{title}</h3>
      <ul className="mt-2 space-y-2 text-sm leading-6 text-ink">
        {items.length ? items.map((item) => <li key={item}>- {item}</li>) : <li className="text-muted">No items identified.</li>}
      </ul>
    </div>
  );
}
