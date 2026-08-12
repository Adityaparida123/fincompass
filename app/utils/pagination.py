"""Pagination helpers."""

from collections.abc import Sequence

from fastapi import Query

from app.schemas.common import Page


def pagination_params(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=200),
) -> tuple[int, int]:
    return page, page_size


def paginate(items: Sequence, total: int, page: int, page_size: int) -> Page:
    return Page(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        has_next=(page * page_size) < total,
    )
