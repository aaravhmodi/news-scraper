import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";

export interface ExtractedArticle {
  headline: string;
  source_name: string;
  author: string | null;
  published_at: string | null;
  raw_text: string;
  extraction_status: "success" | "failed" | "manual";
}

function domain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "") || "Unknown source";
  } catch {
    return "Unknown source";
  }
}

function metaContent(dom: JSDOM, ...names: string[]): string | null {
  for (const name of names) {
    const el =
      dom.window.document.querySelector(`meta[property="${name}"]`) ||
      dom.window.document.querySelector(`meta[name="${name}"]`);
    const content = el?.getAttribute("content")?.trim();
    if (content) return content;
  }
  return null;
}

export async function extractArticle(url: string, manualText?: string | null): Promise<ExtractedArticle> {
  if (manualText?.trim()) {
    return {
      headline: "Manual article text",
      source_name: domain(url),
      author: null,
      published_at: null,
      raw_text: manualText.trim(),
      extraction_status: "manual",
    };
  }

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "BiasBuster/0.1" },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();

    const dom = new JSDOM(html, { url });
    const headline =
      metaContent(dom, "og:title", "twitter:title") ||
      dom.window.document.title?.trim() ||
      "Untitled article";
    const author = metaContent(dom, "author", "article:author");
    const published_at = metaContent(dom, "article:published_time", "date", "pubdate");

    const reader = new Readability(dom.window.document);
    const article = reader.parse();
    const text = article?.textContent?.trim() ?? "";

    return {
      headline,
      source_name: domain(url),
      author,
      published_at,
      raw_text: text,
      extraction_status: text.length >= 250 ? "success" : "failed",
    };
  } catch {
    return {
      headline: "Extraction failed",
      source_name: domain(url),
      author: null,
      published_at: null,
      raw_text: "",
      extraction_status: "failed",
    };
  }
}
