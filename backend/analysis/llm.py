from __future__ import annotations

import json
import os
import re
from collections import Counter, defaultdict
from typing import Any

from openai import APIError, AsyncOpenAI
from pydantic import ValidationError

from backend.schemas import ArticleAnalysis, DetectedBias, EntmanFunctions, ProjectComparison, QuotedSource


MODEL = os.getenv("OPENAI_MODEL", "llama-3.3-70b-versatile")
CLIENT = AsyncOpenAI(api_key=os.getenv("GROQ_API_KEY"), base_url="https://api.groq.com/openai/v1") if os.getenv("GROQ_API_KEY") else None

# NRC Emotion Lexicon subset (Mohammad & Turney, 2013) — word → emotion category mapping
_NRC_LEXICON: dict[str, set[str]] = {
    "anger": {
        "angry", "rage", "fury", "outrage", "hostile", "aggression", "violent", "attack",
        "conflict", "slams", "blasts", "condemns", "furious", "enraged", "wrath", "hatred",
        "hate", "threaten", "alarming", "inflammatory", "incite", "provoke",
    },
    "fear": {
        "fear", "scary", "frightening", "terrifying", "threat", "danger", "risk", "crisis",
        "warning", "panic", "anxiety", "worried", "concern", "unsafe", "hazard", "disaster",
        "devastating", "collapse", "catastrophe", "vulnerable", "peril",
    },
    "trust": {
        "trust", "reliable", "honest", "integrity", "credible", "transparent", "accountable",
        "legitimate", "official", "expert", "authority", "confirmed", "verified", "evidence",
        "proven", "fact", "established", "accurate", "objective",
    },
    "disgust": {
        "disgusting", "shameful", "corrupt", "scandalous", "appalling", "shocking", "disgrace",
        "immoral", "unethical", "hypocrisy", "radical", "extreme", "controversial", "vile",
        "obscene", "repugnant", "outrageous",
    },
    "anticipation": {
        "expect", "predict", "forecast", "plan", "future", "upcoming", "potential", "possible",
        "promise", "proposal", "goal", "hope", "intend", "aim", "project", "strategy",
    },
    "surprise": {
        "unexpected", "surprising", "shocking", "sudden", "unprecedented", "historic",
        "remarkable", "astonishing", "dramatic", "unforeseen", "revelation", "revealed",
    },
    "joy": {
        "celebrate", "success", "victory", "achievement", "benefit", "improve", "progress",
        "win", "positive", "growth", "praised", "welcomed", "triumph", "thriving",
    },
    "sadness": {
        "tragic", "loss", "suffering", "victim", "devastating", "painful", "grief", "mourning",
        "failed", "decline", "poverty", "struggle", "desperate", "hopeless", "misery",
    },
}

# Academic bias theory reference map keyed by bias_type
_BIAS_THEORIES: dict[str, tuple[str, str]] = {
    "coverage bias": (
        "Agenda-Setting Theory",
        "McCombs, M.E. & Shaw, D.L. (1972). The agenda-setting function of mass media. "
        "Public Opinion Quarterly, 36(2), 176–187.",
    ),
    "gatekeeping bias": (
        "Gatekeeping Theory",
        "Shoemaker, P.J. & Vos, T.P. (2009). Gatekeeping Theory. Routledge.",
    ),
    "statement bias": (
        "Framing Theory (Entman)",
        "Entman, R.M. (1993). Framing: Toward clarification of a fractured paradigm. "
        "Journal of Communication, 43(4), 51–58.",
    ),
    "spin bias": (
        "Valence Framing",
        "Levin, I.P., Schneider, S.L. & Gaeth, G.J. (1998). All frames are not created equal: "
        "A typology and critical analysis of framing effects. Organizational Behavior and Human "
        "Decision Processes, 76(2), 149–188.",
    ),
    "ideology bias": (
        "Media Slant Theory",
        "Groseclose, T. & Milyo, J. (2005). A measure of media bias. "
        "Quarterly Journal of Economics, 120(4), 1191–1237.",
    ),
}


