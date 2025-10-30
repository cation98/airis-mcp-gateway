from __future__ import annotations

import asyncio
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict, Optional

import pytest

from app.core.credentials_provider import CredentialProvider


@dataclass
class _TimeStub:
    value: float

    def time(self) -> float:
        return self.value


class _StubCredentialRepository:
    def __init__(self, records: Optional[Dict[str, Dict[str, Any]]] = None):
        self.records: Dict[str, Dict[str, Any]] = records or {}
        self.load_calls: list[str] = []
        self.save_calls: list[tuple[str, str, str, Optional[str]]] = []
        self.load_event: asyncio.Event | None = None

    async def load(self, credential_id: str) -> Optional[Dict[str, Any]]:
        self.load_calls.append(credential_id)
        if self.load_event:
            await self.load_event.wait()
        record = self.records.get(credential_id)
        if record is None:
            return None
        return dict(record)

    async def save(
        self,
        credential_id: str,
        provider: str,
        value: str,
        actor: str | None = None,
    ) -> Dict[str, Any]:
        self.save_calls.append((credential_id, provider, value, actor))
        existing = self.records.get(credential_id)
        version = (existing["version"] if existing else 0) + 1
        record = {
            "id": credential_id,
            "provider": provider,
            "value": value,
            "version": version,
            "updated_at": datetime.utcnow(),
        }
        self.records[credential_id] = record
        return {
            "id": record["id"],
            "provider": record["provider"],
            "version": record["version"],
            "updated_at": record["updated_at"],
        }


@pytest.mark.asyncio
async def test_get_uses_cache_until_ttl_expired(monkeypatch: pytest.MonkeyPatch) -> None:
    repo = _StubCredentialRepository(
        records={
            "cred-1": {
                "id": "cred-1",
                "provider": "openai",
                "value": "secret-1",
                "version": 1,
                "updated_at": datetime.utcnow(),
            }
        }
    )
    provider = CredentialProvider(repo, ttl_ms=1_000)
    clock = _TimeStub(100.0)
    monkeypatch.setattr("app.core.credentials_provider.time.time", clock.time)

    first = await provider.get("cred-1")
    assert first is not None
    assert first["value"] == "secret-1"
    assert repo.load_calls == ["cred-1"]

    clock.value = 100.5
    second = await provider.get("cred-1")
    assert second == first
    assert repo.load_calls == ["cred-1"], "cache hit should avoid repository call"

    clock.value = 102.0
    third = await provider.get("cred-1")
    assert third == first
    assert repo.load_calls == ["cred-1", "cred-1"], "expired cache forces reload"


@pytest.mark.asyncio
async def test_set_invalidates_cache_and_notifies_subscribers(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    repo = _StubCredentialRepository(
        records={
            "cred-2": {
                "id": "cred-2",
                "provider": "anthropic",
                "value": "initial",
                "version": 1,
                "updated_at": datetime.utcnow(),
            }
        }
    )
    provider = CredentialProvider(repo, ttl_ms=5_000)
    clock = _TimeStub(50.0)
    monkeypatch.setattr("app.core.credentials_provider.time.time", clock.time)

    await provider.get("cred-2")
    assert repo.load_calls == ["cred-2"]

    notifications: list[tuple[str, int]] = []

    def _subscriber(credential_id: str, ts: int) -> None:
        notifications.append((credential_id, ts))

    provider.subscribe(_subscriber)
    clock.value = 200.75

    await provider.set("cred-2", "anthropic", "updated", actor="tester")
    assert repo.save_calls == [("cred-2", "anthropic", "updated", "tester")]
    assert notifications == [("cred-2", 200)]

    await provider.get("cred-2")
    assert repo.load_calls == ["cred-2", "cred-2"], "cache should refresh after set"
    updated = repo.records["cred-2"]
    assert updated["value"] == "updated"


@pytest.mark.asyncio
async def test_concurrent_gets_share_single_repository_load(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    repo = _StubCredentialRepository(
        records={
            "cred-3": {
                "id": "cred-3",
                "provider": "openai",
                "value": "shared",
                "version": 1,
                "updated_at": datetime.utcnow(),
            }
        }
    )
    repo.load_event = asyncio.Event()
    provider = CredentialProvider(repo, ttl_ms=1_000)
    clock = _TimeStub(10.0)
    monkeypatch.setattr("app.core.credentials_provider.time.time", clock.time)

    async def _call_get() -> Dict[str, Any]:
        return await provider.get("cred-3")

    task_one = asyncio.create_task(_call_get())
    task_two = asyncio.create_task(_call_get())

    await asyncio.sleep(0)
    assert repo.load_calls == ["cred-3"], "first task should reach repository load"
    assert not task_one.done()
    assert not task_two.done()

    repo.load_event.set()
    result_one, result_two = await asyncio.gather(task_one, task_two)
    assert repo.load_calls == ["cred-3"], "lock should limit concurrent load to one call"
    assert result_one["value"] == "shared"
    assert result_two["value"] == "shared"
