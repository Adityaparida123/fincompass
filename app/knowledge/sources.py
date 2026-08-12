"""Source metadata registry for financial reference material.

Always prefer verified, official, current sources. Never invent URLs.
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class SourceInfo:
    name: str
    jurisdiction: str
    url: str | None = None


OFFICIAL_SOURCES: dict[str, SourceInfo] = {
    "india": SourceInfo("Government of India", "IN", "https://www.india.gov.in/"),
    "rbi": SourceInfo("Reserve Bank of India", "IN", "https://www.rbi.org.in/"),
    "sebi": SourceInfo("SEBI", "IN", "https://www.sebi.gov.in/"),
    "irdai": SourceInfo("IRDAI", "IN", "https://www.irdai.gov.in/"),
    "income_tax": SourceInfo("Income Tax Department, India", "IN", "https://www.incometax.gov.in/"),
    "epfo": SourceInfo("EPFO", "IN", "https://www.epfindia.gov.in/"),
    "pfrda": SourceInfo("PFRDA (NPS)", "IN", "https://www.pfrda.org.in/"),
    "msme": SourceInfo("MSME Ministry", "IN", "https://msme.gov.in/"),
    "pib": SourceInfo("Press Information Bureau", "IN", "https://pib.gov.in/"),
}