def _emotion_scores(text: str) -> dict[str, float]:
    """Compute NRC emotion frequency scores (Mohammad & Turney, 2013)."""
    words = re.findall(r"\b\w+\b", text.lower())
    total = max(len(words), 1)
    return {
        emotion: round(sum(1 for w in words if w in word_set) / total, 4)
        for emotion, word_set in _NRC_LEXICON.items()
    }


LOADED_TERMS = {
    "crisis",
    "chaos",
    "slams",
    "outrage",
    "shocking",
    "disaster",
    "radical",
    "extreme",
    "failed",
    "historic",
    "controversial",
    "alarming",
    "devastating",
}


ARTICLE_SYSTEM = """You are a computational media-bias analyst grounded in peer-reviewed communication research.
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
Mark omitted context as possible, not certain. Keep all evidence grounded in the article text."""


COMPARISON_SYSTEM = """You are BiasBuster, a computational framing-comparison system grounded in communication science.
Apply these frameworks when comparing articles:
- Agenda-setting (McCombs & Shaw, 1972): which topics get prominence?
- Entman (1993) framing: how do define/diagnose/evaluate/recommend differ across sources?
- Iyengar (1991): is each source episodic or thematic in its framing?
- Rodrigo-Ginés et al. (2024) bias taxonomy: coverage, gatekeeping, statement, spin, ideology bias.

Your job is to compare how each article frames the same issue — not to decide who is correct.
Do not label outlets as good, bad, left, or right.
Do not claim intentional bias unless directly supported by text evidence.
Use cautious wording for omissions: "may underemphasize" not "ignores."
Identify semantic overlap, not only exact wording. Separate stated claims from inferred analysis.
Return only valid JSON. Be specific. Avoid generic filler."""


ARTICLE_PROMPT = """Analyze this article for news framing and media bias using established academic frameworks.

Pre-computed NRC Emotion Lexicon scores for this article (Mohammad & Turney, 2013):
{emotion_scores}

Source: {source}
Headline: {headline}
Text:
{text}

Return JSON with these fields:
- source, headline, summary
- tone: {{overall (string label), score (float -1 to 1)}}
- emotional_intensity: float 0-1 (calibrate against the NRC scores above)
- emotional_language: [{{phrase, effect}}]
- loaded_words: [{{word, reason}}]
- main_claims: []
- blame_or_credit: [{{entity, role: blamed|credited|defended, evidence}}]
- emphasized_facts: []
- possibly_omitted_context: []
- frame_label: one of: economic, moral, conflict, responsibility, human impact, policy, security, uncertainty
- spin_direction: one of: positive, negative, neutral, mixed
- quoted_sources: [{{name, affiliation, quote_count (int), stance: supportive|critical|neutral|mixed}}]
- detected_biases: [{{bias_type, evidence, confidence: high|medium|low, theory, academic_reference}}]
    bias_type is one of: "coverage bias", "gatekeeping bias", "statement bias", "spin bias", "ideology bias"
    theory: the academic theory name that classifies this bias (e.g. "Agenda-Setting Theory")
    academic_reference: the canonical citation (author, year, journal)
- entman_functions: {{define, diagnose, evaluate, recommend}} — Entman (1993) four framing functions
- framing_type: one of: "episodic", "thematic", "mixed" — Iyengar (1991)
- emotion_scores: the NRC emotion scores dict provided above (copy them through unchanged)"""


