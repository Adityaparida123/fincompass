"""Knowledge retrieval abstraction (keyword today, pgvector-ready)."""

from abc import ABC, abstractmethod

from app.knowledge import retriever as keyword_retriever
from app.knowledge.loader import KnowledgeDoc


class KnowledgeRetriever(ABC):
    @abstractmethod
    def search(self, query: str, *, top_k: int = 3) -> list[KnowledgeDoc]:
        ...


class KeywordKnowledgeRetriever(KnowledgeRetriever):
    def search(self, query: str, *, top_k: int = 3) -> list[KnowledgeDoc]:
        return keyword_retriever.retrieve(query, top_k=top_k)


def get_knowledge_retriever() -> KnowledgeRetriever:
    return KeywordKnowledgeRetriever()


def format_docs_for_context(docs: list[KnowledgeDoc]) -> str:
    if not docs:
        return ""
    blocks = [keyword_retriever.doc_to_context(doc) for doc in docs]
    return "\n\n---\n\n".join(blocks)
