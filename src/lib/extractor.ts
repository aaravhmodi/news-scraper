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

function metaContent(html: string, ...properties: string[]): string | null {
  for (const prop of properties) {
    const match =
      html.match(new RegExp(`<meta[^>]+property=["']${prop}["'][^>]+content=["']([^"']+)["']`, "i")) ||
      html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${prop}["']`, "i")) ||
      html.match(new RegExp(`<meta[^>]+name=["']${prop}["'][^>]+content=["']([^"']+)["']`, "i")) ||
      html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${prop}["']`, "i"));
    if (match?.[1]) return match[1].trim();
  }
  return null;
}

function extractText(html: string): string {
  // Remove scripts, styles, nav, header, footer, aside
  let cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[\s\S]*?<\/nav>/gi, "")
    .replace(/<header[\s\S]*?<\/header>/gi, "")
    .replace(/<footer[\s\S]*?<\/footer>/gi, "")
    .replace(/<aside[\s\S]*?<\/aside>/gi, "");

  // Extract paragraphs
  const paragraphs: string[] = [];
  const pMatches = cleaned.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi);
  for (const m of pMatches) {
    const text = m[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (text.length > 40) paragraphs.push(text);
  }

  if (paragraphs.length >= 3) return paragraphs.join("\n\n");

  // Fallback: strip all tags
  return cleaned
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
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
      headers: { "User-Agent": "Mozilla/5.0 (compatible; BiasBuster/0.1)" },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();

    const headline =
      metaContent(html, "og:title", "twitter:title") ||
      html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() ||
      "Untitled article";

    const author = metaContent(html, "author", "article:author");
    const published_at = metaContent(html, "article:published_time", "date", "pubdate");
    const raw_text = extractText(html);

    return {
      headline,
      source_name: domain(url),
      author,
      published_at,
      raw_text,
      extraction_status: raw_text.length >= 250 ? "success" : "failed",
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
