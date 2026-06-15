import type { Project } from "@/types/biasbuster";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

export async function createProject(payload: {
  topic: string;
  articles: { url: string; manual_text?: string }[];
}): Promise<Project> {
  const response = await fetch(`${API_BASE}/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Failed to create project");
  }
  return response.json();
}

export async function getProject(id: string): Promise<Project> {
  const response = await fetch(`${API_BASE}/projects/${id}`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Project not found");
  }
  return response.json();
}

export function exportUrl(id: string) {
  return `${API_BASE}/projects/${id}/export.md`;
}
