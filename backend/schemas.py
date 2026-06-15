from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field, HttpUrl


FrameLabel = Literal[
    "economic",
    "moral",
    "conflict",
    "responsibility",
    "human impact",
    "policy",
    "security",
    "uncertainty",
]

# Bias taxonomy from systematic review (Rodrigo-Ginés et al., 2024)
BiasType = Literal[
    "coverage bias",      # over/under-representing certain topics or perspectives
    "gatekeeping bias",   # selection of which stories or facts get included
    "statement bias",     # how claims are worded — word choice, framing of facts
    "spin bias",          # positive or negative spin applied to the same event
    "ideology bias",      # alignment with a political or ideological worldview
]


class ArticleInput(BaseModel):
    url: HttpUrl | str
    manual_text: str | None = None


class ProjectCreate(BaseModel):
    topic: str = Field(min_length=3, max_length=240)
    articles: list[ArticleInput] = Field(min_length=3, max_length=10)


class Tone(BaseModel):
    overall: str
    score: float = Field(ge=-1.0, le=1.0)


class PhraseEffect(BaseModel):
    phrase: str
    effect: str


class LoadedWord(BaseModel):
    word: str
    reason: str


class BlameCredit(BaseModel):
    entity: str
    role: Literal["blamed", "credited", "defended"]
    evidence: str


class QuotedSource(BaseModel):
    name: str
    affiliation: str = ""
    quote_count: int = 1
    stance: Literal["supportive", "critical", "neutral", "mixed"] = "neutral"


class DetectedBias(BaseModel):
    bias_type: BiasType
    evidence: str
    confidence: Literal["high", "medium", "low"] = "medium"


class ArticleAnalysis(BaseModel):
    source: str
    headline: str
    summary: str
    tone: Tone
    emotional_intensity: float = Field(ge=0.0, le=1.0)
    emotional_language: list[PhraseEffect]
    loaded_words: list[LoadedWord]
    main_claims: list[str]
    blame_or_credit: list[BlameCredit]
    emphasized_facts: list[str]
    possibly_omitted_context: list[str]
    frame_label: FrameLabel
    quoted_sources: list[QuotedSource] = Field(default_factory=list)
    detected_biases: list[DetectedBias] = Field(default_factory=list)
    spin_direction: Literal["positive", "negative", "neutral", "mixed"] = "neutral"


class FramingComparisonRow(BaseModel):
    source: str
    headline: str = ""
    main_frame: str
    core_claim: str
    responsible_actor_or_cause: str
    implied_solution: str
    evidence_used: str
    confidence: Literal["high", "medium", "low"] = "medium"


class HeadlineFraming(BaseModel):
    source: str
    headline: str
    key_framing_words: list[str] = []
    effect: str
    reader_focus: str
    confidence: Literal["high", "medium", "low"] = "medium"


class LoadedLanguageItem(BaseModel):
    phrase: str
    source: str
    framing_effect: str
    confidence: Literal["high", "medium", "low"] = "medium"


class SourceFramingAnalysis(BaseModel):
    source: str
    main_frame: str
    tone: str
    central_claim: str
    supporting_evidence: list[str] = []
    blamed_or_credited: list[str] = []
    implied_solution: str
    notable_wording: list[str] = []
    confidence: Literal["high", "medium", "low"] = "medium"


class EmphasisUnderemphasis(BaseModel):
    source: str
    emphasizes: list[str] = []
    may_underemphasize: list[str] = []
    confidence: Literal["high", "medium", "low"] = "medium"


class CrossSourceDiagnosis(BaseModel):
    issue_exists: str = ""
    cause: str = ""
    responsible_actors: str = ""
    implied_solutions: str = ""
    evidence_used: str = ""


class ProjectComparison(BaseModel):
    neutral_event_summary: str
    shared_facts: list[str] = []
    executive_insight: str = ""
    framing_comparison_table: list[FramingComparisonRow] = []
    headline_framing_analysis: list[HeadlineFraming] = []
    loaded_language: list[LoadedLanguageItem] = []
    source_by_source_analysis: list[SourceFramingAnalysis] = []
    emphasis_underemphasis: list[EmphasisUnderemphasis] = []
    cross_source_diagnosis: CrossSourceDiagnosis = Field(default_factory=CrossSourceDiagnosis)
    final_biasbuster_insight: str = ""
    source_specific_facts: list[dict[str, Any]] = []
    conflicting_claims: list[dict[str, Any]] = []
    framing_differences: list[dict[str, Any]] = []
    headline_comparison: list[dict[str, Any]] = []
    blame_credit_map: list[dict[str, Any]] = []
    coverage_gaps: list[str] = []


class ManualArticleUpdate(BaseModel):
    headline: str | None = None
    source_name: str | None = None
    raw_text: str = Field(min_length=100)


class ProjectRecord(BaseModel):
    id: str
    topic: str
    created_at: datetime
    articles: list[dict[str, Any]]
    comparison: dict[str, Any] | None = None
