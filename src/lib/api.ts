import type { Project } from "@/types/biasbuster";

export async function createProject(payload: {
  topic: string;
  articles: { url: string; manual_text?: string }[];
}): Promise<Project> {
  const response = await fetch("/api/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Failed to create project");
  }
  return response.json();
}

export async function getProject(id: string): Promise<Project> {
  const response = await fetch(`/api/projects/${id}`, { cache: "no-store" });
  if (!response.ok) throw new Error("Project not found");
  return response.json();
}

export function exportUrl(id: string) {
  return `/api/projects/${id}/export.md`;
}
