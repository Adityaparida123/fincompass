"""MongoDB storage facade for the FinAI backend.

Runtime persistence uses MongoDB (Atlas in production). The facade is
driver-agnostic: production uses the async PyMongo driver
(``pymongo.asynchronous``); tests inject a mongomock-backed database so the
suite runs without a real MongoDB instance.

Design notes:
- Integer API IDs are preserved via a ``counters`` collection (``_id`` is the
  collection name, ``seq`` is incremented atomically).
- Money is stored as BSON ``Decimal128``; the facade decodes to ``Decimal`` on
  read and encodes ``Decimal`` on write, so callers only ever see ``Decimal``.
- ``date`` values are stored as ISO-8601 strings (``YYYY-MM-DD``) so range
  queries and sorts remain lexicographically correct across drivers; callers
  that need arithmetic parse with ``date.fromisoformat``.
- Datetimes are stored as native BSON datetimes.
- Amount range comparisons are performed in Python (never ``$gte`` on money)
  because mongomock cannot compare ``Decimal128``.
"""

from __future__ import annotations

from collections.abc import AsyncGenerator
from datetime import UTC, date, datetime
from decimal import Decimal
from typing import Any

from bson import Decimal128
from pymongo import ReturnDocument

from app.core.config import settings


class Doc(dict):
    """dict subclass with attribute access.

    Routes and services keep the ``doc.field`` style they had with SQLAlchemy
    objects while the underlying data stays a plain mapping (so Pydantic
    ``model_validate`` works unchanged).
    """

    def __getattr__(self, item: str) -> Any:
        try:
            return self[item]
        except KeyError:
            raise AttributeError(item) from None

    def __setattr__(self, key: str, value: Any) -> None:
        self[key] = value


_MONEY_QUANT = Decimal("0.01")


def _to_decimal(value: Any) -> Decimal | None:
    if value is None:
        return None
    if isinstance(value, Decimal):
        return value
    if isinstance(value, Decimal128):
        return value.to_decimal().quantize(_MONEY_QUANT)
    return Decimal(str(value))


