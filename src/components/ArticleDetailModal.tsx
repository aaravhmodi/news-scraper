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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <Card className="max-h-[88vh] w-full max-w-4xl overflow-y-auto">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <Badge>{article.source_name || "Unknown source"}</Badge>
            <h2 className="mt-3 text-2xl font-bold">{article.headline || "Untitled article"}</h2>
            <a className="mt-2 block break-all text-sm text-blue-700" href={article.url} target="_blank">
              {article.url}
            </a>
          </div>
          <Button className="bg-slate-200 text-slate-900 hover:bg-slate-300" onClick={onClose}>
            Close
          </Button>
        </div>

        {!analysis ? (
          <p className="text-sm text-muted">No analysis available. Extraction may have failed; paste manual text through the API or retry with another URL.</p>
        ) : (
          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <h3 className="font-semibold">Summary</h3>
              <p className="mt-2 text-sm leading-6 text-slate-700">{analysis.summary}</p>
            </div>
            <div>
              <h3 className="font-semibold">Tone and Frame</h3>
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge tone="blue">{analysis.tone.overall}</Badge>
                <Badge tone="amber">{analysis.frame_label}</Badge>
                <Badge>emotion {analysis.emotional_intensity.toFixed(2)}</Badge>
              </div>
            </div>
            <List title="Main Claims" items={analysis.main_claims} />
            <List title="Loaded Words" items={analysis.loaded_words.map((w) => `${w.word}: ${w.reason}`)} />
            <List title="Blame / Credit" items={analysis.blame_or_credit.map((b) => `${b.entity} ${b.role}: ${b.evidence}`)} />
            <List title="Possibly Omitted Context" items={analysis.possibly_omitted_context} />
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
      <ul className="mt-2 space-y-2 text-sm leading-6 text-slate-700">
        {items.length ? items.map((item) => <li key={item}>- {item}</li>) : <li className="text-muted">No items identified.</li>}
      </ul>
    </div>
  );
}
