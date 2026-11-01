"""Unit tests for golist_cli.py: the HTTP requests each command sends.

No network: urllib.request.urlopen is replaced by a fake that records every
request and replays canned responses. Every recorded request is also checked
against the paths and methods in apps/api-spec/openapi.yaml, which the backend
tests keep in sync with the real Fastify routes, so a backend route change
that breaks the CLI fails here.

Run with: python3 -m unittest discover -s apps/openclaw
"""

from __future__ import annotations

import contextlib
import io
import json
import os
import re
import sys
import tempfile
import unittest
import urllib.error
import urllib.parse
import urllib.request
import uuid
from pathlib import Path
from typing import Any
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parent))

import golist_cli  # noqa: E402

DEVICE_ID = "11111111-1111-4111-8111-111111111111"
LIST_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
ITEM_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
SHARE_TOKEN = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
SPEC_PATH = Path(__file__).resolve().parent.parent / "api-spec" / "openapi.yaml"
ISO_UTC = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$")


def spec_operations() -> set[tuple[str, str]]:
    """(METHOD, /path/{param}) pairs from openapi.yaml's `paths` (stdlib only, no YAML parser)."""
    operations: set[tuple[str, str]] = set()
    in_paths = False
    current_path: str | None = None
    for line in SPEC_PATH.read_text(encoding="utf-8").splitlines():
        if not line.startswith(" "):
            in_paths = line.rstrip() == "paths:"
            continue
        if not in_paths:
            continue
        path_match = re.match(r"^  (/\S*):\s*$", line)
        if path_match:
            current_path = path_match.group(1)
            continue
        method_match = re.match(r"^    (get|put|post|delete|patch):\s*$", line)
        if method_match and current_path:
            operations.add((method_match.group(1).upper(), current_path))
    return operations


SPEC_OPERATIONS = spec_operations()


def spec_operation_for(method: str, url_path: str) -> tuple[str, str] | None:
    segments = url_path.split("/")
    for spec_method, spec_path in SPEC_OPERATIONS:
        spec_segments = spec_path.split("/")
        if (
            spec_method == method
            and len(spec_segments) == len(segments)
            and all(spec == actual or spec.startswith("{") for spec, actual in zip(spec_segments, segments))
        ):
            return spec_method, spec_path
    return None


class FakeResponse:
    def __init__(self, body: Any) -> None:
        self._raw = b"" if body is None else json.dumps(body).encode("utf-8")

    def read(self) -> bytes:
        return self._raw

    def __enter__(self) -> FakeResponse:
        return self

    def __exit__(self, *_exc: object) -> None:
        return None


class RecordedRequest:
    def __init__(self, request: urllib.request.Request) -> None:
        parsed = urllib.parse.urlsplit(request.full_url)
        self.method = request.get_method()
        self.url = request.full_url
        self.path = parsed.path
        self.query = dict(urllib.parse.parse_qsl(parsed.query))
        # urllib normalizes header names with str.capitalize().
        self.headers = {name.lower(): value for name, value in request.header_items()}
        self.body = json.loads(request.data.decode("utf-8")) if request.data else None


