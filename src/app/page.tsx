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
      <section className="mx-auto max-w-6xl px-5 py-8 md:py-10">
        <div className="mb-6 flex flex-col justify-between gap-4 border-b border-line pb-6 md:flex-row md:items-end">
          <div className="max-w-3xl">
            <Badge tone="blue">Comparative framing analysis</Badge>
            <h1 className="mt-4 text-4xl font-bold tracking-tight md:text-5xl">BiasBuster</h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-muted">
              Build a structured brief from 3-10 articles: shared facts, competing diagnoses, headline framing, loaded language, and cautious underemphasis notes.
            </p>
          </div>
          <p className="max-w-sm text-sm leading-6 text-muted">
            BiasBuster analyzes framing patterns. It does not determine absolute truth or rate the moral value of any outlet.
          </p>
        </div>

        <Card className="p-0">
          <div className="border-b border-line p-5">
            <h2 className="text-lg font-semibold">New analysis brief</h2>
            <p className="mt-1 text-sm leading-6 text-muted">Use URLs where possible. Add manual text when extraction is blocked or incomplete.</p>
          </div>
          <div className="p-5">
          <label className="text-sm font-semibold text-ink">Project topic</label>
          <input
            className="mt-2 w-full rounded-lg border border-line bg-white px-3 py-2.5 text-base text-ink transition placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-accent/20"
            placeholder="Canada housing affordability policy"
            value={topic}
            onChange={(event) => setTopic(event.target.value)}
          />

          <div className="mt-8 flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold">Article URLs</h3>
              <p className="text-sm text-muted">Add 3-10 links. Manual text is optional and useful when extraction fails.</p>
            </div>
            <Button
              className="border border-line bg-white text-ink hover:bg-paper"
              disabled={rows.length >= 10}
              onClick={() => setRows([...rows, { url: "", manual_text: "" }])}
            >
              <Plus className="mr-2 inline h-4 w-4" />
              Add URL
            </Button>
          </div>

          <div className="mt-5 space-y-4">
            {rows.map((row, index) => (
              <div key={index} className="rounded-xl border border-line bg-white p-4">
                <div className="flex gap-3">
                  <input
                    className="flex-1 rounded-lg border border-line px-3 py-2.5 text-sm transition placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-accent/20"
                    placeholder={`Article URL ${index + 1}`}
                    value={row.url}
                    onChange={(event) => {
                      const copy = [...rows];
                      copy[index] = { ...row, url: event.target.value };
                      setRows(copy);
                    }}
                  />
                  <button
                    className="rounded-lg border border-line px-3 text-muted transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-800 focus:outline-none focus:ring-2 focus:ring-accent/20"
                    disabled={rows.length <= 3}
                    onClick={() => setRows(rows.filter((_, rowIndex) => rowIndex !== index))}
                    aria-label="Remove URL"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <textarea
                  className="mt-3 min-h-24 w-full rounded-lg border border-line px-3 py-2.5 text-sm leading-6 transition placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-accent/20"
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
            <p className="mt-5 flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
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
          </div>
        </Card>
      </section>
    </main>
  );
}
