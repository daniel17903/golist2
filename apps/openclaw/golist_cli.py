#!/usr/bin/env python3
"""CLI tool for OpenClaw to manage a single shared GoList list."""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

API_BASE_URL = "https://go-list.app/api"
STATE_FILE_ENV = "OPENCLAW_STATE_FILE"
DEFAULT_STATE_FILE = Path.home() / ".openclaw_golist_state.json"


class CliError(Exception):
    """Raised when user-facing CLI errors occur."""


@dataclass
class RuntimeState:
    device_id: str | None = None
    list_id: str | None = None


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def resolve_state_file() -> Path:
    configured = os.environ.get(STATE_FILE_ENV)
    return Path(configured).expanduser() if configured else DEFAULT_STATE_FILE


def load_state() -> RuntimeState:
    state = RuntimeState(device_id=os.environ.get("GOLIST_DEVICE_ID"))

    state_path = resolve_state_file()
    if state_path.exists():
        with state_path.open("r", encoding="utf-8") as handle:
            payload = json.load(handle)
            state.device_id = state.device_id or payload.get("device_id")
            state.list_id = state.list_id or payload.get("list_id")

    return state


def save_state(state: RuntimeState) -> None:
    state_path = resolve_state_file()
    state_path.parent.mkdir(parents=True, exist_ok=True)
    with state_path.open("w", encoding="utf-8") as handle:
        json.dump({"device_id": state.device_id, "list_id": state.list_id}, handle, indent=2)


def ensure_device_id(state: RuntimeState) -> str:
    if state.device_id:
        return state.device_id
    state.device_id = str(uuid.uuid4())
    save_state(state)
    return state.device_id


def build_headers(device_id: str, include_json: bool = True) -> dict[str, str]:
    headers = {
        "X-Device-Id": device_id,
    }
    if include_json:
        headers["Content-Type"] = "application/json"
    return headers


def api_request(
    method: str,
    path: str,
    device_id: str,
    body: dict[str, Any] | None = None,
    query: dict[str, str] | None = None,
) -> Any:
    url = f"{API_BASE_URL}{path}"
    if query:
        url = f"{url}?{urllib.parse.urlencode(query)}"

    data: bytes | None = None
    if body is not None:
        data = json.dumps(body).encode("utf-8")

    request = urllib.request.Request(
        url=url,
        method=method,
        headers=build_headers(device_id=device_id, include_json=body is not None),
        data=data,
    )

    try:
        with urllib.request.urlopen(request) as response:
            response_text = response.read().decode("utf-8")
            if not response_text:
                return None
            return json.loads(response_text)
    except urllib.error.HTTPError as exc:
        response_text = exc.read().decode("utf-8")
        detail = response_text.strip() or exc.reason
        raise CliError(f"API request failed ({exc.code}): {detail}") from exc
    except urllib.error.URLError as exc:
        raise CliError(f"Could not reach GoList API: {exc.reason}") from exc


def ensure_list_id(state: RuntimeState, allow_bootstrap: bool) -> str:
    if state.list_id:
        return state.list_id
    if not allow_bootstrap:
        raise CliError(
            "No list is configured. Run `bootstrap` first with GOLIST_SHARE_TOKEN set."
        )
    return bootstrap(state)


def bootstrap(state: RuntimeState) -> str:
    device_id = ensure_device_id(state)
    share_token = os.environ.get("GOLIST_SHARE_TOKEN")
    if not share_token:
        raise CliError("GOLIST_SHARE_TOKEN is required for bootstrap.")

    payload = api_request(
        "POST",
        f"/v1/share-tokens/{share_token}/redeem",
        device_id=device_id,
    )

    list_id = payload.get("listId") if isinstance(payload, dict) else None
    if not list_id:
        raise CliError("Token redemption succeeded but response did not include listId.")

    state.list_id = list_id
    save_state(state)
    return list_id


