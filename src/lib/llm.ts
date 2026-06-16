import OpenAI from "openai";
import type { ArticleAnalysis, DetectedBias } from "@/types/biasbuster";

const MODEL = process.env.OPENAI_MODEL ?? "llama-3.3-70b-versatile";

function client() {
  const key = process.env.GROQ_API_KEY;
  if (!key) return null;
  return new OpenAI({ apiKey: key, baseURL: "https://api.groq.com/openai/v1" });
}

// NRC Emotion Lexicon subset (Mohammad & Turney, 2013)
const NRC_LEXICON: Record<string, Set<string>> = {
  anger: new Set(["angry","rage","fury","outrage","hostile","aggression","violent","attack","conflict","slams","blasts","condemns","furious","enraged","wrath","hatred","hate","threaten","alarming","inflammatory","incite","provoke"]),
  fear: new Set(["fear","scary","frightening","terrifying","threat","danger","risk","crisis","warning","panic","anxiety","worried","concern","unsafe","hazard","disaster","devastating","collapse","catastrophe","vulnerable","peril"]),
  trust: new Set(["trust","reliable","honest","integrity","credible","transparent","accountable","legitimate","official","expert","authority","confirmed","verified","evidence","proven","fact","established","accurate","objective"]),
  disgust: new Set(["disgusting","shameful","corrupt","scandalous","appalling","shocking","disgrace","immoral","unethical","hypocrisy","radical","extreme","controversial","vile","obscene","repugnant","outrageous"]),
  anticipation: new Set(["expect","predict","forecast","plan","future","upcoming","potential","possible","promise","proposal","goal","hope","intend","aim","project","strategy"]),
  surprise: new Set(["unexpected","surprising","shocking","sudden","unprecedented","historic","remarkable","astonishing","dramatic","unforeseen","revelation","revealed"]),
  joy: new Set(["celebrate","success","victory","achievement","benefit","improve","progress","win","positive","growth","praised","welcomed","triumph","thriving"]),
  sadness: new Set(["tragic","loss","suffering","victim","devastating","painful","grief","mourning","failed","decline","poverty","struggle","desperate","hopeless","misery"]),
};

const BIAS_THEORIES: Record<string, { theory: string; academic_reference: string }> = {
  "coverage bias": { theory: "Agenda-Setting Theory", academic_reference: "McCombs, M.E. & Shaw, D.L. (1972). The agenda-setting function of mass media. Public Opinion Quarterly, 36(2), 176–187." },
  "gatekeeping bias": { theory: "Gatekeeping Theory", academic_reference: "Shoemaker, P.J. & Vos, T.P. (2009). Gatekeeping Theory. Routledge." },
  "statement bias": { theory: "Framing Theory (Entman)", academic_reference: "Entman, R.M. (1993). Framing: Toward clarification of a fractured paradigm. Journal of Communication, 43(4), 51–58." },
  "spin bias": { theory: "Valence Framing", academic_reference: "Levin, I.P., Schneider, S.L. & Gaeth, G.J. (1998). All frames are not created equal. OBHDP, 76(2), 149–188." },
  "ideology bias": { theory: "Media Slant Theory", academic_reference: "Groseclose, T. & Milyo, J. (2005). A measure of media bias. QJE, 120(4), 1191–1237." },
};

const LOADED_TERMS = new Set(["crisis","chaos","slams","outrage","shocking","disaster","radical","extreme","failed","historic","controversial","alarming","devastating"]);

export function emotionScores(text: string): Record<string, number> {
  const words = text.toLowerCase().match(/\b\w+\b/g) ?? [];
  const total = Math.max(words.length, 1);
  return Object.fromEntries(
    Object.entries(NRC_LEXICON).map(([emotion, wordSet]) => [
      emotion,
      Math.round((words.filter(w => wordSet.has(w)).length / total) * 10000) / 10000,
    ])
  );
}

const ARTICLE_SYSTEM = `You are a computational media-bias analyst grounded in peer-reviewed communication research.
Analyze news framing using these established academic frameworks:

1. ENTMAN (1993) FRAMING FUNCTIONS — every article performs four functions:
   define (what is the problem?), diagnose (who/what caused it?),
   evaluate (what moral judgment applies?), recommend (what should be done?).

2. IYENGAR (1991) FRAMING TYPES — episodic frames present events as isolated incidents;
   thematic frames place events in broader societal/policy context.

3. RODRIGO-GINÉS ET AL. (2024) BIAS TAXONOMY — five bias types:
   coverage bias (agenda-setting, McCombs & Shaw 1972),
   gatekeeping bias (Shoemaker & Vos 2009),
   statement bias (word choice framing, Entman 1993),
   spin bias (valence framing, Levin et al. 1998),
   ideology bias (media slant, Groseclose & Milyo 2005).

4. NRC EMOTION LEXICON (Mohammad & Turney, 2013) — pre-computed emotion scores are supplied;
   use them to calibrate emotional intensity claims.

Return only valid JSON. Do not label outlets as left/right.
Mark omitted context as possible, not certain. Keep all evidence grounded in the article text.`;