COMPARISON_PROMPT = """Given the article analyses below, generate a structured BiasBuster report using the media bias taxonomy from systematic research.

Bias types to consider:
- coverage bias: over/under-representation of topics or viewpoints
- gatekeeping bias: which facts or stories are included vs excluded
- statement bias: word choice that frames facts positively or negatively
- spin bias: positive or negative spin applied to the same event
- ideology bias: alignment with a political or ideological worldview

Topic: {topic}

Analyses:
{analyses}

Return JSON with:
executive_insight: one strong paragraph explaining the main framing difference across the articles, naming specific bias types observed.
neutral_event_summary: a specific neutral summary of the shared issue using only supplied article information.
shared_facts: facts or broad claims appearing across at least two articles, including semantic matches.
framing_comparison_table: array of objects with source, headline, main_frame, core_claim, responsible_actor_or_cause, implied_solution, evidence_used, confidence.
headline_framing_analysis: array of objects with source, headline, key_framing_words, effect, reader_focus, confidence.
loaded_language: array of objects with phrase, source, framing_effect, confidence.
source_by_source_analysis: array of objects with source, main_frame, tone, central_claim, supporting_evidence, blamed_or_credited, implied_solution, notable_wording, confidence.
emphasis_underemphasis: array of objects with source, emphasizes, may_underemphasize, confidence.
cross_source_diagnosis: object with issue_exists, cause, responsible_actors, implied_solutions, evidence_used.
final_biasbuster_insight: polished final takeaway explaining what a reader learns by comparing these sources together, referencing specific bias types detected.

Also include legacy compatibility fields:
source_specific_facts, conflicting_claims, framing_differences, headline_comparison, blame_credit_map, coverage_gaps."""


def _json_from_text(text: str) -> dict[str, Any]:
    cleaned = text.strip()
    cleaned = re.sub(r"^```(?:json)?", "", cleaned).strip()
    cleaned = re.sub(r"```$", "", cleaned).strip()
    return json.loads(cleaned)


async def _call_json(system: str, prompt: str) -> dict[str, Any]:
    if not CLIENT:
        raise RuntimeError("GROQ_API_KEY is not configured")
    response = await CLIENT.chat.completions.create(
        model=MODEL,
        temperature=0.2,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": prompt},
        ],
    )
    return _json_from_text(response.choices[0].message.content or "{}")


def _sentences(text: str) -> list[str]:
    parts = re.split(r"(?<=[.!?])\s+", text.replace("\n", " "))
    return [p.strip() for p in parts if len(p.strip()) > 40]


