from __future__ import annotations

from dataclasses import dataclass
from urllib.parse import urlparse

import httpx
from bs4 import BeautifulSoup

try:
    import trafilatura
except ImportError:  # pragma: no cover
    trafilatura = None


@dataclass
class ExtractedArticle:
    headline: str
    source_name: str
    author: str | None
    published_at: str | None
    raw_text: str
    extraction_status: str


def _domain(url: str) -> str:
    host = urlparse(url).netloc.replace("www.", "")
    return host or "Manual source"


def _meta(soup: BeautifulSoup, *names: str) -> str | None:
    for name in names:
        tag = soup.find("meta", attrs={"property": name}) or soup.find("meta", attrs={"name": name})
        if tag and tag.get("content"):
            return str(tag["content"]).strip()
    return None


async def extract_article(url: str, manual_text: str | None = None) -> ExtractedArticle:
    if manual_text and manual_text.strip():
        return ExtractedArticle(
            headline="Manual article text",
            source_name=_domain(url),
            author=None,
            published_at=None,
            raw_text=manual_text.strip(),
            extraction_status="manual",
        )

    try:
        async with httpx.AsyncClient(timeout=20, follow_redirects=True) as client:
            response = await client.get(url, headers={"User-Agent": "BiasBuster/0.1"})
            response.raise_for_status()
        html = response.text
        soup = BeautifulSoup(html, "html.parser")
        headline = (
            _meta(soup, "og:title", "twitter:title")
            or (soup.title.string.strip() if soup.title and soup.title.string else "")
        )
        author = _meta(soup, "author", "article:author")
        published_at = _meta(soup, "article:published_time", "date", "pubdate")
        text = ""
        if trafilatura:
            text = trafilatura.extract(html, include_comments=False, include_tables=False) or ""
        if not text:
            paragraphs = [p.get_text(" ", strip=True) for p in soup.find_all("p")]
            text = "\n\n".join(p for p in paragraphs if len(p) > 40)
        status = "success" if len(text) >= 250 else "failed"
        return ExtractedArticle(
            headline=headline or "Untitled article",
            source_name=_domain(url),
            author=author,
            published_at=published_at,
            raw_text=text,
            extraction_status=status,
        )
    except Exception:
        return ExtractedArticle(
            headline="Extraction failed",
            source_name=_domain(url),
            author=None,
            published_at=None,
            raw_text="",
            extraction_status="failed",
        )
