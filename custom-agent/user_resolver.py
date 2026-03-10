"""Resolve LibreChat user ObjectId → email via MongoDB.

Results are cached for the lifetime of the process — MongoDB is hit
at most once per unique user_id regardless of request volume.
"""

from functools import lru_cache
from config import MONGO_URI

_client = None
_db = None


def _get_collection():
    global _client, _db
    if _client is None:
        from pymongo import MongoClient
        from pymongo.errors import ConnectionFailure
        try:
            _client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=3000)
            # Parse DB name from URI (last path segment), fall back to "LibreChat"
            db_name = MONGO_URI.rstrip("/").rsplit("/", 1)[-1] or "LibreChat"
            _db = _client[db_name]
        except ConnectionFailure as e:
            print(f"⚠️  MongoDB connection failed: {e}")
            _client = None
    return _db["users"] if _db is not None else None


@lru_cache(maxsize=512)
def resolve_email(user_id: str) -> str:
    """Return the email for a LibreChat user ObjectId.

    Falls back to returning the original user_id unchanged if:
    - MongoDB is unreachable
    - The user is not found
    - pymongo is not installed
    """
    if not user_id or user_id in ("anonymous", "abhishek"):
        return user_id

    try:
        from bson import ObjectId
        from bson.errors import InvalidId
        col = _get_collection()
        if col is None:
            return user_id
        try:
            oid = ObjectId(user_id)
        except InvalidId:
            # Already an email or non-ObjectId string — use as-is
            return user_id
        doc = col.find_one({"_id": oid}, {"email": 1})
        if doc and doc.get("email"):
            email = doc["email"].lower()
            print(f"👤 Resolved user '{user_id}' → '{email}'")
            return email
    except Exception as e:
        print(f"⚠️  Could not resolve user email for '{user_id}': {e}")

    return user_id
