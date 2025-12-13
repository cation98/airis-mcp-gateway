from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class CredentialSave(BaseModel):
    api_key: str = Field(..., alias="api_key")
    provider: Optional[str] = None


class EnableRequest(BaseModel):
    enabled: bool


class CredentialResponse(BaseModel):
    id: str
    provider: str
    version: int
    updated_at: datetime | None = None


class ProbeResponse(BaseModel):
    ok: bool


class EnableResponse(BaseModel):
    ok: bool
    enabled: bool


class ConnectorStatus(BaseModel):
    id: str
    enabled: bool
    provider: Optional[str] = None
    updated_at: Optional[datetime] = None
