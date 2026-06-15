export type Tone = {
  overall: string;
  score: number;
};

export type BiasType =
  | "coverage bias"
  | "gatekeeping bias"
  | "statement bias"
  | "spin bias"
  | "ideology bias";

export type QuotedSource = {
  name: string;
  affiliation: string;
  quote_count: number;
  stance: "supportive" | "critical" | "neutral" | "mixed";
};

export type DetectedBias = {
  bias_type: BiasType;
  evidence: string;
  confidence: "high" | "medium" | "low";
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
  quoted_sources: QuotedSource[];
  detected_biases: DetectedBias[];
  spin_direction: "positive" | "negative" | "neutral" | "mixed";
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
  executive_insight?: string;
  framing_comparison_table?: {
    source: string;
    headline: string;
    main_frame: string;
    core_claim: string;
    responsible_actor_or_cause: string;
    implied_solution: string;
    evidence_used: string;
    confidence: "high" | "medium" | "low";
  }[];
  headline_framing_analysis?: {
    source: string;
    headline: string;
    key_framing_words: string[];
    effect: string;
    reader_focus: string;
    confidence: "high" | "medium" | "low";
  }[];
  loaded_language?: {
    phrase: string;
    source: string;
    framing_effect: string;
    confidence: "high" | "medium" | "low";
  }[];
  source_by_source_analysis?: {
    source: string;
    main_frame: string;
    tone: string;
    central_claim: string;
    supporting_evidence: string[];
    blamed_or_credited: string[];
    implied_solution: string;
    notable_wording: string[];
    confidence: "high" | "medium" | "low";
  }[];
  emphasis_underemphasis?: {
    source: string;
    emphasizes: string[];
    may_underemphasize: string[];
    confidence: "high" | "medium" | "low";
  }[];
  cross_source_diagnosis?: {
    issue_exists: string;
    cause: string;
    responsible_actors: string;
    implied_solutions: string;
    evidence_used: string;
  };
  final_biasbuster_insight?: string;
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
