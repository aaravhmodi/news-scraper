export type Tone = {
  overall: string;
  score: number;
};

export type ArticleAnalysis = {
  source: string;
  headline: string;
  summary: string;
  tone: Tone;
  emotional_intensity: number;
  emotional_language: { phrase: string; effect: string }[];
  loaded_words: { word: string; reason: string }[];
  main_claims: string[];
  blame_or_credit: { entity: string; role: string; evidence: string }[];
  emphasized_facts: string[];
  possibly_omitted_context: string[];
  frame_label: string;
};

export type Article = {
  id: string;
  project_id: string;
  url: string;
  source_name: string;
  headline: string;
  author?: string | null;
  published_at?: string | null;
  raw_text: string;
  extraction_status: "success" | "failed" | "manual" | "pending";
  created_at: string;
  analysis?: ArticleAnalysis | null;
};

export type ProjectComparison = {
  neutral_event_summary: string;
  shared_facts: string[];
  source_specific_facts: Record<string, unknown>[];
  conflicting_claims: Record<string, unknown>[];
  framing_differences: Record<string, unknown>[];
  headline_comparison: Record<string, unknown>[];
  blame_credit_map: Record<string, unknown>[];
  coverage_gaps: string[];
};

export type Project = {
  id: string;
  topic: string;
  created_at: string;
  articles: Article[];
  comparison?: ProjectComparison | null;
};