def cmd_bootstrap(state: RuntimeState, _args: argparse.Namespace) -> None:
    list_id = bootstrap(state)
    print(json.dumps({"deviceId": state.device_id, "listId": list_id}, indent=2))


def cmd_show(state: RuntimeState, _args: argparse.Namespace) -> None:
    device_id = ensure_device_id(state)
    list_id = ensure_list_id(state, allow_bootstrap=True)
    payload = api_request("GET", f"/v1/lists/{list_id}", device_id=device_id)

    if not isinstance(payload, dict):
        raise CliError("Unexpected API response while reading list.")

    items = payload.get("items", [])
    non_deleted_items = [item for item in items if not item.get("deleted")]

    print(
        json.dumps(
            {
                "listId": list_id,
                "name": payload.get("name"),
                "items": non_deleted_items,
            },
            indent=2,
        )
    )


def cmd_upsert(state: RuntimeState, args: argparse.Namespace) -> None:
    device_id = ensure_device_id(state)
    list_id = ensure_list_id(state, allow_bootstrap=True)

    item_id = args.item_id or str(uuid.uuid4())
    body: dict[str, Any] = {
        "name": args.name,
        "deleted": False,
        "updatedAt": now_iso(),
    }
    if args.icon_name is not None:
        body["iconName"] = args.icon_name
    if args.category is not None:
        body["category"] = args.category

    payload = api_request(
        "PUT",
        f"/v1/lists/{list_id}/items/{item_id}",
        device_id=device_id,
        body=body,
    )

    print(json.dumps({"listId": list_id, "itemId": item_id, "response": payload}, indent=2))


def cmd_delete(state: RuntimeState, args: argparse.Namespace) -> None:
    device_id = ensure_device_id(state)
    list_id = ensure_list_id(state, allow_bootstrap=True)

    body = {
        "name": args.name,
        "deleted": True,
        "updatedAt": now_iso(),
    }

    payload = api_request(
        "PUT",
        f"/v1/lists/{list_id}/items/{args.item_id}",
        device_id=device_id,
        body=body,
    )

    print(json.dumps({"listId": list_id, "itemId": args.item_id, "response": payload}, indent=2))


def cmd_sync(state: RuntimeState, args: argparse.Namespace) -> None:
    device_id = ensure_device_id(state)
    list_id = ensure_list_id(state, allow_bootstrap=True)

    payload = api_request(
        "GET",
        f"/v1/lists/{list_id}/items",
        device_id=device_id,
        query={"updatedAfter": args.updated_after},
    )

    print(json.dumps(payload, indent=2))


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="OpenClaw GoList single-list CLI")
    subparsers = parser.add_subparsers(dest="command", required=True)

    bootstrap_parser = subparsers.add_parser("bootstrap", help="Redeem share token and persist list id")
    bootstrap_parser.set_defaults(func=cmd_bootstrap)

    show_parser = subparsers.add_parser("show", help="Fetch list and print non-deleted items")
    show_parser.set_defaults(func=cmd_show)

    upsert_parser = subparsers.add_parser("upsert", help="Create/update an item")
    upsert_parser.add_argument("name", help="Item name")
    upsert_parser.add_argument("--item-id", help="Stable UUID for updates. Random UUID used when omitted.")
    upsert_parser.add_argument("--icon-name", help="Explicit iconName to send")
    upsert_parser.add_argument("--category", help="Explicit category to send")
    upsert_parser.set_defaults(func=cmd_upsert)

    delete_parser = subparsers.add_parser("delete", help="Soft-delete an existing item")
    delete_parser.add_argument("item_id", help="Existing item UUID")
    delete_parser.add_argument("name", help="Current item name")
    delete_parser.set_defaults(func=cmd_delete)

    sync_parser = subparsers.add_parser("sync", help="Fetch items updated after a timestamp")
    sync_parser.add_argument("updated_after", help="ISO timestamp")
    sync_parser.set_defaults(func=cmd_sync)

    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    state = load_state()

    try:
        args.func(state, args)
        return 0
    except CliError as exc:
        print(str(exc), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
