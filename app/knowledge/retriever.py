"""Simple local retrieval over the knowledge base.

Keyword-based scoring over title, topic, and keywords. Designed to be
replaced later by pgvector semantic search while keeping the same interface.
"""

from functools import lru_cache

from app.knowledge.loader import KnowledgeDoc, load_all


@lru_cache(maxsize=1)
def _docs() -> list[KnowledgeDoc]:
    return load_all()


def retrieve(query: str, *, top_k: int = 3) -> list[KnowledgeDoc]:
    query_lower = query.lower()
    terms = [t for t in query_lower.replace("?", "").split() if len(t) > 2]

    scored: list[tuple[int, KnowledgeDoc]] = []
    for doc in _docs():
        score = 0
        haystack = f"{doc.title} {doc.topic} {' '.join(doc.keywords)} {doc.content[:2000]}".lower()
        for term in terms:
            if term in haystack:
                score += 1
        if any(k in query_lower for k in doc.keywords):
            score += 2
        if score > 0:
            scored.append((score, doc))
    scored.sort(key=lambda item: item[0], reverse=True)
    return [doc for _score, doc in scored[:top_k]]


def doc_to_context(doc: KnowledgeDoc) -> str:
    return (
        f"[{doc.title} | {doc.topic} | source: {doc.source}"
        + (f" | url: {doc.source_url}" if doc.source_url else "")
        + f" | last verified: {doc.last_verified or 'unknown'}"
        + f" | jurisdiction: {doc.jurisdiction}]\n{doc.content}"
    )
