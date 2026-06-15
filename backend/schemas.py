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


class ProjectComparison(BaseModel):
    neutral_event_summary: str
    shared_facts: list[str]
    source_specific_facts: list[dict[str, Any]]
    conflicting_claims: list[dict[str, Any]]
    framing_differences: list[dict[str, Any]]
    headline_comparison: list[dict[str, Any]]
    blame_credit_map: list[dict[str, Any]]
    coverage_gaps: list[str]


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
