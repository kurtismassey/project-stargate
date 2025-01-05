"""
Data access layer for Project Stargate
"""

from .repository import BaseRepository
from .session_repository import SessionRepository

__all__ = ["BaseRepository", "SessionRepository"]
