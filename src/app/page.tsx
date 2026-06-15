"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Plus, Trash2 } from "lucide-react";
import { createProject } from "@/lib/api";
import { Badge, Button, Card } from "@/components/ui";

type UrlRow = { url: string; manual_text: string };

export default function HomePage() {
  const router = useRouter();
  const [topic, setTopic] = useState("");
  const [rows, setRows] = useState<UrlRow[]>([
    { url: "", manual_text: "" },
    { url: "", manual_text: "" },
    { url: "", manual_text: "" }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const validRows = rows.filter((row) => row.url.trim());

  async function submit() {
    setError("");
    if (topic.trim().length < 3) {
      setError("Enter a topic first.");
      return;
    }
    if (validRows.length < 3 || validRows.length > 10) {
      setError("Add 3 to 10 article URLs.");
      return;
    }
    setIsLoading(true);
    try {
      const project = await createProject({
        topic,
        articles: validRows.map((row) => ({
          url: row.url.trim(),
          manual_text: row.manual_text.trim() || undefined
        }))
      });
      router.push(`/project/${project.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
      setIsLoading(false);
    }
  }

  return (
    <main className="min-h-screen">
      <section className="mx-auto max-w-6xl px-5 py-12">
        <div className="mb-10 max-w-3xl">
          <Badge tone="blue">MVP demo</Badge>
          <h1 className="mt-5 text-5xl font-black tracking-tight md:text-6xl">BiasBuster</h1>
          <p className="mt-5 text-lg leading-8 text-slate-600">
            Compare how news outlets frame the same event. BiasBuster looks at tone, loaded language, claims, blame or credit, emphasized facts, possible context gaps, and headline framing.
          </p>
          <p className="mt-4 rounded-2xl bg-slate-100 p-4 text-sm leading-6 text-slate-700">
            BiasBuster analyzes framing patterns in the provided articles. It does not determine absolute truth or rate the moral value of any outlet.
          </p>
        </div>

        <Card>
          <label className="text-sm font-semibold text-slate-700">Project topic</label>
          <input
            className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-lg"
            placeholder="Canada housing affordability policy"
            value={topic}
            onChange={(event) => setTopic(event.target.value)}
          />

          <div className="mt-8 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">Article URLs</h2>
              <p className="text-sm text-muted">Add 3-10 links. Manual text is optional and useful when extraction fails.</p>
            </div>
            <Button
              className="bg-slate-100 text-slate-900 hover:bg-slate-200"
              disabled={rows.length >= 10}
              onClick={() => setRows([...rows, { url: "", manual_text: "" }])}
            >
              <Plus className="mr-2 inline h-4 w-4" />
              Add URL
            </Button>
          </div>

          <div className="mt-5 space-y-4">
            {rows.map((row, index) => (
              <div key={index} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex gap-3">
                  <input
                    className="flex-1 rounded-xl border border-slate-200 px-4 py-3"
                    placeholder={`Article URL ${index + 1}`}
                    value={row.url}
                    onChange={(event) => {
                      const copy = [...rows];
                      copy[index] = { ...row, url: event.target.value };
                      setRows(copy);
                    }}
                  />
                  <button
                    className="rounded-xl border border-slate-200 px-3 text-slate-500"
                    disabled={rows.length <= 3}
                    onClick={() => setRows(rows.filter((_, rowIndex) => rowIndex !== index))}
                    aria-label="Remove URL"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <textarea
                  className="mt-3 min-h-24 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                  placeholder="Optional manual article text fallback"
                  value={row.manual_text}
                  onChange={(event) => {
                    const copy = [...rows];
                    copy[index] = { ...row, manual_text: event.target.value };
                    setRows(copy);
                  }}
                />
              </div>
            ))}
          </div>

          {error && (
            <p className="mt-5 flex items-center gap-2 rounded-2xl bg-rose-50 p-4 text-sm text-rose-700">
              <AlertTriangle className="h-4 w-4" />
              {error}
            </p>
          )}

          <div className="mt-8 flex items-center gap-4">
            <Button disabled={isLoading} onClick={submit}>
              {isLoading ? "Extracting and analyzing..." : "Analyze Coverage"}
            </Button>
            <p className="text-sm text-muted">{validRows.length}/10 URLs ready</p>
          </div>
        </Card>
      </section>
    </main>
  );
}
