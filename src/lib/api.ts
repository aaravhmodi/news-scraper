import type { Project } from "@/types/biasbuster";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8001";
const BROWSER_API_BASE = "/api/backend";

function apiBase() {
  return typeof window === "undefined" ? API_BASE : BROWSER_API_BASE;
}

export async function createProject(payload: {
  topic: string;
  articles: { url: string; manual_text?: string }[];
}): Promise<Project> {
  const response = await fetch(`${apiBase()}/projects`, {
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
  const response = await fetch(`${apiBase()}/projects/${id}`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Project not found");
  }
  return response.json();
}

export function exportUrl(id: string) {
  return `${apiBase()}/projects/${id}/export.md`;
}