def _heuristic_article(source: str, headline: str, text: str) -> ArticleAnalysis:
    lowered = text.lower()
    found_terms = [term for term in LOADED_TERMS if term in lowered]
    emotion = min(1.0, 0.15 + len(found_terms) * 0.08 + headline.count("!") * 0.1)
    score = 0.0
    if any(word in lowered for word in ["praise", "welcomed", "success", "benefit", "improved"]):
        score += 0.25
    if any(word in lowered for word in ["criticized", "failed", "concern", "risk", "blame"]):
        score -= 0.25
    label = "neutral"
    if emotion > 0.55:
        label = "alarmist"
    elif score < -0.15:
        label = "critical"
    elif score > 0.15:
        label = "supportive"
    elif any(word in lowered for word in ["concern", "risk", "unclear"]):
        label = "concerned"

    sentences = _sentences(text)
    claims = sentences[:4] or [text[:220]]
    emphasized = sentences[1:5] or claims
    entities = re.findall(r"\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3}\b", text)
    common_entities = [entity for entity, _ in Counter(entities).most_common(4)]
    blame_credit = []
    for entity in common_entities[:3]:
        window = next((s for s in sentences if entity in s), "")
        role = "defended"
        if re.search(r"blam|critic|fault|failed|responsib", window, re.I):
            role = "blamed"
        elif re.search(r"credit|praise|success|led|delivered", window, re.I):
            role = "credited"
        blame_credit.append({"entity": entity, "role": role, "evidence": window[:240]})

    frame = "policy"
    if any(w in lowered for w in ["cost", "market", "price", "jobs", "econom"]):
        frame = "economic"
    elif any(w in lowered for w in ["victim", "family", "community", "people"]):
        frame = "human impact"
    elif any(w in lowered for w in ["security", "threat", "police", "border"]):
        frame = "security"
    elif any(w in lowered for w in ["unclear", "unknown", "may", "could"]):
        frame = "uncertainty"

    # Quoted sources: heuristic extraction of named quotes
    quote_pattern = re.compile(r'"[^"]{10,200}"\s*[,—–]\s*([A-Z][a-zA-Z\s]{2,40}?)(?:[,.]|$)', re.M)
    quoted: list[QuotedSource] = []
    seen_names: set[str] = set()
    for m in quote_pattern.finditer(text):
        name = m.group(1).strip()
        if name not in seen_names:
            seen_names.add(name)
            quoted.append(QuotedSource(name=name, quote_count=1, stance="neutral"))

    # Detected biases: heuristic with academic grounding
    detected: list[DetectedBias] = []
    if emotion > 0.55:
        theory, ref = _BIAS_THEORIES["spin bias"]
        detected.append(DetectedBias(
            bias_type="spin bias",
            evidence=f"High emotional intensity ({emotion:.2f}) and loaded terms: {', '.join(found_terms[:4])}.",
            confidence="medium",
            theory=theory,
            academic_reference=ref,
        ))
    if any(w in lowered for w in ["according to", "sources say", "officials say", "experts say"]):
        theory, ref = _BIAS_THEORIES["statement bias"]
        detected.append(DetectedBias(
            bias_type="statement bias",
            evidence="Relies on unnamed or vague attribution ('sources say', 'officials say') which can shape credibility framing.",
            confidence="low",
            theory=theory,
            academic_reference=ref,
        ))
    if len(quoted) == 1:
        theory, ref = _BIAS_THEORIES["coverage bias"]
        detected.append(DetectedBias(
            bias_type="coverage bias",
            evidence=f"Only one named source quoted ({quoted[0].name}), limiting perspective diversity.",
            confidence="medium",
            theory=theory,
            academic_reference=ref,
        ))
    if score > 0.3:
        spin = "positive"
    elif score < -0.3:
        spin = "negative"
    elif emotion > 0.4:
        spin = "mixed"
    else:
        spin = "neutral"

    scores = _emotion_scores(text)
    # Heuristic Entman framing functions
    entman = EntmanFunctions(
        define=f"The article defines the issue using a {frame} frame.",
        diagnose=blame_credit[0]["evidence"][:180] if blame_credit else "Cause not explicitly identified.",
        evaluate="Moral or value judgment inferred from tone and loaded language.",
        recommend="Implied solution follows from the dominant frame.",
    )
    framing_type: str = "thematic" if any(w in lowered for w in ["system", "policy", "structural", "broader", "overall"]) else "episodic"

    return ArticleAnalysis(
        source=source,
        headline=headline,
        summary=(sentences[0] if sentences else text[:280]).strip(),
        tone={"overall": label, "score": score},
        emotional_intensity=emotion,
        emotional_language=[{"phrase": term, "effect": "Signals heightened urgency or judgment."} for term in found_terms[:8]],
        loaded_words=[{"word": term, "reason": "Potentially frames the event with evaluative language."} for term in found_terms[:8]],
        main_claims=claims[:5],
        blame_or_credit=blame_credit,
        emphasized_facts=emphasized[:5],
        possibly_omitted_context=[
            "Possible broader timeline or historical context.",
            "Possible response from affected parties not quoted in this article.",
        ],
        frame_label=frame,  # type: ignore[arg-type]
        quoted_sources=quoted[:8],
        detected_biases=detected,
        spin_direction=spin,  # type: ignore[arg-type]
        entman_functions=entman,
        framing_type=framing_type,  # type: ignore[arg-type]
        emotion_scores=scores,
    )


