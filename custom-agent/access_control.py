"""Role-based access control for Azure AI Search and SQL queries.

Rules are loaded from access_rules.json (same directory).
  - search_categories: exact file_category_ai values for OData filter
  - sql_categories:    exact file_category_det values for SQL WHERE
  - countries:         shared between both (country_ai / country_det)
null = unrestricted (full access).
"""

import json
import os
from typing import Optional, Dict, Any
from user_resolver import resolve_email

_CONFIG_PATH = os.path.join(os.path.dirname(__file__), "access_rules.json")
_config: Optional[Dict] = None


def _load_config() -> Dict:
    global _config
    if _config is None:
        with open(_CONFIG_PATH) as f:
            _config = json.load(f)
    return _config


def reload_config() -> None:
    """Force reload of access_rules.json (useful after edits without restart)."""
    global _config
    _config = None
    _load_config()


def get_access_rules(user_id: str) -> Dict[str, Any]:
    """Return access rules for a user.

    user_id is the LibreChat MongoDB ObjectId received from X-User-Id header.
    It is resolved to an email first (via user_resolver) so that access_rules.json
    can use readable email addresses as keys instead of opaque ObjectIds.
    Falls back to default_role if the user is not listed.
    """
    cfg = _load_config()
    email = resolve_email(user_id)
    # Try email first, then raw user_id (covers non-ObjectId IDs / test cases)
    role = cfg["users"].get(email) or cfg["users"].get(user_id) or cfg.get("default_role", "full_access")
    rules = cfg["roles"].get(role, {"search_categories": None, "sql_categories": None, "countries": None})
    print(f"🔒 Access rules for '{email}': role='{role}' | "
          f"categories={rules.get('search_categories')} | countries={rules.get('countries')}")
    return rules


def build_odata_filter(rules: Dict[str, Any]) -> Optional[str]:
    """OData filter string for Azure AI Search (file_category_ai, country_ai).
    Returns None if the user has full access (no restriction needed).
    """
    parts = []
    cats = rules.get("search_categories")
    countries = rules.get("countries")
    if cats:
        cat_parts = " or ".join(f"file_category_ai eq '{c}'" for c in cats)
        parts.append(f"({cat_parts})")
    if countries:
        country_parts = " or ".join(f"country_ai eq '{c}'" for c in countries)
        parts.append(f"({country_parts})")
    return " and ".join(parts) if parts else None


def build_sql_filter(rules: Dict[str, Any]) -> Optional[str]:
    """SQL WHERE fragment for the Postgres metadata table (file_category_det, country_det).
    Returns None if the user has full access (no restriction needed).
    """
    parts = []
    cats = rules.get("sql_categories")
    countries = rules.get("countries")
    if cats:
        quoted = ", ".join(f"'{c}'" for c in cats)
        parts.append(f"file_category_det IN ({quoted})")
    if countries:
        quoted = ", ".join(f"'{c}'" for c in countries)
        parts.append(f"country_det IN ({quoted})")
    return " AND ".join(parts) if parts else None
