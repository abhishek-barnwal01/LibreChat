"""Resolve LibreChat user ObjectId → email and dataAccess via MongoDB.

Results are cached with a TTL (default 5 minutes, configurable via
CACHE_TTL_SECONDS env var).  This means access changes made through the
LibreChat admin UI propagate automatically within the TTL window without
requiring a server restart.

For instant propagation call invalidate_user(user_id) — the FastAPI
/admin/cache/invalidate/{user_id} endpoint does this whenever the
LibreChat backend updates a user's dataAccess field.
"""

import os
import time
import threading

_CACHE_TTL = int(os.getenv("CACHE_TTL_SECONDS", "300"))  # 5 minutes default

# Separate caches for email and dataAccess lookups.
# Each cache maps user_id -> (value, expires_at_monotonic)
_email_cache: dict = {}
_access_cache: dict = {}
_lock = threading.Lock()

_client = None
_db = None


def _get_collection():
    global _client, _db
    if _client is None:
        from config import MONGO_URI
        from pymongo import MongoClient
        from pymongo.errors import ConnectionFailure
        try:
            _client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=3000)
            db_name = MONGO_URI.rstrip("/").rsplit("/", 1)[-1] or "LibreChat"
            _db = _client[db_name]
        except ConnectionFailure as e:
            print(f"⚠️  MongoDB connection failed: {e}")
            _client = None
    return _db["users"] if _db is not None else None


def _cache_get(cache: dict, key: str):
    """Return (value, found). Expired entries are treated as missing."""
    with _lock:
        entry = cache.get(key)
        if entry is not None and time.monotonic() < entry[1]:
            return entry[0], True
        return None, False


def _cache_set(cache: dict, key: str, value):
    with _lock:
        cache[key] = (value, time.monotonic() + _CACHE_TTL)


def invalidate_user(user_id: str):
    """Remove a user from both caches so the next request re-queries MongoDB.

    Called by the FastAPI /admin/cache/invalidate/{user_id} endpoint whenever
    the LibreChat admin updates a user's dataAccess field.
    """
    with _lock:
        _email_cache.pop(user_id, None)
        _access_cache.pop(user_id, None)
    print(f"🗑️  Cache invalidated for user '{user_id}'")


def resolve_email(user_id: str) -> str:
    """Return the email for a LibreChat user ObjectId.

    Falls back to returning the original user_id unchanged if MongoDB is
    unreachable, the user is not found, or pymongo is not installed.
    """
    if not user_id or user_id in ("anonymous", "abhishek"):
        return user_id

    cached, found = _cache_get(_email_cache, user_id)
    if found:
        return cached

    result = user_id  # default fallback
    try:
        from bson import ObjectId
        from bson.errors import InvalidId
        col = _get_collection()
        if col is not None:
            try:
                oid = ObjectId(user_id)
            except InvalidId:
                _cache_set(_email_cache, user_id, user_id)
                return user_id
            doc = col.find_one({"_id": oid}, {"email": 1})
            if doc and doc.get("email"):
                result = doc["email"].lower()
                print(f"👤 Resolved user '{user_id}' → '{result}'")
    except Exception as e:
        print(f"⚠️  Could not resolve user email for '{user_id}': {e}")

    _cache_set(_email_cache, user_id, result)
    return result


def resolve_data_access(user_id: str) -> dict | None:
    """Return the dataAccess dict for a LibreChat user ObjectId.

    Returns a dict like {"productCategories": ["Soaps"], "countries": None}
    or None if the user has unrestricted access (no dataAccess field set).

    Results are cached for CACHE_TTL_SECONDS (default 300 s).  Call
    invalidate_user(user_id) to bust the cache immediately.
    """
    if not user_id or user_id in ("anonymous",):
        return None  # anonymous = full access

    cached, found = _cache_get(_access_cache, user_id)
    if found:
        return cached

    result = None
    try:
        from bson import ObjectId
        from bson.errors import InvalidId
        col = _get_collection()
        if col is not None:
            try:
                oid = ObjectId(user_id)
                doc = col.find_one({"_id": oid}, {"dataAccess": 1})
            except InvalidId:
                doc = col.find_one({"email": user_id.lower()}, {"dataAccess": 1})
            if doc:
                result = doc.get("dataAccess") or None
                print(f"🔒 dataAccess for '{user_id}': {result}")
    except Exception as e:
        print(f"⚠️  Could not resolve dataAccess for '{user_id}': {e}")

    _cache_set(_access_cache, user_id, result)
    return result
