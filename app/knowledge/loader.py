"""Load knowledge documents from local markdown files.

Each document carries source metadata (source, source_url, published_at,
last_verified, jurisdiction) read from a YAML-ish front matter block when
present, or defaults otherwise.
"""

import os
from dataclasses import dataclass, field

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)


@dataclass
class KnowledgeDoc:
    title: str
    content: str
    topic: str
    source: str = "FinAI Knowledge Base"
    source_url: str | None = None
    published_at: str | None = None
    last_verified: str | None = None
    jurisdiction: str = "IN"
    keywords: list[str] = field(default_factory=list)


def _parse_front_matter(text: str) -> tuple[dict[str, str], str]:
    if not text.startswith("---\n"):
        return {}, text
    parts = text.split("---\n", 2)
    if len(parts) < 3:
        return {}, text
    meta: dict[str, str] = {}
    for line in parts[1].strip().splitlines():
        if ":" in line:
            key, _, value = line.partition(":")
            meta[key.strip()] = value.strip()
    return meta, parts[2]


def _load_file(path: str) -> KnowledgeDoc | None:
    topic = os.path.basename(os.path.dirname(path))
    try:
        with open(path, encoding="utf-8") as fh:
            raw = fh.read()
    except OSError:
        return None
    meta, body = _parse_front_matter(raw)
    title = meta.get("title") or os.path.splitext(os.path.basename(path))[0].replace("_", " ").title()
    keywords = [k.strip().lower() for k in meta.get("keywords", "").split(",") if k.strip()]
    return KnowledgeDoc(
        title=title,
        content=body.strip(),
        topic=topic,
        source=meta.get("source", "FinAI Knowledge Base"),
        source_url=meta.get("source_url"),
        published_at=meta.get("published_at"),
        last_verified=meta.get("last_verified"),
        jurisdiction=meta.get("jurisdiction", "IN"),
        keywords=keywords,
    )


def load_all() -> list[KnowledgeDoc]:
    base_dir = settings.KNOWLEDGE_BASE_DIR
    docs: list[KnowledgeDoc] = []
    if not os.path.isdir(base_dir):
        logger.warning("Knowledge base directory not found: %s", base_dir)
        return docs
    for root, _dirs, files in os.walk(base_dir):
        for name in sorted(files):
            if not name.lower().endswith((".md", ".txt")):
                continue
            doc = _load_file(os.path.join(root, name))
            if doc:
                docs.append(doc)
    return docs
