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
from backend.schemas import ManualArticleUpdate, ProjectCreate


app = FastAPI(title="BiasBuster API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
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
        from backend.schemas import ArticleAnalysis

        comparison = await compare_project(
            payload.topic,
            [ArticleAnalysis.model_validate(item) for item in valid_analyses],
        )
        db.save_comparison(project_id, comparison.model_dump())
    return db.fetch_project(project_id) or project


@app.get("/projects/{project_id}")
def get_project(project_id: str) -> dict[str, Any]:
    project = db.fetch_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


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
def export_project(project_id: str) -> str:
    project = db.fetch_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    comparison = project.get("comparison") or {}
    lines = [
        f"# BiasBuster Report: {project['topic']}",
        "",
        "> BiasBuster analyzes framing patterns in the provided articles. It does not determine absolute truth or rate the moral value of any outlet.",
        "",
        "## Neutral Summary",
        comparison.get("neutral_event_summary", "No comparison generated yet."),
        "",
        "## Shared Facts",
    ]
    lines += [f"- {fact}" for fact in comparison.get("shared_facts", [])] or ["- None identified."]
    lines += ["", "## Articles"]
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
