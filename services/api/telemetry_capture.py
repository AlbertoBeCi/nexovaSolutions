"""Server producers and bounded request observation; no persistence or self-HTTP."""
from collections import OrderedDict
from contextvars import ContextVar
from dataclasses import dataclass
from datetime import datetime, timezone
import hashlib
import json
import re
from time import perf_counter
from threading import Lock
from uuid import UUID, uuid4

from config import ENVIRONMENT
from telemetry_core import pseudonymize_user, receive_events
from telemetry_schemas import SCHEMA_VERSION, TelemetryBatch, TelemetryEvent


@dataclass
class CaptureContext:
    scope: dict
    request_id: UUID
    session_id: UUID | None
    app: str | None
    started_at: float
    actor_uuid: str | None = None


_context: ContextVar[CaptureContext | None] = ContextVar("telemetry_context", default=None)
_seen: OrderedDict[tuple[str, str], float] = OrderedDict()
_seen_lock = Lock()
diagnostics = {"capture_failures": 0}
_routes = {
    "/auth/login", "/auth/me", "/auth/change-password", "/auth/forgot-password", "/auth/reset-password",
    "/inventory/products", "/inventory/products/{asset_id}", "/inventory/orders", "/inventory/orders/inbound", "/inventory/orders/outbound",
    "/users", "/users/{id}", "/profiles/me", "/suppliers", "/suppliers/{id}", "/suppliers/{id}/rate", "/suppliers/{id}/status", "/api/incidents/analyze",
}


def parse_uuid(value: str | None) -> UUID | None:
    try:
        return UUID(value) if value else None
    except (ValueError, TypeError, AttributeError):
        return None


def route_template() -> str:
    context = _context.get()
    if context is None:
        return "unmatched"
    route = getattr(context.scope.get("route"), "path", context.scope.get("path", ""))
    route = route.replace("{user_id}", "{id}").replace("{supplier_id}", "{id}")
    if re.fullmatch(r"/inventory/products/\d+", route):
        route = "/inventory/products/{asset_id}"
    return route if route in _routes else "unmatched"


def bind_actor(user_uuid: str) -> None:
    context = _context.get()
    if context is not None:
        context.actor_uuid = user_uuid


def track(event_type: str, properties: dict) -> None:
    """One safe server capture entry point. Failures cannot change business results."""
    try:
        context = _context.get()
        if context is None or context.scope.get("path", "").startswith("/telemetry/"):
            return
        user_id = pseudonymize_user(context.actor_uuid) if context.actor_uuid else None
        event = TelemetryEvent(
            eventId=uuid4(), timestamp=datetime.now(timezone.utc), sessionId=context.session_id,
            userId=user_id, event_type=event_type, schemaVersion=SCHEMA_VERSION, requestId=context.request_id,
            properties={**properties, "source": "api", "environment": ENVIRONMENT if ENVIRONMENT in {"development", "test", "production"} else "development", "authority": "server", "actor_type": "user" if user_id else "anonymous", "key_version": "p1" if user_id else None},
        )
        receive_events(TelemetryBatch(events=[event]))
    except Exception:
        diagnostics["capture_failures"] += 1


def record_login(succeeded: bool) -> None:
    context = _context.get()
    if context and context.app:
        properties = {"app": context.app, "route_template": "/auth/login", "duration_ms": min(3600000, (perf_counter() - context.started_at) * 1000)}
        if not succeeded:
            properties["reason_code"] = "invalid_credentials"
        track("login_succeeded" if succeeded else "login_failed", properties)


def record_session_rejection(token: str, reason: str) -> None:
    try:
        context = _context.get()
        if not context or not context.app or context.scope.get("path", "").startswith("/telemetry/"):
            return
        now = perf_counter()
        key = (str(context.session_id) if context.session_id else hashlib.sha256(token.encode()).hexdigest(), reason)
        with _seen_lock:
            while _seen and now - next(iter(_seen.values())) > 1800:
                _seen.popitem(last=False)
            if key in _seen:
                return
            _seen[key] = now
            if len(_seen) > 1024:
                _seen.popitem(last=False)
        track("session_expired" if reason == "token_expired" else "session_invalidated", {"route_template": route_template(), "reason_code": reason})
    except Exception:
        diagnostics["capture_failures"] += 1


def record_analysis(summary: dict, started_at: float) -> None:
    try:
        track("incident_analysis_completed", {"analysis_id": str(uuid4()), "total_rows": summary["total_records"], "valid_rows": summary["valid_records"], "invalid_rows": summary["invalid_records"], "duration_ms": min(3600000, (perf_counter() - started_at) * 1000)})
    except Exception:
        diagnostics["capture_failures"] += 1


def _inventory_path(path: str) -> bool:
    return bool(re.fullmatch(r"/inventory/(products(?:/\d+)?|orders(?:/inbound|/outbound)?)", path))


class TelemetryRequestMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        headers = {key.decode("latin-1").lower(): value.decode("latin-1") for key, value in scope.get("headers", [])}
        app = headers.get("x-nexova-app")
        context = CaptureContext(scope, parse_uuid(headers.get("x-request-id")) or uuid4(), parse_uuid(headers.get("x-telemetry-session-id")), app if app in {"backoffice", "application"} else None, perf_counter())
        marker = _context.set(context)
        path = scope.get("path", "")
        method = scope.get("method", "GET")
        inspect = _inventory_path(path) and method in {"POST", "PUT", "PATCH"} and headers.get("content-type", "").split(";")[0].strip().lower() == "application/json"
        pending = []
        raw = bytearray()
        bounded = True
        status = 0
        try:
            if inspect:
                while True:
                    message = await receive()
                    pending.append(message)
                    if message["type"] != "http.request":
                        bounded = False
                        break
                    chunk = message.get("body", b"")
                    if len(raw) + len(chunk) > 16 * 1024:
                        bounded = False
                        raw.clear()
                        break
                    raw.extend(chunk)
                    if not message.get("more_body", False):
                        break

            async def replay():
                if pending:
                    return pending.pop(0)
                return await receive()

            async def observe(message):
                nonlocal status
                if message["type"] == "http.response.start":
                    status = message["status"]
                    message = {**message, "headers": [(k, v) for k, v in message.get("headers", []) if k.lower() != b"x-request-id"] + [(b"x-request-id", str(context.request_id).encode())]}
                await send(message)

            await self.app(scope, replay, observe)
            if _inventory_path(path) and status in {401, 403}:
                track("access_rejected", {"route_template": route_template(), "method": method, "status_code": status, "reason_code": "forbidden" if status == 403 else "invalid_credentials" if headers.get("authorization") else "missing_credentials"})
            if inspect and bounded and status in {422, 405}:
                try:
                    body = json.loads(raw)
                except (ValueError, UnicodeDecodeError):
                    body = None
                if isinstance(body, dict):
                    forbidden = next((key for key in ("current_stock", "currentStock", "stock") if key in body), None)
                    if forbidden:
                        properties = {"office": None, "product_id": None, "product_category": None, "programme_id": None, "quantity": 0, "currency": None, "method": method, "route_template": route_template(), "forbidden_field": forbidden, "reason_code": "stock_write_forbidden", "resolution_reason": "product_unknown"}
                        attempted = body[forbidden]
                        if type(attempted) is int and 0 <= attempted <= 9007199254740991:
                            properties["attempted_stock"] = attempted
                        track("direct_stock_edit_rejected", properties)
        finally:
            _context.reset(marker)
