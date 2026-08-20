"""Operator passphrases and session tokens.

A callsign without a hash stays open for local work. Once any operator
sets a passphrase, mutating ops need a valid token or the lab key.
Tokens are random secrets. Only their SHA-256 is stored.
"""

from __future__ import annotations

import hashlib
import secrets
from uuid import UUID, uuid4

from core.models.rv import Operator, OperatorToken, utcnow
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

PBKDF2_ROUNDS = 200_000


def hash_passphrase(passphrase: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256", passphrase.encode("utf-8"), salt.encode("utf-8"), PBKDF2_ROUNDS
    ).hex()
    return f"pbkdf2${salt}${digest}"


def verify_passphrase(passphrase: str, stored: str) -> bool:
    if not stored:
        return not passphrase
    parts = stored.split("$")
    if len(parts) != 3 or parts[0] != "pbkdf2":
        return False
    _, salt, expected = parts
    digest = hashlib.pbkdf2_hmac(
        "sha256", passphrase.encode("utf-8"), salt.encode("utf-8"), PBKDF2_ROUNDS
    ).hex()
    return secrets.compare_digest(digest, expected)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


async def any_passphrase_set(db: AsyncSession) -> bool:
    operators = list((await db.exec(select(Operator))).all())
    return any(row.passphrase_hash for row in operators)


async def issue_token(db: AsyncSession, operator: Operator) -> str:
    token = secrets.token_urlsafe(32)
    db.add(
        OperatorToken(
            id=uuid4(),
            operator_id=operator.id,
            token_hash=hash_token(token),
            created_at=utcnow(),
        )
    )
    await db.commit()
    return token


async def resolve_token(db: AsyncSession, token: str) -> Operator | None:
    if not token:
        return None
    row = (
        await db.exec(
            select(OperatorToken).where(OperatorToken.token_hash == hash_token(token))
        )
    ).first()
    if row is None:
        return None
    return await db.get(Operator, row.operator_id)


async def sign_in(db: AsyncSession, callsign: str, passphrase: str) -> tuple[Operator, str]:
    name = callsign.strip()
    operator = (
        await db.exec(select(Operator).where(Operator.callsign == name))
    ).first()
    if operator is None:
        raise AuthError("unknown_operator", "No operator with that callsign.")
    if not operator.passphrase_hash:
        raise AuthError("no_passphrase", "This operator has no passphrase yet.")
    if not verify_passphrase(passphrase, operator.passphrase_hash):
        raise AuthError("bad_passphrase", "Passphrase does not match.")
    token = await issue_token(db, operator)
    return operator, token


class AuthError(Exception):
    def __init__(self, code: str, message: str, status_code: int = 401):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code
