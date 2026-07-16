from __future__ import annotations

from typing import Any

from .database import server_timestamp


MERGE_BY_ID_KEYS = {
    "users",
    "clients",
    "buildings",
    "apartments",
    "equipment",
    "tickets",
    "workOrders",
    "interventions",
    "reminders",
    "clientDocuments",
    "serviceTypes",
    "interventionTypes",
    "formTemplates",
    "roleDefinitions",
    "dataFields",
    "passwordResetRequests",
    "storageLocations",
    "equipmentMovements",
    "equipmentReplacements",
    "hvacSystems",
    "hvacSystemTypes",
    "workOrderTargets",
    "workOrderCompletionAudits",
}


def item_timestamp(item: dict) -> str:
    for key in ("serverUpdatedAt", "updatedAt", "updated_at", "modifiedAt", "createdAt", "uploadedAt", "date"):
        value = item.get(key)
        if value:
            return str(value)
    return ""


def merge_by_id(current_items: list[Any], incoming_items: list[Any]) -> list[Any]:
    current_items = current_items or []
    incoming_items = incoming_items or []
    current_map = {
        item.get("id"): item
        for item in current_items
        if isinstance(item, dict) and item.get("id")
    }
    incoming_map = {
        item.get("id"): item
        for item in incoming_items
        if isinstance(item, dict) and item.get("id")
    }
    ordered_ids: list[str] = []
    for item in incoming_items + current_items:
        if isinstance(item, dict) and item.get("id") and item["id"] not in ordered_ids:
            ordered_ids.append(item["id"])

    merged: list[Any] = []
    for item_id in ordered_ids:
        current = current_map.get(item_id)
        incoming = incoming_map.get(item_id)
        if current and incoming:
            current_stamp = item_timestamp(current)
            incoming_stamp = item_timestamp(incoming)
            if current_stamp and incoming_stamp:
                chosen = current if current_stamp > incoming_stamp else incoming
            elif current_stamp and not incoming_stamp:
                chosen = current
            else:
                chosen = incoming
            if isinstance(current.get("attachments"), list) or isinstance(incoming.get("attachments"), list):
                chosen = dict(chosen)
                chosen["attachments"] = merge_by_id(current.get("attachments", []), incoming.get("attachments", []))
            merged.append(chosen)
        else:
            merged.append(incoming or current)
    return merged


def merge_shared_state(current: dict | None, incoming: dict) -> dict:
    if not current:
        return incoming
    merged = {**current, **incoming}
    for key in MERGE_BY_ID_KEYS:
        if isinstance(current.get(key), list) or isinstance(incoming.get(key), list):
            merged[key] = merge_by_id(current.get(key, []), incoming.get(key, []))
    return merged


def apply_state_changes(current: dict | None, changes: dict) -> dict:
    merged = dict(current or {})
    values = changes.get("values") if isinstance(changes.get("values"), dict) else {}
    for key, value in values.items():
        if key in {"sessionUserId", "modal", "toast"}:
            continue
        merged[key] = value

    upserts = changes.get("upserts") if isinstance(changes.get("upserts"), dict) else {}
    deletes = changes.get("deletes") if isinstance(changes.get("deletes"), dict) else {}

    for key in MERGE_BY_ID_KEYS:
        current_items = merged.get(key, [])
        if not isinstance(current_items, list):
            current_items = []
        remove_ids = {
            str(item_id.get("id") if isinstance(item_id, dict) else item_id)
            for item_id in deletes.get(key, [])
            if (item_id.get("id") if isinstance(item_id, dict) else item_id) is not None
        }
        by_id: dict[str, Any] = {
            str(item.get("id")): item
            for item in current_items
            if isinstance(item, dict) and item.get("id") is not None and str(item.get("id")) not in remove_ids
        }
        order: list[str] = [
            str(item.get("id"))
            for item in current_items
            if isinstance(item, dict) and item.get("id") is not None and str(item.get("id")) not in remove_ids
        ]
        for item in upserts.get(key, []):
            if not isinstance(item, dict) or item.get("id") is None:
                continue
            item_id = str(item.get("id"))
            by_id[item_id] = item
            if item_id not in order:
                order.insert(0, item_id)
        merged[key] = [by_id[item_id] for item_id in order if item_id in by_id]
    return merged


def conflicting_state_change(current: dict | None, changes: dict | None) -> tuple[str, str] | None:
    if not isinstance(current, dict) or not isinstance(changes, dict):
        return None
    upserts = changes.get("upserts") if isinstance(changes.get("upserts"), dict) else {}
    deletes = changes.get("deletes") if isinstance(changes.get("deletes"), dict) else {}
    for key in MERGE_BY_ID_KEYS:
        current_items = current.get(key, [])
        if not isinstance(current_items, list):
            current_items = []
        current_by_id = {
            str(item.get("id")): item
            for item in current_items
            if isinstance(item, dict) and item.get("id") is not None
        }
        for incoming in upserts.get(key, []) if isinstance(upserts.get(key), list) else []:
            if not isinstance(incoming, dict) or incoming.get("id") is None:
                continue
            current_item = current_by_id.get(str(incoming.get("id")))
            expected = str(incoming.get("serverUpdatedAt") or "")
            current_version = str((current_item or {}).get("serverUpdatedAt") or "")
            if expected and (not current_item or current_version != expected):
                return key, str(incoming.get("id"))
        for deleted in deletes.get(key, []) if isinstance(deletes.get(key), list) else []:
            if not isinstance(deleted, dict) or deleted.get("id") is None:
                continue
            current_item = current_by_id.get(str(deleted.get("id")))
            expected = str(deleted.get("serverUpdatedAt") or "")
            current_version = str((current_item or {}).get("serverUpdatedAt") or "")
            if expected and (not current_item or current_version != expected):
                return key, str(deleted.get("id"))
    return None


def stamp_changed_items(state: dict, changes: dict | None = None) -> None:
    stamp = server_timestamp()
    if not isinstance(changes, dict):
        for key in MERGE_BY_ID_KEYS:
            for item in state.get(key, []) if isinstance(state.get(key), list) else []:
                if isinstance(item, dict) and not item.get("serverUpdatedAt"):
                    item["serverUpdatedAt"] = stamp
        return

    upserts = changes.get("upserts") if isinstance(changes.get("upserts"), dict) else {}
    for key, items in upserts.items():
        if key not in MERGE_BY_ID_KEYS or not isinstance(items, list):
            continue
        changed_ids = {
            str(item.get("id"))
            for item in items
            if isinstance(item, dict) and item.get("id") is not None
        }
        for item in state.get(key, []) if isinstance(state.get(key), list) else []:
            if isinstance(item, dict) and str(item.get("id")) in changed_ids:
                item["serverUpdatedAt"] = stamp


def duplicate_user_email(state: dict) -> str | None:
    seen: set[str] = set()
    for user in state.get("users", []):
        if not isinstance(user, dict):
            continue
        email = str(user.get("email", "")).strip().lower()
        if not email:
            continue
        if email in seen:
            return email
        seen.add(email)
    return None


def changed_collection_keys(changes: dict | None) -> set[str]:
    if not isinstance(changes, dict):
        return set()
    keys: set[str] = set()
    for section in ("upserts", "deletes"):
        bucket = changes.get(section)
        if isinstance(bucket, dict):
            keys.update(key for key in bucket.keys() if key in MERGE_BY_ID_KEYS)
    values = changes.get("values")
    if isinstance(values, dict):
        keys.update(key for key in values.keys() if key in MERGE_BY_ID_KEYS)
    return keys