const COMPARISON_SYSTEM = `You are BiasBuster, a computational framing-comparison system grounded in communication science.
Apply these frameworks when comparing articles:
- Agenda-setting (McCombs & Shaw, 1972): which topics get prominence?
- Entman (1993) framing: how do define/diagnose/evaluate/recommend differ across sources?
- Iyengar (1991): is each source episodic or thematic in its framing?
- Rodrigo-Ginés et al. (2024) bias taxonomy: coverage, gatekeeping, statement, spin, ideology bias.

Your job is to compare how each article frames the same issue — not to decide who is correct.
Do not label outlets as good, bad, left, or right.
Use cautious wording for omissions: "may underemphasize" not "ignores."
Return only valid JSON. Be specific. Avoid generic filler.`;

function articlePrompt(source: string, headline: string, text: string, scores: Record<string, number>) {
  return `Analyze this article for news framing and media bias using established academic frameworks.

Pre-computed NRC Emotion Lexicon scores (Mohammad & Turney, 2013):
${JSON.stringify(scores)}

Source: ${source}
Headline: ${headline}
Text:
${text.slice(0, 14000)}

Return JSON with these fields:
- source, headline, summary
- tone: {overall (string label), score (float -1 to 1)}
- emotional_intensity: float 0-1 (calibrate against the NRC scores above)
- emotional_language: [{phrase, effect}]
- loaded_words: [{word, reason}]
- main_claims: []
- blame_or_credit: [{entity, role: blamed|credited|defended, evidence}]
- emphasized_facts: []
- possibly_omitted_context: []
- frame_label: one of: economic, moral, conflict, responsibility, human impact, policy, security, uncertainty
- spin_direction: one of: positive, negative, neutral, mixed
- quoted_sources: [{name, affiliation, quote_count (int), stance: supportive|critical|neutral|mixed}]
- detected_biases: [{bias_type, evidence, confidence: high|medium|low, theory, academic_reference}]
    bias_type is one of: "coverage bias", "gatekeeping bias", "statement bias", "spin bias", "ideology bias"
    theory: the academic theory name classifying this bias
    academic_reference: the canonical citation
- entman_functions: {define, diagnose, evaluate, recommend}
- framing_type: one of: "episodic", "thematic", "mixed"
- emotion_scores: the NRC scores dict provided above (copy unchanged)`;
}

function comparisonPrompt(topic: string, analyses: ArticleAnalysis[]) {
  return `Given the article analyses below, generate a structured BiasBuster report using the media bias taxonomy.

Bias types: coverage bias, gatekeeping bias, statement bias, spin bias, ideology bias.

Topic: ${topic}

Analyses:
${JSON.stringify(analyses).slice(0, 18000)}

Return JSON with:
executive_insight, neutral_event_summary, shared_facts,
framing_comparison_table: [{source, headline, main_frame, core_claim, responsible_actor_or_cause, implied_solution, evidence_used, confidence}],
headline_framing_analysis: [{source, headline, key_framing_words, effect, reader_focus, confidence}],
loaded_language: [{phrase, source, framing_effect, confidence}],
source_by_source_analysis: [{source, main_frame, tone, central_claim, supporting_evidence, blamed_or_credited, implied_solution, notable_wording, confidence}],
emphasis_underemphasis: [{source, emphasizes, may_underemphasize, confidence}],
cross_source_diagnosis: {issue_exists, cause, responsible_actors, implied_solutions, evidence_used},
final_biasbuster_insight,
source_specific_facts, conflicting_claims, framing_differences, headline_comparison, blame_credit_map, coverage_gaps.`;
}

async function callJson(system: string, prompt: string): Promise<Record<string, unknown>> {
  const c = client();
  if (!c) throw new Error("GROQ_API_KEY is not configured");
  const res = await c.chat.completions.create({
    model: MODEL,
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content: prompt },
    ],
  });
  const text = res.choices[0].message.content ?? "{}";
  return JSON.parse(text.replace(/^```(?:json)?/, "").replace(/```$/, "").trim());
}

// Heuristic fallback
function sentences(text: string): string[] {
  return text.replace(/\n/g, " ").split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(s => s.length > 40);
}