def _clean_value(value: Any) -> Any:
    """Convert query/filter values to driver-safe primitives."""
    if isinstance(value, dict):
        return {k: _clean_value(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_clean_value(v) for v in value]
    if isinstance(value, date) and not isinstance(value, datetime):
        return value.isoformat()
    return value


def _encode_value(value: Any) -> Any:
    if isinstance(value, Decimal):
        return Decimal128(value)
    if isinstance(value, dict):
        return {k: _encode_value(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_encode_value(v) for v in value]
    if isinstance(value, date) and not isinstance(value, datetime):
        return value.isoformat()
    return value


def _decode_value(value: Any) -> Any:
    if isinstance(value, Decimal128):
        # Money is stored as Decimal128; restore a fixed 2-dp scale on read so
        # serialization matches the legacy SQLAlchemy Numeric(scale=2) contract.
        return value.to_decimal().quantize(_MONEY_QUANT)
    if isinstance(value, dict):
        return {k: _decode_value(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_decode_value(v) for v in value]
    return value


class CollectionAdapter:
    """Uniform async collection interface shared by both drivers.

    Every method is a coroutine so ``MongoDatabase`` never branches on the
    underlying driver.
    """

    async def find_one(self, filt: dict | None) -> Any:  # pragma: no cover - interface
        raise NotImplementedError

    async def find(self, filt: dict | None, *, sort=None, limit: int | None, skip: int | None) -> list[dict]:  # pragma: no cover
        raise NotImplementedError

    async def insert_one(self, doc: dict) -> Any:  # pragma: no cover
        raise NotImplementedError

    async def update_one(self, filt: dict, update: dict) -> Any:  # pragma: no cover
        raise NotImplementedError

    async def update_many(self, filt: dict, update: dict) -> int:  # pragma: no cover
        raise NotImplementedError

    async def delete_one(self, filt: dict) -> Any:  # pragma: no cover
        raise NotImplementedError

    async def delete_many(self, filt: dict) -> int:  # pragma: no cover
        raise NotImplementedError

    async def count(self, filt: dict) -> int:  # pragma: no cover
        raise NotImplementedError

    async def find_one_and_update(self, filt: dict, update: dict, *, upsert: bool, return_after: bool) -> dict | None:  # pragma: no cover
        raise NotImplementedError

    async def create_index(self, keys, *, unique: bool = False) -> Any:  # pragma: no cover
        raise NotImplementedError


class PyMongoCollection(CollectionAdapter):
    def __init__(self, coll: Any):
        self._coll = coll

    async def find_one(self, filt: dict | None) -> Any:
        return await self._coll.find_one(filt)

    async def find(self, filt: dict | None, *, sort=None, limit: int | None, skip: int | None) -> list[dict]:
        cursor = self._coll.find(filt)
        if sort:
            cursor = cursor.sort(sort)
        if limit is not None:
            cursor = cursor.limit(limit)
        if skip:
            cursor = cursor.skip(skip)
        return [doc async for doc in cursor]

    async def insert_one(self, doc: dict) -> Any:
        return await self._coll.insert_one(doc)

    async def update_one(self, filt: dict, update: dict) -> Any:
        return await self._coll.update_one(filt, update)

    async def update_many(self, filt: dict, update: dict) -> int:
        result = await self._coll.update_many(filt, update)
        return result.modified_count

    async def delete_one(self, filt: dict) -> Any:
        return await self._coll.delete_one(filt)

    async def delete_many(self, filt: dict) -> int:
        result = await self._coll.delete_many(filt)
        return result.deleted_count

    async def count(self, filt: dict) -> int:
        return await self._coll.count_documents(filt)

    async def find_one_and_update(self, filt: dict, update: dict, *, upsert: bool, return_after: bool) -> dict | None:
        return await self._coll.find_one_and_update(
            filt,
            update,
            upsert=upsert,
            return_document=ReturnDocument.AFTER if return_after else ReturnDocument.BEFORE,
        )

    async def create_index(self, keys, *, unique: bool = False) -> Any:
        return await self._coll.create_index(keys, unique=unique)


class MongoMockCollection(CollectionAdapter):
    """Adapter over a synchronous mongomock collection."""

    def __init__(self, coll: Any):
        self._coll = coll

    async def find_one(self, filt: dict | None) -> Any:
        return self._coll.find_one(filt)

    async def find(self, filt: dict | None, *, sort=None, limit: int | None, skip: int | None) -> list[dict]:
        cursor = self._coll.find(filt)
        if sort:
            cursor = cursor.sort(sort)
        if limit is not None:
            cursor = cursor.limit(limit)
        if skip:
            cursor = cursor.skip(skip)
        return list(cursor)

    async def insert_one(self, doc: dict) -> Any:
        return self._coll.insert_one(doc)

    async def update_one(self, filt: dict, update: dict) -> Any:
        return self._coll.update_one(filt, update)

    async def update_many(self, filt: dict, update: dict) -> int:
        return self._coll.update_many(filt, update).modified_count

    async def delete_one(self, filt: dict) -> Any:
        return self._coll.delete_one(filt)

    async def delete_many(self, filt: dict) -> int:
        return self._coll.delete_many(filt).deleted_count

    async def count(self, filt: dict) -> int:
        return self._coll.count_documents(filt)

    async def find_one_and_update(self, filt: dict, update: dict, *, upsert: bool, return_after: bool) -> dict | None:
        return self._coll.find_one_and_update(
            filt,
            update,
            upsert=upsert,
            return_document=ReturnDocument.AFTER if return_after else ReturnDocument.BEFORE,
        )

    async def create_index(self, keys, *, unique: bool = False) -> Any:
        return self._coll.create_index(keys, unique=unique)


class MongoAdapter:
    """Driver backend: exposes collections and connection-level operations."""

    def coll(self, name: str) -> CollectionAdapter:  # pragma: no cover - interface
        raise NotImplementedError

    async def ping(self) -> bool:  # pragma: no cover
        raise NotImplementedError

    async def list_collection_names(self) -> list[str]:  # pragma: no cover
        raise NotImplementedError

    async def drop_collection(self, name: str) -> None:  # pragma: no cover
        raise NotImplementedError


class PyMongoBackend(MongoAdapter):
    def __init__(self, db: Any):
        self._db = db

    def coll(self, name: str) -> CollectionAdapter:
        return PyMongoCollection(self._db[name])

    async def ping(self) -> bool:
        try:
            await self._db.command({"ping": 1})
            return True
        except Exception:
            return False

    async def list_collection_names(self) -> list[str]:
        return await self._db.list_collection_names()

    async def drop_collection(self, name: str) -> None:
        await self._db.drop_collection(name)


class MongoMockBackend(MongoAdapter):
    def __init__(self, db: Any):
        self._db = db

    def coll(self, name: str) -> CollectionAdapter:
        return MongoMockCollection(self._db[name])

    async def ping(self) -> bool:
        try:
            self._db.command({"ping": 1})
            return True
        except Exception:
            return False

    async def list_collection_names(self) -> list[str]:
        return self._db.list_collection_names()

    async def drop_collection(self, name: str) -> None:
        self._db.drop_collection(name)


def mongo_backend_from_database(db: Any) -> MongoAdapter:
    """Build the correct backend based on the driver type."""
    from pymongo.asynchronous.database import AsyncDatabase

    if isinstance(db, AsyncDatabase):
        return PyMongoBackend(db)

    try:
        import mongomock  # dev-only dependency; never required in production
    except ModuleNotFoundError:
        mongomock = None
    if mongomock is not None and isinstance(db, mongomock.Database):
        return MongoMockBackend(db)
    raise TypeError(f"Unsupported database handle: {type(db)!r}")


class MongoDatabase:
    """High-level storage facade used as the ``db`` dependency."""

    def __init__(self, backend: MongoAdapter):
        self._backend = backend
        self._counters_cache: dict[str, int] = {}

    def _coll(self, name: str) -> CollectionAdapter:
        return self._backend.coll(name)

    async def next_id(self, name: str) -> int:
        """Atomically allocate the next integer ID for a collection."""
        doc = await self._coll("counters").find_one_and_update(
            {"_id": name},
            {"$inc": {"seq": 1}},
            upsert=True,
            return_after=True,
        )
        if doc is None:
            raise RuntimeError(f"Failed to allocate ID for collection '{name}'.")
        return int(doc["seq"])

    async def insert(self, name: str, doc: dict) -> Doc:
        """Insert a document, assigning integer ``_id``/``id`` and timestamps."""
        doc = dict(doc)
        _id = await self.next_id(name)
        doc["_id"] = _id
        doc["id"] = _id
        now = datetime.now(UTC)
        doc.setdefault("created_at", now)
        doc["updated_at"] = now
        await self._coll(name).insert_one(_encode_value(doc))
        return Doc(doc)

    async def insert_many(self, name: str, docs: list[dict]) -> list[Doc]:
        return [await self.insert(name, doc) for doc in docs]

    async def find_one(self, name: str, filt: dict | None = None) -> Doc | None:
        raw = await self._coll(name).find_one(_clean_value(filt))
        return Doc(_decode_value(raw)) if raw is not None else None

    async def find(
        self,
        name: str,
        filt: dict | None = None,
        *,
        sort=None,
        limit: int | None = None,
        skip: int | None = None,
    ) -> list[Doc]:
        raw = await self._coll(name).find(
            _clean_value(filt),
            sort=sort,
            limit=limit,
            skip=skip,
        )
        return [Doc(_decode_value(doc)) for doc in raw]

    async def count(self, name: str, filt: dict | None = None) -> int:
        return int(await self._coll(name).count(_clean_value(filt)))

    async def update_one(self, name: str, filt: dict, updates: dict) -> None:
        payload = dict(updates)
        payload["updated_at"] = datetime.now(UTC)
        await self._coll(name).update_one(_clean_value(filt), {"$set": _encode_value(payload)})

    async def update_many(self, name: str, filt: dict, updates: dict) -> int:
        payload = dict(updates)
        payload["updated_at"] = datetime.now(UTC)
        return int(await self._coll(name).update_many(_clean_value(filt), {"$set": _encode_value(payload)}))

    async def delete_one(self, name: str, filt: dict) -> None:
        await self._coll(name).delete_one(_clean_value(filt))

    async def delete_many(self, name: str, filt: dict) -> int:
        return int(await self._coll(name).delete_many(_clean_value(filt)))

    async def find_one_and_update(self, name: str, filt: dict, updates: dict) -> Doc | None:
        payload = dict(updates)
        payload["updated_at"] = datetime.now(UTC)
        raw = await self._coll(name).find_one_and_update(
            _clean_value(filt),
            {"$set": _encode_value(payload)},
            upsert=False,
            return_after=True,
        )
        return Doc(_decode_value(raw)) if raw is not None else None

    async def sum_field(self, name: str, filt: dict, field: str) -> Decimal:
        """Sum a monetary field over matching documents (Decimal-safe)."""
        total = Decimal("0")
        for doc in await self.find(name, filt):
            value = doc.get(field)
            if value is None:
                continue
            total += value if isinstance(value, Decimal) else Decimal(str(value))
        return total

    async def count_field(self, name: str, filt: dict, field: str) -> int:
        return sum(1 for doc in await self.find(name, filt) if doc.get(field) is not None)

    async def ping(self) -> bool:
        return await self._backend.ping()

    async def create_index(self, name: str, keys, *, unique: bool = False) -> Any:
        return await self._coll(name).create_index(keys, unique=unique)

    async def drop_collections(self) -> None:
        for name in await self._backend.list_collection_names():
            if name.startswith("system."):
                continue
            await self._backend.drop_collection(name)

    # SQLAlchemy-session compatibility shims (no-ops in MongoDB).
    async def commit(self) -> None:
        return None

    async def flush(self) -> None:
        return None

    async def rollback(self) -> None:
        return None

    async def refresh(self, _obj: Any) -> None:
        return None


_client: Any | None = None
_current: MongoDatabase | None = None


def get_database() -> MongoDatabase | None:
    return _current


def set_database(db: MongoDatabase) -> None:
    """Inject a database instance (used by tests with mongomock)."""
    global _current
    _current = db


async def connect() -> MongoDatabase:
    """Create the production client and make it the current database."""
    global _client, _current
    if _current is not None:
        return _current
    from pymongo.asynchronous.mongo_client import AsyncMongoClient

    _client = AsyncMongoClient(
        settings.MONGODB_URI,
        serverSelectionTimeoutMS=5000,
        connectTimeoutMS=5000,
    )
    db = _client[settings.mongo_database]
    _current = MongoDatabase(mongo_backend_from_database(db))
    return _current


async def disconnect() -> None:
    global _client, _current
    if _client is not None:
        try:
            await _client.close()
        except Exception:
            pass
    _client = None
    _current = None


async def get_session() -> AsyncGenerator[MongoDatabase, None]:
    """FastAPI dependency (kept under the historical name)."""
    db = _current
    if db is None:
        db = await connect()
    yield db


get_db = get_session
