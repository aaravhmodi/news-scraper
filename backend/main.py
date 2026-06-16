from __future__ import annotations

from typing import Any

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse

load_dotenv()

from backend.analysis.llm import analyze_article, compare_project
from backend.database import db
from backend.extractors.article_extractor import extract_article
from backend.schemas import ArticleAnalysis, ManualArticleUpdate, ProjectCreate


import os as _os

_extra_origins = [o.strip() for o in _os.getenv("CORS_ORIGINS", "").split(",") if o.strip()]
_origins = ["http://localhost:3000", "http://127.0.0.1:3000"] + _extra_origins

app = FastAPI(title="BiasBuster API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup() -> None:
    db.init_db()


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


async def _process_article(article_id: str, url: str, manual_text: str | None) -> None:
    extracted = await extract_article(url, manual_text)
    db.update_article(
        article_id,
        headline=extracted.headline,
        source_name=extracted.source_name,
        author=extracted.author,
        published_at=extracted.published_at,
        raw_text=extracted.raw_text,
        extraction_status=extracted.extraction_status,
    )
    if extracted.raw_text and len(extracted.raw_text) >= 100:
        analysis = await analyze_article(extracted.source_name, extracted.headline, extracted.raw_text)
        db.save_analysis(article_id, analysis.model_dump())


async def _ensure_rich_comparison(project: dict[str, Any]) -> dict[str, Any]:
    comparison = project.get("comparison") or {}
    if comparison.get("executive_insight") and comparison.get("framing_comparison_table"):
        return project

    valid_analyses = [a["analysis"] for a in project["articles"] if a.get("analysis")]
    if not valid_analyses:
        return project

    regenerated = await compare_project(
        project["topic"],
        [ArticleAnalysis.model_validate(item) for item in valid_analyses],
    )
    db.save_comparison(project["id"], regenerated.model_dump())
    return db.fetch_project(project["id"]) or project


@app.post("/projects")
async def create_project(payload: ProjectCreate) -> dict[str, Any]:
    project_id = db.insert_project(payload.topic)
    for article in payload.articles:
        article_id = db.insert_article(project_id, str(article.url), article.manual_text)
        await _process_article(article_id, str(article.url), article.manual_text)

    project = db.fetch_project(project_id)
    if not project:
        raise HTTPException(status_code=500, detail="Project was not created")
    valid_analyses = [a["analysis"] for a in project["articles"] if a.get("analysis")]
    if valid_analyses:
        comparison = await compare_project(
            payload.topic,
            [ArticleAnalysis.model_validate(item) for item in valid_analyses],
        )
        db.save_comparison(project_id, comparison.model_dump())
    return db.fetch_project(project_id) or project


@app.get("/projects/{project_id}")
async def get_project(project_id: str) -> dict[str, Any]:
    project = db.fetch_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return await _ensure_rich_comparison(project)


@app.post("/articles/{article_id}/manual")
async def update_manual_article(article_id: str, payload: ManualArticleUpdate) -> dict[str, str]:
    db.update_article(
        article_id,
        headline=payload.headline or "Manual article text",
        source_name=payload.source_name or "Manual source",
        raw_text=payload.raw_text,
        extraction_status="manual",
    )
    analysis = await analyze_article(
        payload.source_name or "Manual source",
        payload.headline or "Manual article text",
        payload.raw_text,
    )
    db.save_analysis(article_id, analysis.model_dump())
    return {"status": "saved"}


@app.get("/projects/{project_id}/export.md", response_class=PlainTextResponse)
async def export_project(project_id: str) -> str:
    project = db.fetch_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    project = await _ensure_rich_comparison(project)
    comparison = project.get("comparison") or {}
    def bullet_list(items: list[str]) -> list[str]:
        return [f"- {item}" for item in items] or ["- None identified."]

    def table(headers: list[str], rows: list[list[str]]) -> list[str]:
        if not rows:
            return ["No rows generated."]
        output = [
            "| " + " | ".join(headers) + " |",
            "| " + " | ".join("---" for _ in headers) + " |",
        ]
        for row in rows:
            output.append("| " + " | ".join((cell or "n/a").replace("|", "\\|").replace("\n", " ") for cell in row) + " |")
        return output

    lines = [
        f"# BiasBuster Report: {project['topic']}",
        "",
        "## Disclaimer",
        "",
        "BiasBuster analyzes framing patterns in the provided articles. It does not determine absolute truth or rate the moral value of any outlet.",
        "",
        "## Executive Insight",
        "",
        comparison.get("executive_insight", "No executive insight generated."),
        "",
        "## Neutral Summary",
        "",
        comparison.get("neutral_event_summary", "No comparison generated yet."),
        "",
        "## Shared Facts",
    ]
    lines += bullet_list(comparison.get("shared_facts", []))
    lines += [
        "",
        "## Framing Comparison Table",
        "",
    ]
    lines += table(
        ["Source", "Main Frame", "Core Claim", "Responsible Actor / Cause", "Implied Solution", "Evidence Used", "Confidence"],
        [
            [
                row.get("source", ""),
                row.get("main_frame", ""),
                row.get("core_claim", ""),
                row.get("responsible_actor_or_cause", ""),
                row.get("implied_solution", ""),
                row.get("evidence_used", ""),
                row.get("confidence", ""),
            ]
            for row in comparison.get("framing_comparison_table", [])
        ],
    )
    lines += ["", "## Headline Framing Analysis", ""]
    for row in comparison.get("headline_framing_analysis", []):
        lines += [
            f"### {row.get('source', 'Unknown source')}",
            "",
            f"- Headline: {row.get('headline', 'Untitled')}",
            f"- Key framing words: {', '.join(row.get('key_framing_words', [])) or 'None identified.'}",
            f"- Effect: {row.get('effect', 'n/a')}",
            f"- Reader focus: {row.get('reader_focus', 'n/a')}",
            f"- Confidence: {row.get('confidence', 'n/a')}",
            "",
        ]
    lines += ["## Loaded Language and Word Choice", ""]
    lines += table(
        ["Phrase", "Source", "Framing Effect", "Confidence"],
        [
            [
                row.get("phrase", ""),
                row.get("source", ""),
                row.get("framing_effect", ""),
                row.get("confidence", ""),
            ]
            for row in comparison.get("loaded_language", [])
        ],
    )
    lines += ["", "## Source-by-Source Analysis", ""]
    for row in comparison.get("source_by_source_analysis", []):
        lines += [
            f"### {row.get('source', 'Unknown source')}",
            "",
            f"- Main frame: {row.get('main_frame', 'n/a')}",
            f"- Tone: {row.get('tone', 'n/a')}",
            f"- Central claim: {row.get('central_claim', 'n/a')}",
            f"- Implied solution: {row.get('implied_solution', 'n/a')}",
            f"- Confidence: {row.get('confidence', 'n/a')}",
            "",
            "Supporting evidence:",
        ]
        lines += bullet_list(row.get("supporting_evidence", []))
        lines += ["", "Blame / credit:"]
        lines += bullet_list(row.get("blamed_or_credited", []))
        lines += ["", "Notable wording:"]
        lines += bullet_list(row.get("notable_wording", []))
        lines += [""]
    lines += ["## Emphasis vs Underemphasis", ""]
    for row in comparison.get("emphasis_underemphasis", []):
        lines += [f"### {row.get('source', 'Unknown source')}", "", "Emphasizes:"]
        lines += bullet_list(row.get("emphasizes", []))
        lines += ["", "May underemphasize:"]
        lines += bullet_list(row.get("may_underemphasize", []))
        lines += [""]
    diagnosis = comparison.get("cross_source_diagnosis", {}) or {}
    lines += [
        "## Cross-Source Diagnosis",
        "",
        f"- Whether the issue exists: {diagnosis.get('issue_exists', 'n/a')}",
        f"- What caused it: {diagnosis.get('cause', 'n/a')}",
        f"- Who is responsible: {diagnosis.get('responsible_actors', 'n/a')}",
        f"- Best solution implied: {diagnosis.get('implied_solutions', 'n/a')}",
        f"- Evidence used: {diagnosis.get('evidence_used', 'n/a')}",
        "",
        "## Final BiasBuster Insight",
        "",
        comparison.get("final_biasbuster_insight", "No final insight generated."),
        "",
        "## Article Details",
    ]
    for article in project["articles"]:
        analysis = article.get("analysis") or {}
        lines += [
            "",
            f"### {article.get('source_name') or 'Unknown source'}",
            f"- URL: {article['url']}",
            f"- Headline: {article.get('headline') or 'Untitled'}",
            f"- Extraction: {article.get('extraction_status')}",
            f"- Tone: {(analysis.get('tone') or {}).get('overall', 'n/a')}",
            f"- Frame: {analysis.get('frame_label', 'n/a')}",
            "",
            analysis.get("summary", "No analysis available."),
        ]
    return "\n".join(lines)
