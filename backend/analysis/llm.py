from __future__ import annotations

import json
import os
import re
from collections import Counter, defaultdict
from typing import Any

from openai import AsyncOpenAI
from pydantic import ValidationError

from backend.schemas import ArticleAnalysis, ProjectComparison


MODEL = os.getenv("OPENAI_MODEL", "gpt-4.1-mini")
CLIENT = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY")) if os.getenv("OPENAI_API_KEY") else None

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


ARTICLE_SYSTEM = """You analyze news framing, not factual truth. Return only valid JSON matching the requested schema.
Do not label outlets as left/right. Do not decide who is correct unless directly supported by the provided article.
Mark omitted context as possible, not certain. Keep evidence grounded in the article text."""


COMPARISON_SYSTEM = """You compare framing across provided article analyses. Return only valid JSON.
Write a neutral event summary using facts supported by multiple provided articles or clearly attributed claims.
Do not make unsupported claims about publishers or declare a side morally correct."""


ARTICLE_PROMPT = """Analyze this article for framing.

Source: {source}
Headline: {headline}
Text:
{text}

Return JSON with:
source, headline, summary, tone {{overall, score}}, emotional_intensity,
emotional_language [{{phrase,effect}}],
loaded_words [{{word,reason}}],
main_claims [],
blame_or_credit [{{entity, role: blamed|credited|defended, evidence}}],
emphasized_facts [],
possibly_omitted_context [],
frame_label: one of economic, moral, conflict, responsibility, human impact, policy, security, uncertainty."""


COMPARISON_PROMPT = """Compare these article analyses for the same topic: {topic}

Analyses:
{analyses}

Return JSON with:
neutral_event_summary, shared_facts, source_specific_facts, conflicting_claims,
framing_differences, headline_comparison, blame_credit_map, coverage_gaps."""


def _json_from_text(text: str) -> dict[str, Any]:
    cleaned = text.strip()
    cleaned = re.sub(r"^```(?:json)?", "", cleaned).strip()
    cleaned = re.sub(r"```$", "", cleaned).strip()
    return json.loads(cleaned)


async def _call_json(system: str, prompt: str) -> dict[str, Any]:
    if not CLIENT:
        raise RuntimeError("OPENAI_API_KEY is not configured")
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
    )


async def analyze_article(source: str, headline: str, text: str) -> ArticleAnalysis:
    if CLIENT:
        prompt = ARTICLE_PROMPT.format(source=source, headline=headline, text=text[:14000])
        for _ in range(2):
            try:
                return ArticleAnalysis.model_validate(await _call_json(ARTICLE_SYSTEM, prompt))
            except (ValidationError, json.JSONDecodeError):
                prompt += "\n\nPrevious output was invalid. Return valid JSON only."
    return _heuristic_article(source, headline, text)


def _fact_key(fact: str) -> str:
    words = re.findall(r"[a-zA-Z]{4,}", fact.lower())
    return " ".join(words[:8])


def _heuristic_comparison(topic: str, analyses: list[ArticleAnalysis]) -> ProjectComparison:
    fact_sources: dict[str, list[str]] = defaultdict(list)
    fact_text: dict[str, str] = {}
    for analysis in analyses:
        for fact in analysis.emphasized_facts:
            key = _fact_key(fact)
            if key:
                fact_sources[key].append(analysis.source)
                fact_text[key] = fact

    shared = [fact_text[k] for k, sources in fact_sources.items() if len(set(sources)) > 1][:8]
    specific = [
        {"source": sources[0], "fact": fact_text[k]}
        for k, sources in fact_sources.items()
        if len(set(sources)) == 1
    ][:10]

    return ProjectComparison(
        neutral_event_summary=(
            f"Coverage about {topic} describes the same broad event through different source emphases. "
            "The shared summary is limited to claims present in the supplied articles; disputed or single-source details are separated below."
        ),
        shared_facts=shared,
        source_specific_facts=specific,
        conflicting_claims=[],
        framing_differences=[
            {
                "source": a.source,
                "frame_label": a.frame_label,
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
            "Some context points are inferred from article focus and should be treated as possible gaps, not proven omissions.",
            "Manual review is recommended before using this analysis for research conclusions.",
        ],
    )


async def compare_project(topic: str, analyses: list[ArticleAnalysis]) -> ProjectComparison:
    if CLIENT:
        payload = json.dumps([a.model_dump() for a in analyses], ensure_ascii=False)
        prompt = COMPARISON_PROMPT.format(topic=topic, analyses=payload[:18000])
        for _ in range(2):
            try:
                return ProjectComparison.model_validate(await _call_json(COMPARISON_SYSTEM, prompt))
            except (ValidationError, json.JSONDecodeError):
                prompt += "\n\nPrevious output was invalid. Return valid JSON only."
    return _heuristic_comparison(topic, analyses)
