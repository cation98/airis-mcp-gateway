"""
Database module - Lite mode only (no DB dependency).

To restore DB support, check out the 'full-mode' branch.
"""
from typing import AsyncGenerator, Optional


def is_db_available() -> bool:
    """DB is disabled in lite mode"""
    return False


async def get_db() -> AsyncGenerator[Optional[object], None]:
    """Returns None - no DB in lite mode"""
    yield None


# Stub for imports that expect these
class Base:
    """Stub base class"""
    pass


engine = None
AsyncSessionLocal = None
