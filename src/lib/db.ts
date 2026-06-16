import { neon } from "@neondatabase/serverless";
import { randomBytes } from "crypto";

function sql() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return neon(url);
}

function newId() {
  return randomBytes(16).toString("hex");
}

function nowIso() {
  return new Date().toISOString();
}

export async function initDb() {
  const db = sql();
  await db`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      topic TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `;
  await db`
    CREATE TABLE IF NOT EXISTS articles (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      url TEXT NOT NULL,
      source_name TEXT NOT NULL DEFAULT '',
      headline TEXT NOT NULL DEFAULT '',
      author TEXT,
      published_at TEXT,
      raw_text TEXT NOT NULL DEFAULT '',
      extraction_status TEXT NOT NULL DEFAULT 'failed',
      created_at TEXT NOT NULL
    )
  `;
  await db`
    CREATE TABLE IF NOT EXISTS article_analyses (
      id TEXT PRIMARY KEY,
      article_id TEXT NOT NULL UNIQUE,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `;
  await db`
    CREATE TABLE IF NOT EXISTS project_comparisons (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL UNIQUE,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `;
}

export async function insertProject(topic: string): Promise<string> {
  const db = sql();
  const id = newId();
  await db`INSERT INTO projects (id, topic, created_at) VALUES (${id}, ${topic}, ${nowIso()})`;
  return id;
}

export async function insertArticle(projectId: string, url: string, manualText?: string | null): Promise<string> {
  const db = sql();
  const id = newId();
  const status = manualText ? "manual" : "pending";
  await db`
    INSERT INTO articles (id, project_id, url, raw_text, extraction_status, created_at)
    VALUES (${id}, ${projectId}, ${url}, ${manualText ?? ""}, ${status}, ${nowIso()})
  `;
  return id;
}

export async function updateArticle(articleId: string, fields: {
  headline?: string | null;
  source_name?: string | null;
  author?: string | null;
  published_at?: string | null;
  raw_text?: string | null;
  extraction_status?: string | null;
}) {
  const db = sql();
  // COALESCE preserves existing value when the supplied value is null
  await db`
    UPDATE articles SET
      headline          = COALESCE(${fields.headline          ?? null}, headline),
      source_name       = COALESCE(${fields.source_name       ?? null}, source_name),
      author            = COALESCE(${fields.author            ?? null}, author),
      published_at      = COALESCE(${fields.published_at      ?? null}, published_at),
      raw_text          = COALESCE(${fields.raw_text          ?? null}, raw_text),
      extraction_status = COALESCE(${fields.extraction_status ?? null}, extraction_status)
    WHERE id = ${articleId}
  `;
}

export async function saveAnalysis(articleId: string, payload: object) {
  const db = sql();
  await db`
    INSERT INTO article_analyses (id, article_id, payload, created_at)
    VALUES (${newId()}, ${articleId}, ${JSON.stringify(payload)}, ${nowIso()})
    ON CONFLICT (article_id) DO UPDATE SET payload = EXCLUDED.payload, created_at = EXCLUDED.created_at
  `;
}

export async function saveComparison(projectId: string, payload: object) {
  const db = sql();
  await db`
    INSERT INTO project_comparisons (id, project_id, payload, created_at)
    VALUES (${newId()}, ${projectId}, ${JSON.stringify(payload)}, ${nowIso()})
    ON CONFLICT (project_id) DO UPDATE SET payload = EXCLUDED.payload, created_at = EXCLUDED.created_at
  `;
}

export async function fetchProject(projectId: string): Promise<Record<string, unknown> | null> {
  const db = sql();
  const projects = await db`SELECT * FROM projects WHERE id = ${projectId}`;
  if (!projects.length) return null;
  const project = projects[0];

  const articles = await db`
    SELECT a.*, aa.payload AS analysis_payload
    FROM articles a
    LEFT JOIN article_analyses aa ON aa.article_id = a.id
    WHERE a.project_id = ${projectId}
    ORDER BY a.created_at
  `;
  const comparison = await db`SELECT payload FROM project_comparisons WHERE project_id = ${projectId}`;

  return {
    ...project,
    articles: articles.map((row) => {
      const { analysis_payload, ...rest } = row;
      return { ...rest, analysis: analysis_payload ? JSON.parse(analysis_payload as string) : null };
    }),
    comparison: comparison.length ? JSON.parse(comparison[0].payload as string) : null,
  };
}