class CliTestCase(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.state_file = Path(self._tmp.name) / "state.json"
        env = mock.patch.dict(os.environ, {"OPENCLAW_STATE_FILE": str(self.state_file), "GOLIST_DEVICE_ID": DEVICE_ID})
        env.start()
        os.environ.pop("GOLIST_SHARE_TOKEN", None)
        self.addCleanup(env.stop)
        self.addCleanup(self._tmp.cleanup)
        self.requests: list[RecordedRequest] = []
        self.responses: list[Any] = []

    def fake_urlopen(self, request: urllib.request.Request, *_args: Any, **_kwargs: Any) -> FakeResponse:
        self.requests.append(RecordedRequest(request))
        if not self.responses:
            raise AssertionError(f"unexpected request {request.get_method()} {request.full_url}")
        response = self.responses.pop(0)
        if isinstance(response, Exception):
            raise response
        return FakeResponse(response)

    def write_state(self, active_list_id: str | None = LIST_ID, name: str = "Groceries") -> None:
        self.state_file.write_text(
            json.dumps({"device_id": DEVICE_ID, "active_list_id": active_list_id, "known_lists": [{"id": LIST_ID, "name": name}]}),
            encoding="utf-8",
        )

    def read_state(self) -> dict[str, Any]:
        return json.loads(self.state_file.read_text(encoding="utf-8"))

    def run_cli(self, *argv: str, responses: list[Any] | None = None) -> tuple[int, Any]:
        self.responses = list(responses or [])
        stdout, stderr = io.StringIO(), io.StringIO()
        with (
            mock.patch.object(sys, "argv", ["golist_cli.py", *argv]),
            mock.patch("urllib.request.urlopen", side_effect=self.fake_urlopen),
            contextlib.redirect_stdout(stdout),
            contextlib.redirect_stderr(stderr),
        ):
            exit_code = golist_cli.main()
        self.assertEqual(self.responses, [], "not every canned response was requested")
        self.stderr = stderr.getvalue()
        output = stdout.getvalue()
        return exit_code, json.loads(output) if output.strip() else None

    def assert_requests(self, expected: list[tuple[str, str]]) -> None:
        self.assertEqual([(request.method, request.path) for request in self.requests], expected)
        for request in self.requests:
            self.assertTrue(request.url.startswith("https://go-list.app/api/v1/"), request.url)
            self.assertEqual(request.headers.get("x-device-id"), DEVICE_ID)
            self.assertEqual(request.headers.get("origin"), "https://go-list.app")
            if request.body is None:
                self.assertNotIn("content-type", request.headers)
            else:
                self.assertEqual(request.headers.get("content-type"), "application/json")
            api_path = request.path.removeprefix("/api")
            self.assertIsNotNone(
                spec_operation_for(request.method, api_path),
                f"{request.method} {api_path} is not an operation in apps/api-spec/openapi.yaml",
            )


class SpecParsingTest(unittest.TestCase):
    def test_reads_operations_from_openapi_yaml(self) -> None:
        self.assertIn(("PUT", "/v1/lists/{listId}/items/{itemId}"), SPEC_OPERATIONS)
        self.assertIn(("POST", "/v1/share-tokens/{shareToken}/redeem"), SPEC_OPERATIONS)
        self.assertIsNone(spec_operation_for("PATCH", f"/v1/lists/{LIST_ID}"))


class CreateListTest(CliTestCase):
    def test_puts_list_with_generated_id_and_saves_it_active(self) -> None:
        exit_code, output = self.run_cli("create-list", "Weekend", responses=[{"listId": "ignored"}])

        self.assertEqual(exit_code, 0)
        [request] = self.requests
        list_id = request.path.rsplit("/", 1)[1]
        uuid.UUID(list_id)
        self.assert_requests([("PUT", f"/api/v1/lists/{list_id}")])
        self.assertEqual(request.body, {"name": "Weekend"})
        self.assertEqual(output["activeList"], {"id": list_id, "name": "Weekend"})
        self.assertEqual(self.read_state()["active_list_id"], list_id)

    def test_generates_and_persists_a_device_id_when_none_is_configured(self) -> None:
        os.environ.pop("GOLIST_DEVICE_ID")
        self.run_cli("create-list", "Weekend", responses=[{"listId": "ignored"}])

        device_id = self.requests[0].headers["x-device-id"]
        uuid.UUID(device_id)
        self.assertEqual(self.read_state()["device_id"], device_id)


    def test_sends_the_list_type_when_given(self) -> None:
        exit_code, _ = self.run_cli("create-list", "Chores", "--type", "todo", responses=[{"listId": "ignored"}])

        self.assertEqual(exit_code, 0)
        self.assertEqual(self.requests[0].body, {"name": "Chores", "listType": "todo"})


class JoinTest(CliTestCase):
    def test_redeems_token_then_fetches_list_name(self) -> None:
        exit_code, output = self.run_cli(
            "join",
            SHARE_TOKEN,
            responses=[{"listId": LIST_ID}, {"listId": LIST_ID, "name": "Shared groceries", "items": []}],
        )

        self.assertEqual(exit_code, 0)
        self.assert_requests([("POST", f"/api/v1/share-tokens/{SHARE_TOKEN}/redeem"), ("GET", f"/api/v1/lists/{LIST_ID}")])
        self.assertIsNone(self.requests[0].body)
        self.assertEqual(output["activeList"], {"id": LIST_ID, "name": "Shared groceries"})
        self.assertEqual(self.read_state()["known_lists"], [{"id": LIST_ID, "name": "Shared groceries"}])

    def test_bootstrap_redeems_the_share_token_option(self) -> None:
        exit_code, _ = self.run_cli(
            "bootstrap",
            "--share-token",
            SHARE_TOKEN,
            responses=[{"listId": LIST_ID}, {"listId": LIST_ID, "name": "Shared", "items": []}],
        )

        self.assertEqual(exit_code, 0)
        self.assert_requests([("POST", f"/api/v1/share-tokens/{SHARE_TOKEN}/redeem"), ("GET", f"/api/v1/lists/{LIST_ID}")])

    def test_reports_api_errors(self) -> None:
        error = urllib.error.HTTPError(
            url="", code=401, msg="Unauthorized", hdrs=None, fp=io.BytesIO(b'{"message":"Unauthorized"}')  # type: ignore[arg-type]
        )
        exit_code, _ = self.run_cli("join", SHARE_TOKEN, responses=[error])

        self.assertEqual(exit_code, 1)
        self.assertIn("API request failed (401)", self.stderr)


class LocalCommandsTest(CliTestCase):
    def test_lists_and_use_list_make_no_requests(self) -> None:
        self.write_state(active_list_id=None)

        _, lists_output = self.run_cli("lists")
        exit_code, use_output = self.run_cli("use-list", "groceries")

        self.assertEqual(exit_code, 0)
        self.assertEqual(self.requests, [])
        self.assertEqual(lists_output, {"activeListId": None, "lists": [{"id": LIST_ID, "name": "Groceries"}]})
        self.assertEqual(use_output["activeList"]["id"], LIST_ID)
        self.assertEqual(self.read_state()["active_list_id"], LIST_ID)


class ShowTest(CliTestCase):
    def test_fetches_active_list_and_hides_deleted_items(self) -> None:
        self.write_state()
        items = [{"id": ITEM_ID, "name": "milk", "deleted": False}, {"id": str(uuid.uuid4()), "name": "eggs", "deleted": True}]

        _, output = self.run_cli("show", responses=[{"listId": LIST_ID, "name": "Groceries", "items": items}])

        self.assert_requests([("GET", f"/api/v1/lists/{LIST_ID}")])
        self.assertEqual([item["name"] for item in output["items"]], ["milk"])


    def test_hides_completed_todos_and_reports_the_list_type(self) -> None:
        self.write_state()
        items = [
            {"id": ITEM_ID, "name": "Vacuum", "deleted": False},
            {"id": str(uuid.uuid4()), "name": "Mop", "deleted": False, "completedAt": "2026-03-01T10:00:00.000Z"},
        ]
        _, output = self.run_cli(
            "show", responses=[{"listId": LIST_ID, "name": "Chores", "listType": "todo", "items": items}]
        )

        self.assertEqual(output["listType"], "todo")
        self.assertEqual([item["name"] for item in output["items"]], ["Vacuum"])

class UpsertTest(CliTestCase):
    def test_creates_new_item_with_generated_id_and_timestamp(self) -> None:
        self.write_state()

        exit_code, output = self.run_cli(
            "upsert", "milk", "--quantity", "2 L", responses=[{"listId": LIST_ID, "name": "Groceries", "items": []}, None]
        )

        self.assertEqual(exit_code, 0)
        item_id = output["itemId"]
        uuid.UUID(item_id)
        self.assert_requests([("GET", f"/api/v1/lists/{LIST_ID}"), ("PUT", f"/api/v1/lists/{LIST_ID}/items/{item_id}")])
        body = self.requests[1].body
        self.assertEqual(set(body), {"name", "deleted", "updatedAt", "quantityOrUnit"})
        self.assertEqual((body["name"], body["deleted"], body["quantityOrUnit"]), ("milk", False, "2 L"))
        self.assertRegex(body["updatedAt"], ISO_UTC)

    def test_reuses_existing_item_id_and_omits_missing_quantity(self) -> None:
        self.write_state()
        existing = {"id": ITEM_ID, "name": "Milk", "deleted": False}

        self.run_cli("upsert", "milk", responses=[{"listId": LIST_ID, "name": "Groceries", "items": [existing]}, None])

        self.assert_requests([("GET", f"/api/v1/lists/{LIST_ID}"), ("PUT", f"/api/v1/lists/{LIST_ID}/items/{ITEM_ID}")])
        self.assertEqual(set(self.requests[1].body), {"name", "deleted", "updatedAt"})

    def test_keeps_existing_quantity_when_none_is_given(self) -> None:
        # The server clears quantityOrUnit when a write omits it.
        self.write_state()
        existing = {"id": ITEM_ID, "name": "Milk", "deleted": False, "quantityOrUnit": "2 L"}

        self.run_cli("upsert", "milk", responses=[{"listId": LIST_ID, "name": "Groceries", "items": [existing]}, None])

        self.assertEqual(self.requests[1].body["quantityOrUnit"], "2 L")

    def test_empty_quantity_clears_it_by_omitting_the_field(self) -> None:
        # The API rejects an empty quantityOrUnit with 400.
        self.write_state()
        existing = {"id": ITEM_ID, "name": "Milk", "deleted": False, "quantityOrUnit": "2 L"}

        self.run_cli("upsert", "milk", "--quantity", "", responses=[{"listId": LIST_ID, "name": "Groceries", "items": [existing]}, None])

        self.assertNotIn("quantityOrUnit", self.requests[1].body)

    def test_targets_list_given_by_name(self) -> None:
        self.write_state(active_list_id=None)

        self.run_cli("upsert", "milk", "--list", "Groceries", responses=[{"listId": LIST_ID, "name": "Groceries", "items": []}, None])

        self.assertEqual(self.requests[0].path, f"/api/v1/lists/{LIST_ID}")

    def test_requires_an_active_list(self) -> None:
        exit_code, _ = self.run_cli("upsert", "milk")

        self.assertEqual(exit_code, 1)
        self.assertEqual(self.requests, [])
        self.assertIn("No active list set", self.stderr)


class DeleteTest(CliTestCase):
    def test_soft_deletes_item_found_by_name(self) -> None:
        self.write_state()
        existing = {"id": ITEM_ID, "name": "Milk", "deleted": False, "quantityOrUnit": "2 L"}

        exit_code, _ = self.run_cli("delete", "milk", responses=[{"listId": LIST_ID, "name": "Groceries", "items": [existing]}, None])

        self.assertEqual(exit_code, 0)
        self.assert_requests([("GET", f"/api/v1/lists/{LIST_ID}"), ("PUT", f"/api/v1/lists/{LIST_ID}/items/{ITEM_ID}")])
        body = self.requests[1].body
        # The quantity is kept so restoring the item brings it back.
        self.assertEqual(set(body), {"name", "deleted", "updatedAt", "quantityOrUnit"})
        self.assertEqual((body["name"], body["deleted"], body["quantityOrUnit"]), ("Milk", True, "2 L"))
        self.assertRegex(body["updatedAt"], ISO_UTC)

    def test_fails_for_unknown_item(self) -> None:
        self.write_state()

        exit_code, _ = self.run_cli("delete", "milk", responses=[{"listId": LIST_ID, "name": "Groceries", "items": []}])

        self.assertEqual(exit_code, 1)
        self.assertEqual(len(self.requests), 1)


class ShareTest(CliTestCase):
    def test_creates_share_token_and_prints_share_url(self) -> None:
        self.write_state()
        response = {"tokenId": SHARE_TOKEN, "listId": LIST_ID, "createdAt": "2026-01-01T00:00:00.000Z", "shareToken": SHARE_TOKEN}

        _, output = self.run_cli("share", responses=[response])

        self.assert_requests([("POST", f"/api/v1/lists/{LIST_ID}/share-tokens")])
        self.assertIsNone(self.requests[0].body)
        self.assertEqual(output["shareUrl"], f"https://go-list.app/?shareToken={SHARE_TOKEN}")


class SyncTest(CliTestCase):
    def test_fetches_items_updated_after_timestamp(self) -> None:
        self.write_state()

        _, output = self.run_cli("sync", "2026-01-01T00:00:00Z", responses=[{"items": []}])

        self.assert_requests([("GET", f"/api/v1/lists/{LIST_ID}/items")])
        self.assertEqual(self.requests[0].query, {"updatedAfter": "2026-01-01T00:00:00Z"})
        self.assertEqual(output, {"items": []})


if __name__ == "__main__":
    unittest.main()