function heuristicArticle(source: string, headline: string, text: string): ArticleAnalysis {
  const lowered = text.toLowerCase();
  const words = lowered.match(/\b\w+\b/g) ?? [];
  const foundTerms = [...LOADED_TERMS].filter(t => lowered.includes(t));
  const emotion = Math.min(1.0, 0.15 + foundTerms.length * 0.08 + (headline.match(/!/g)?.length ?? 0) * 0.1);
  let score = 0;
  if (/praise|welcomed|success|benefit|improved/.test(lowered)) score += 0.25;
  if (/criticized|failed|concern|risk|blame/.test(lowered)) score -= 0.25;
  const label = emotion > 0.55 ? "alarmist" : score < -0.15 ? "critical" : score > 0.15 ? "supportive" : /concern|risk|unclear/.test(lowered) ? "concerned" : "neutral";
  const sents = sentences(text);
  const claims = sents.slice(0, 4).length ? sents.slice(0, 4) : [text.slice(0, 220)];
  const emphasized = sents.slice(1, 5).length ? sents.slice(1, 5) : claims;

  const frame = /cost|market|price|jobs|econom/.test(lowered) ? "economic"
    : /victim|family|community|people/.test(lowered) ? "human impact"
    : /security|threat|police|border/.test(lowered) ? "security"
    : /unclear|unknown|may|could/.test(lowered) ? "uncertainty" : "policy";

  const spin = score > 0.3 ? "positive" : score < -0.3 ? "negative" : emotion > 0.4 ? "mixed" : "neutral";
  const scores = emotionScores(text);

  const detected: DetectedBias[] = [];
  if (emotion > 0.55) detected.push({ bias_type: "spin bias", evidence: `High emotional intensity (${emotion.toFixed(2)}) with loaded terms: ${foundTerms.slice(0, 4).join(", ")}.`, confidence: "medium", ...BIAS_THEORIES["spin bias"] });
  if (/according to|sources say|officials say|experts say/.test(lowered)) detected.push({ bias_type: "statement bias", evidence: "Relies on vague attribution (sources say, officials say) which shapes credibility framing.", confidence: "low", ...BIAS_THEORIES["statement bias"] });

  const framingType = /system|policy|structural|broader|overall/.test(lowered) ? "thematic" : "episodic";

  return {
    source,
    headline,
    summary: (sents[0] ?? text.slice(0, 280)).trim(),
    tone: { overall: label, score },
    emotional_intensity: emotion,
    emotional_language: foundTerms.slice(0, 8).map(phrase => ({ phrase, effect: "Signals heightened urgency or judgment." })),
    loaded_words: foundTerms.slice(0, 8).map(word => ({ word, reason: "Potentially frames the event with evaluative language." })),
    main_claims: claims.slice(0, 5),
    blame_or_credit: [],
    emphasized_facts: emphasized.slice(0, 5),
    possibly_omitted_context: ["Possible broader timeline or historical context.", "Possible response from affected parties not quoted."],
    frame_label: frame as ArticleAnalysis["frame_label"],
    quoted_sources: [],
    detected_biases: detected,
    spin_direction: spin as ArticleAnalysis["spin_direction"],
    entman_functions: { define: `Defines the issue using a ${frame} frame.`, diagnose: "Cause not explicitly identified.", evaluate: "Moral judgment inferred from tone and loaded language.", recommend: "Implied solution follows from the dominant frame." },
    framing_type: framingType as "episodic" | "thematic" | "mixed",
    emotion_scores: scores,
  };
}

export async function analyzeArticle(source: string, headline: string, text: string): Promise<ArticleAnalysis> {
  const c = client();
  if (c) {
    const scores = emotionScores(text);
    const prompt = articlePrompt(source, headline, text, scores);
    for (let i = 0; i < 2; i++) {
      try {
        return (await callJson(ARTICLE_SYSTEM, i === 0 ? prompt : prompt + "\n\nPrevious output was invalid. Return valid JSON only.")) as unknown as ArticleAnalysis;
      } catch {
        // fall through to retry or heuristic
      }
    }
  }
  return heuristicArticle(source, headline, text);
}

export async function compareProject(topic: string, analyses: ArticleAnalysis[]): Promise<Record<string, unknown>> {
  const c = client();
  if (c) {
    const prompt = comparisonPrompt(topic, analyses);
    for (let i = 0; i < 2; i++) {
      try {
        return await callJson(COMPARISON_SYSTEM, i === 0 ? prompt : prompt + "\n\nPrevious output was invalid. Return valid JSON only.");
      } catch {
        // fall through
      }
    }
  }
  // minimal heuristic comparison
  return {
    executive_insight: `Articles about "${topic}" frame the issue differently. Compare them to see which causes and actors each source makes most salient.`,
    neutral_event_summary: `The supplied articles discuss ${topic} through overlapping concerns but emphasize different angles.`,
    shared_facts: [],
    framing_comparison_table: analyses.map(a => ({ source: a.source, headline: a.headline, main_frame: a.frame_label, core_claim: a.main_claims[0] ?? a.summary, responsible_actor_or_cause: "", implied_solution: "", evidence_used: a.emphasized_facts[0] ?? "", confidence: "low" })),
    headline_framing_analysis: [],
    loaded_language: [],
    source_by_source_analysis: [],
    emphasis_underemphasis: [],
    cross_source_diagnosis: { issue_exists: "", cause: "", responsible_actors: "", implied_solutions: "", evidence_used: "" },
    final_biasbuster_insight: "",
    source_specific_facts: [], conflicting_claims: [], framing_differences: [], headline_comparison: [], blame_credit_map: [], coverage_gaps: [],
  };
}