async def analyze_article(source: str, headline: str, text: str) -> ArticleAnalysis:
    if CLIENT:
        scores = _emotion_scores(text)
        prompt = ARTICLE_PROMPT.format(
            source=source,
            headline=headline,
            text=text[:14000],
            emotion_scores=json.dumps(scores),
        )
        for _ in range(2):
            try:
                return ArticleAnalysis.model_validate(await _call_json(ARTICLE_SYSTEM, prompt))
            except (APIError, RuntimeError, ValidationError, json.JSONDecodeError):
                prompt += "\n\nPrevious output was invalid. Return valid JSON only."
    return _heuristic_article(source, headline, text)


def _fact_key(fact: str) -> str:
    words = re.findall(r"[a-zA-Z]{4,}", fact.lower())
    return " ".join(words[:8])


SEMANTIC_FACTS = [
    (
        "Canada is facing a serious housing affordability problem.",
        {"housing", "home", "homes", "rent", "afford", "expensive", "cost", "crisis", "price", "prices"},
    ),
    (
        "The cost or difficulty of adding new housing supply is a major issue.",
        {"build", "building", "construction", "supply", "development", "builders", "homes", "housing"},
    ),
    (
        "Government policy, regulation, fees, or public measurements affect how the issue is understood.",
        {"government", "municipal", "policy", "regulation", "charges", "fees", "tax", "cmhc", "statistics", "rate"},
    ),
    (
        "The issue is complex and cannot be explained by one simple number or cause.",
        {"complex", "system", "measure", "statistics", "rate", "multiple", "barrier", "barriers", "crisis"},
    ),
]


def _analysis_blob(analysis: ArticleAnalysis) -> str:
    parts = [
        analysis.source,
        analysis.headline,
        analysis.summary,
        " ".join(analysis.main_claims),
        " ".join(analysis.emphasized_facts),
        " ".join(analysis.possibly_omitted_context),
        " ".join(b.evidence for b in analysis.detected_biases),
    ]
    return " ".join(parts).lower()


def _semantic_shared_facts(analyses: list[ArticleAnalysis]) -> list[str]:
    shared: list[str] = []
    for fact, keywords in SEMANTIC_FACTS:
        matches = 0
        for analysis in analyses:
            blob = _analysis_blob(analysis)
            if sum(1 for keyword in keywords if keyword in blob) >= 2:
                matches += 1
        if matches >= 2:
            shared.append(fact)
    return shared


def _frame_name(analysis: ArticleAnalysis) -> str:
    blob = _analysis_blob(analysis)
    headline = analysis.headline.lower()
    if any(term in blob for term in ["development charge", "development charges", "municipal", "fees"]):
        return "Municipal cost barrier"
    if any(term in blob for term in ["homeownership", "ownership rate", "statistics", "measurement", "hiding"]):
        return "Measurement problem"
    if any(term in blob for term in ["build", "building", "construction", "feasibility", "too expensive to build"]):
        return "Construction economics"
    if any(term in headline for term in ["broken", "system"]):
        return "Structural failure"
    return f"{analysis.frame_label.title()} frame"


def _headline_words(headline: str) -> list[str]:
    phrases = re.findall(r"[\"'“”]([^\"'“”]{4,80})[\"'“”]", headline)
    words = re.findall(r"\b(?:broken|crisis|barrier|significant|hiding|bad|expensive|failed|warning|warns|risk)\b", headline, re.I)
    result = [p.strip() for p in phrases if p.strip()]
    result.extend(word.lower() for word in words)
    return list(dict.fromkeys(result))[:5]


def _headline_effect(headline: str) -> str:
    lowered = headline.lower()
    if "broken" in lowered:
        return "Frames the issue as a deep structural failure rather than a temporary market problem."
    if "barrier" in lowered:
        return "Narrows attention toward a specific obstacle blocking progress."
    if "hiding" in lowered or "statistic" in lowered or "rate" in lowered:
        return "Suggests commonly cited measures may obscure the severity of the problem."
    if "crisis" in lowered:
        return "Signals urgency and presents the issue as severe."
    return "Uses the headline to establish the article's main interpretive lens."


