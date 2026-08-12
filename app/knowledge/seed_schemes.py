"""Seed reference data for well-known public schemes.

These entries are used ONLY for heuristic "potential eligibility" matching.
FinAI never claims official approval or guaranteed eligibility. Eligibility
must always be verified with the official source.

All URLs are official government portals.
"""

from datetime import date

SEED_SCHEMES: list[dict] = [
    {
        "name": "Pradhan Mantri Jan Dhan Yojana (PMJDY)",
        "description": (
            "National mission for financial inclusion providing a basic bank account, "
            "RuPay debit card, and accidental insurance cover."
        ),
        "jurisdiction": "IN",
        "eligibility": (
            "Any Indian resident aged 18 years and above, without an existing bank account, "
            "is eligible. No minimum balance required."
        ),
        "benefits": "Zero-balance bank account, RuPay debit card, accidental insurance cover, direct benefit transfers.",
        "source_url": "https://pmjdy.gov.in/",
        "last_verified": date(2026, 1, 1),
        "active": True,
        "income_ceiling": None,
        "category": "banking",
    },
    {
        "name": "PM-Kisan Samman Nidhi",
        "description": "Direct income support of ₹6,000 per year to eligible farmer families.",
        "jurisdiction": "IN",
        "eligibility": (
            "All landholding farmer families in India with cultivable land. Certain "
            "higher-income categories (institutional landholders, income-tax payers) are excluded."
        ),
        "benefits": "₹6,000 per year in three equal instalments transferred directly to bank accounts.",
        "source_url": "https://pmkisan.gov.in/",
        "last_verified": date(2026, 1, 1),
        "active": True,
        "income_ceiling": None,
        "category": "agriculture",
    },
    {
        "name": "Atal Pension Yojana (APY)",
        "description": "Guaranteed minimum pension scheme focused on the unorganised sector.",
        "jurisdiction": "IN",
        "eligibility": "Indian citizens aged 18 to 40 years, with a savings bank account.",
        "benefits": "Guaranteed monthly pension of ₹1,000 to ₹5,000 from age 60.",
        "source_url": "https://npscra.nsdl.co.in/content/atal-pension-yojana.php",
        "last_verified": date(2026, 1, 1),
        "active": True,
        "income_ceiling": None,
        "category": "pension",
    },
    {
        "name": "Pradhan Mantri Mudra Yojana (PMMY)",
        "description": "Loans up to ₹10 lakh to non-corporate micro enterprises.",
        "jurisdiction": "IN",
        "eligibility": (
            "Individuals, proprietorships, and micro enterprises in non-farm income generating "
            "activities. No collateral for Shishu (up to ₹50,000) and Kishore (up to ₹5 lakh) categories."
        ),
        "benefits": "Collateral-free institutional credit for micro enterprises in three tiers.",
        "source_url": "https://www.mudra.org.in/",
        "last_verified": date(2026, 1, 1),
        "active": True,
        "income_ceiling": None,
        "category": "business",
    },
    {
        "name": "Sukanya Samriddhi Yojana (SSY)",
        "description": "Small savings scheme for the girl child, opened in the name of a girl below 10 years.",
        "jurisdiction": "IN",
        "eligibility": "A guardian may open the account for a girl child below 10 years, one account per girl.",
        "benefits": "High interest small savings scheme with tax benefits under Section 80C.",
        "source_url": "https://www.indiapost.gov.in/FinancialServices/Pages/content/Sukanya-Samriddhi-Account.aspx",
        "last_verified": date(2026, 1, 1),
        "active": True,
        "income_ceiling": None,
        "category": "savings",
    },
    {
        "name": "Pradhan Mantri Awas Yojana - Gramin (PMAY-G)",
        "description": "Housing assistance for eligible rural households without a pucca house.",
        "jurisdiction": "IN",
        "eligibility": (
            "Households without a pucca house, identified through the Socio-Economic Caste "
            "Census (SECC) and verified by Gram Sabha."
        ),
        "benefits": "Financial assistance toward construction of a pucca house with basic amenities.",
        "source_url": "https://pmayg.nic.in/",
        "last_verified": date(2026, 1, 1),
        "active": True,
        "income_ceiling": None,
        "category": "housing",
    },
    {
        "name": "Stand Up India",
        "description": "Loans between ₹10 lakh and ₹1 crore for SC/ST and women entrepreneurs.",
        "jurisdiction": "IN",
        "eligibility": (
            "SC/ST and/or women entrepreneurs establishing greenfield enterprises in manufacturing, "
            "services, or trading."
        ),
        "benefits": "Composite loan for greenfield enterprise with repayment up to 7 years.",
        "source_url": "https://www.standupmitra.in/",
        "last_verified": date(2026, 1, 1),
        "active": True,
        "income_ceiling": None,
        "category": "business",
    },
    {
        "name": "Senior Citizens Savings Scheme (SCSS)",
        "description": "Government-backed savings scheme for senior citizens.",
        "jurisdiction": "IN",
        "eligibility": "Indian residents aged 60 years and above (55+ for certain retired persons).",
        "benefits": "Regular quarterly interest payout on a safe government-backed deposit.",
        "source_url": "https://www.indiapost.gov.in/FinancialServices/Pages/content/Senior-Citizens-Savings-Scheme.aspx",
        "last_verified": date(2026, 1, 1),
        "active": True,
        "income_ceiling": None,
        "category": "savings",
    },
    {
        "name": "Mahila Samman Savings Certificate",
        "description": "One-time small savings scheme launched for women and girls.",
        "jurisdiction": "IN",
        "eligibility": "Women and girls of Indian nationality, up to ₹2 lakh, for two years.",
        "benefits": "Fixed rate of interest for two years with deposit facility up to ₹2 lakh.",
        "source_url": "https://www.indiapost.gov.in/",
        "last_verified": date(2026, 1, 1),
        "active": True,
        "income_ceiling": None,
        "category": "savings",
    },
    {
        "name": "National Pension System (NPS) - All Citizen Model",
        "description": "Voluntary long-term retirement savings scheme regulated by PFRDA.",
        "jurisdiction": "IN",
        "eligibility": "Any Indian citizen aged 18-65 years can subscribe voluntarily.",
        "benefits": "Market-linked retirement savings with tax benefits under Section 80CCD.",
        "source_url": "https://www.pfrda.org.in/",
        "last_verified": date(2026, 1, 1),
        "active": True,
        "income_ceiling": None,
        "category": "pension",
    },
]