def _implied_solution(analysis: ArticleAnalysis, frame: str) -> str:
    blob = _analysis_blob(analysis)
    if "development charge" in blob or "fees" in blob:
        return "Reduce or redesign development charges and municipal cost barriers."
    if "homeownership" in blob or "statistics" in blob or "measure" in blob:
        return "Use better affordability, ownership, and housing-stress measures."
    if "build" in blob or "construction" in blob or "feasibility" in blob:
        return "Make homebuilding more financially viable."
    if frame.lower().startswith("policy"):
        return "Change the policy settings the article identifies as most important."
    return "Address the cause emphasized by the article."


def _responsible_actor(analysis: ArticleAnalysis, frame: str) -> str:
    if analysis.blame_or_credit:
        return "; ".join(f"{item.entity} ({item.role})" for item in analysis.blame_or_credit[:2])
    blob = _analysis_blob(analysis)
    if "development charge" in blob or "municipal" in blob:
        return "Municipal governments and development fees"
    if "homeownership" in blob or "statistics" in blob:
        return "Overreliance on broad ownership metrics"
    if "build" in blob or "construction" in blob:
        return "High building costs and weak construction feasibility"
    return "The cause emphasized by the article"


def _loaded_language(analyses: list[ArticleAnalysis]) -> list[dict[str, str]]:
    items: list[dict[str, str]] = []
    for analysis in analyses:
        headline_terms = _headline_words(analysis.headline)
        for phrase in headline_terms:
            items.append(
                {
                    "phrase": phrase,
                    "source": analysis.source,
                    "framing_effect": _headline_effect(analysis.headline),
                    "confidence": "high",
                }
            )
        for word in analysis.loaded_words[:3]:
            items.append(
                {
                    "phrase": word.word,
                    "source": analysis.source,
                    "framing_effect": word.reason,
                    "confidence": "high",
                }
            )
    seen: set[tuple[str, str]] = set()
    unique = []
    for item in items:
        key = (item["phrase"].lower(), item["source"])
        if key not in seen:
            seen.add(key)
            unique.append(item)
    return unique[:12]


def _heuristic_comparison(topic: str, analyses: list[ArticleAnalysis]) -> ProjectComparison:
    fact_sources: dict[str, list[str]] = defaultdict(list)
    fact_text: dict[str, str] = {}
    for analysis in analyses:
        for fact in analysis.emphasized_facts:
            key = _fact_key(fact)
            if key:
                fact_sources[key].append(analysis.source)
                fact_text[key] = fact

    shared = _semantic_shared_facts(analyses)
    shared.extend(fact_text[k] for k, sources in fact_sources.items() if len(set(sources)) > 1)
    shared = list(dict.fromkeys(shared))[:8]
    specific = [
        {"source": sources[0], "fact": fact_text[k]}
        for k, sources in fact_sources.items()
        if len(set(sources)) == 1
    ][:10]
    frames = {analysis.source: _frame_name(analysis) for analysis in analyses}
    frame_sentence = ", ".join(f"{analysis.source} frames it as {frames[analysis.source].lower()}" for analysis in analyses)
    executive = (
        f"The supplied articles treat {topic} as a shared issue, but they compete over the diagnosis. "
        f"{frame_sentence}. Reading them together shifts the focus from whether the issue exists to which cause, actor, and evidence each source makes most salient."
    )

    return ProjectComparison(
        executive_insight=executive,
        neutral_event_summary=(
            f"The supplied articles discuss {topic} through overlapping concerns about affordability, system barriers, and how the problem should be understood. "
            f"They share the broad issue but emphasize different angles: {frame_sentence}."
        ),
        shared_facts=shared,
        framing_comparison_table=[
            {
                "source": a.source,
                "headline": a.headline,
                "main_frame": frames[a.source],
                "core_claim": a.main_claims[0] if a.main_claims else a.summary,
                "responsible_actor_or_cause": _responsible_actor(a, frames[a.source]),
                "implied_solution": _implied_solution(a, frames[a.source]),
                "evidence_used": "; ".join(a.emphasized_facts[:2]) or a.summary,
                "confidence": "medium",
            }
            for a in analyses
        ],
        headline_framing_analysis=[
            {
                "source": a.source,
                "headline": a.headline,
                "key_framing_words": _headline_words(a.headline),
                "effect": _headline_effect(a.headline),
                "reader_focus": frames[a.source],
                "confidence": "high" if a.headline else "low",
            }
            for a in analyses
        ],
        loaded_language=_loaded_language(analyses),
        source_by_source_analysis=[
            {
                "source": a.source,
                "main_frame": frames[a.source],
                "tone": a.tone.overall,
                "central_claim": a.main_claims[0] if a.main_claims else a.summary,
                "supporting_evidence": a.emphasized_facts[:4],
                "blamed_or_credited": [f"{item.entity} {item.role}: {item.evidence}" for item in a.blame_or_credit[:3]],
                "implied_solution": _implied_solution(a, frames[a.source]),
                "notable_wording": _headline_words(a.headline) + [word.word for word in a.loaded_words[:3]],
                "confidence": "medium",
            }
            for a in analyses
        ],
        emphasis_underemphasis=[
            {
                "source": a.source,
                "emphasizes": a.emphasized_facts[:4] or [frames[a.source]],
                "may_underemphasize": [
                    f"Angles emphasized by other sources, such as {other_frame.lower()}."
                    for other_source, other_frame in frames.items()
                    if other_source != a.source and other_frame != frames[a.source]
                ][:3],
                "confidence": "low",
            }
            for a in analyses
        ],
        cross_source_diagnosis={
            "issue_exists": "The articles mostly align that the topic represents a real public problem or pressure point.",
            "cause": "They differ most in diagnosis: " + frame_sentence + ".",
            "responsible_actors": "Each article foregrounds different responsible actors or causes rather than a single shared culprit.",
            "implied_solutions": "The implied solutions follow the diagnosis: address construction feasibility, policy costs, measurement, or the specific barrier each article emphasizes.",
            "evidence_used": "The sources rely on different evidence types, including article-specific facts, headline framing, quoted actors, and emphasized policy or economic details.",
        },
        final_biasbuster_insight=(
            f"BiasBuster does not find that the articles mainly differ on whether {topic} matters. "
            "They differ in where readers are encouraged to look for the root cause. "
            "Comparing them makes the policy paths and evidence choices visible instead of leaving each article's frame implicit."
        ),
        source_specific_facts=specific,
        conflicting_claims=[],
        framing_differences=[
            {
                "source": a.source,
                "frame_label": frames[a.source],
                "tone": a.tone.overall,
                "note": a.summary,
            }
            for a in analyses
        ],
        headline_comparison=[
            {"source": a.source, "headline": a.headline, "tone": a.tone.overall}
            for a in analyses
        ],
        blame_credit_map=[
            {"source": a.source, **item.model_dump()} for a in analyses for item in a.blame_or_credit
        ],
        coverage_gaps=[
            "Some underemphasis points are inferred from article focus and should be treated as possible gaps, not proven omissions.",
            "Manual review is recommended before using this analysis for research or publication conclusions.",
        ],
    )


async def compare_project(topic: str, analyses: list[ArticleAnalysis]) -> ProjectComparison:
    if CLIENT:
        payload = json.dumps([a.model_dump() for a in analyses], ensure_ascii=False)
        prompt = COMPARISON_PROMPT.format(topic=topic, analyses=payload[:18000])
        for _ in range(2):
            try:
                return ProjectComparison.model_validate(await _call_json(COMPARISON_SYSTEM, prompt))
            except (APIError, RuntimeError, ValidationError, json.JSONDecodeError):
                prompt += "\n\nPrevious output was invalid. Return valid JSON only."
    return _heuristic_comparison(topic, analyses)
