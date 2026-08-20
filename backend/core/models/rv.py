"""Research domain model.

Tables and enums for sealed targets, taskings, protocol sessions, typed
transcripts, TTI displacement, and judging. Field rationale is documented in
docs/research/METRICS.md and maps to the primary sources in
docs/research/SOURCES.md.
"""

import secrets
from datetime import UTC, datetime
from enum import Enum
from uuid import UUID, uuid4

from sqlalchemy import JSON, Column
from sqlmodel import Field, SQLModel


def utcnow() -> datetime:
    """Naive UTC timestamp, consistent across SQLite and Postgres."""
    return datetime.now(UTC).replace(tzinfo=None)


def new_tasking_number() -> str:
    """Opaque encrypted-style cue, two four-digit groups.

    The operational cue format (encrypted coordinates / tasking numbers)
    per the DIA Star Gate briefing [CIA-BRIEF].
    """
    return f"{secrets.randbelow(10000):04d}-{secrets.randbelow(10000):04d}"


class Protocol(str, Enum):
    CRV = "crv"
    ERV = "erv"
    ARV = "arv"
    WRV = "wrv"


class TargetKind(str, Enum):
    IMAGE = "image"
    COORDINATE_SITE = "coordinate_site"
    ARV_OUTCOME = "arv_outcome"


class CueType(str, Enum):
    TASKING_NUMBER = "tasking_number"
    COORDINATES = "coordinates"


class SessionEnvironment(str, Enum):
    SOLO = "solo"
    MONITORED_AI = "monitored_ai"
    MONITORED_HUMAN = "monitored_human"


class RVSessionStatus(str, Enum):
    ACTIVE = "active"
    LOCKED = "locked"
    JUDGED = "judged"
    ARCHIVED = "archived"


class FeedbackPolicy(str, Enum):
    IMMEDIATE = "immediate"
    DEFERRED = "deferred"


class EventKind(str, Enum):
    """Typed transcript vocabulary from the 1986 CRV manual [CRV-MANUAL]."""

    CUE = "cue"
    IDEOGRAM = "ideogram"
    IDEOGRAM_A = "ideogram_a"
    IDEOGRAM_B = "ideogram_b"
    SENSORY = "sensory"
    DIMENSIONAL = "dimensional"
    AESTHETIC_IMPACT = "aesthetic_impact"
    EMOTIONAL_IMPACT = "emotional_impact"
    TANGIBLE = "tangible"
    INTANGIBLE = "intangible"
    AOL = "aol"
    AOL_BREAK = "aol_break"
    AOL_SIGNAL = "aol_signal"
    SKETCH = "sketch"
    MONITOR_PROMPT = "monitor_prompt"
    VIEWER_NOTE = "viewer_note"
    BREAK = "break"
    STAGE_ADVANCE = "stage_advance"
    LOCK = "lock"
    FEEDBACK_VIEW = "feedback_view"


class BreakReason(str, Enum):
    CONFUSION = "confusion"
    TOO_MUCH = "too_much"
    AESTHETIC_IMPACT = "aesthetic_impact"
    EMOTIONAL_IMPACT = "emotional_impact"
    BIO = "bio"


class JudgeKind(str, Enum):
    HUMAN = "human"
    LLM = "llm"


class TargetPool(SQLModel, table=True):
    __tablename__ = "target_pools"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    name: str = Field(index=True)
    description: str = Field(default="")
    created_at: datetime = Field(default_factory=utcnow, nullable=False)


class SealedTarget(SQLModel, table=True):
    __tablename__ = "sealed_targets"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    pool_id: UUID = Field(foreign_key="target_pools.id", index=True)
    kind: TargetKind = Field(default=TargetKind.IMAGE)

    # Sealed content. Never serialized toward a viewer before lock.
    payload_b64: str | None = Field(default=None)
    payload_sha256: str | None = Field(default=None)
    coordinates: str | None = Field(default=None)
    title: str = Field(default="")
    feedback_notes: str = Field(default="")

    source: str = Field(default="operator")
    # May/SAIC descriptor memberships. Target material. Never serialized
    # toward a viewer before lock [MAY-FOM] [PAT-REPORT].
    descriptors: dict = Field(default_factory=dict, sa_column=Column(JSON))
    created_at: datetime = Field(default_factory=utcnow, nullable=False)
    sealed_at: datetime | None = Field(default=None)


class Series(SQLModel, table=True):
    __tablename__ = "series"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    name: str = Field(index=True)
    pool_id: UUID = Field(foreign_key="target_pools.id")
    feedback_policy: FeedbackPolicy = Field(default=FeedbackPolicy.IMMEDIATE)
    created_at: datetime = Field(default_factory=utcnow, nullable=False)


class ArvPair(SQLModel, table=True):
    """Two sealed associates for associative remote viewing.

    The viewer is tasked on the future feedback photograph. The engine
    seals which side is the true associate. Labels stay server-side until
    after lock. Judging is binary rank-order of the two sides.
    """

    __tablename__ = "arv_pairs"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    pool_id: UUID = Field(foreign_key="target_pools.id", index=True)
    side_a_id: UUID = Field(foreign_key="sealed_targets.id")
    side_b_id: UUID = Field(foreign_key="sealed_targets.id")
    label_a: str = Field(default="A")
    label_b: str = Field(default="B")
    created_at: datetime = Field(default_factory=utcnow, nullable=False)


class Tasking(SQLModel, table=True):
    __tablename__ = "taskings"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    tasking_number: str = Field(default_factory=new_tasking_number, index=True)
    target_id: UUID = Field(foreign_key="sealed_targets.id")
    cue_type: CueType = Field(default=CueType.TASKING_NUMBER)
    protocol: Protocol = Field(default=Protocol.CRV)
    environment: SessionEnvironment = Field(default=SessionEnvironment.MONITORED_AI)

    series_id: UUID | None = Field(default=None, foreign_key="series.id", index=True)
    series_position: int | None = Field(default=None)
    arv_pair_id: UUID | None = Field(
        default=None, foreign_key="arv_pairs.id", index=True
    )

    created_at: datetime = Field(default_factory=utcnow, nullable=False)
    sealed_at: datetime = Field(default_factory=utcnow, nullable=False)


class Viewer(SQLModel, table=True):
    """A named source. Population statistics group by viewer [UTTS-1995]."""

    __tablename__ = "viewers"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    callsign: str = Field(index=True, unique=True)
    notes: str = Field(default="")
    created_at: datetime = Field(default_factory=utcnow, nullable=False)


class RVSession(SQLModel, table=True):
    __tablename__ = "rv_sessions"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    tasking_id: UUID = Field(foreign_key="taskings.id", index=True)
    status: RVSessionStatus = Field(default=RVSessionStatus.ACTIVE, index=True)
    # No column default. The engine sets 1 for CRV and leaves ERV null. A
    # default here would overwrite an explicit None at flush time.
    current_stage: int | None = Field(default=None)

    viewer_id: UUID | None = Field(default=None, foreign_key="viewers.id", index=True)
    viewer_name: str = Field(default="Viewer 001")
    monitor_mode: SessionEnvironment = Field(default=SessionEnvironment.MONITORED_AI)
    monitor_blind: bool = Field(default=True)

    started_at: datetime = Field(default_factory=utcnow, nullable=False)
    locked_at: datetime | None = Field(default=None)
    feedback_at: datetime | None = Field(default=None)
    feedback_latency_ms: int | None = Field(default=None)

    # Materialized live-health counters, also derivable from the transcript.
    aol_count: int = Field(default=0)
    break_count: int = Field(default=0)
    leading_flag_count: int = Field(default=0)

    source: str = Field(default="chamber")
    created_at: datetime = Field(default_factory=utcnow, nullable=False)


class TranscriptEvent(SQLModel, table=True):
    __tablename__ = "transcript_events"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    session_id: UUID = Field(foreign_key="rv_sessions.id", index=True)
    seq: int = Field(index=True)
    stage: int | None = Field(default=None)
    kind: EventKind = Field(index=True)
    payload: dict = Field(default_factory=dict, sa_column=Column(JSON))
    flagged_leading: bool = Field(default=False)

    created_at: datetime = Field(default_factory=utcnow, nullable=False)
    ms_since_start: int = Field(default=0)


class StageRecord(SQLModel, table=True):
    __tablename__ = "stage_records"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    session_id: UUID = Field(foreign_key="rv_sessions.id", index=True)
    stage: int
    entered_at: datetime = Field(default_factory=utcnow, nullable=False)
    exited_at: datetime | None = Field(default=None)
    dwell_ms: int | None = Field(default=None)


class Judgment(SQLModel, table=True):
    __tablename__ = "judgments"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    session_id: UUID = Field(foreign_key="rv_sessions.id", index=True)
    judge_kind: JudgeKind = Field(default=JudgeKind.HUMAN)
    judge_name: str = Field(default="")

    pool_target_ids: list = Field(default_factory=list, sa_column=Column(JSON))
    rankings: list = Field(default_factory=list, sa_column=Column(JSON))
    rank_of_true_target: int
    pool_size: int
    accuracy: float = Field(default=0.0)
    reliability: float = Field(default=0.0)
    figure_of_merit: float = Field(default=0.0)
    fom_method: str = Field(default="rank_process")
    response_descriptors: dict = Field(default_factory=dict, sa_column=Column(JSON))

    notes: str = Field(default="")
    created_at: datetime = Field(default_factory=utcnow, nullable=False)


class DisplacementScore(SQLModel, table=True):
    __tablename__ = "displacement_scores"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    session_id: UUID = Field(foreign_key="rv_sessions.id", index=True)
    series_id: UUID = Field(foreign_key="series.id", index=True)
    lag: int
    lag_target_id: UUID = Field(foreign_key="sealed_targets.id")
    rank: int
    pool_size: int
    is_hit: bool = Field(default=False)
    judgment_id: UUID | None = Field(default=None, foreign_key="judgments.id")
    created_at: datetime = Field(default_factory=utcnow, nullable=False)


class AnalystReport(SQLModel, table=True):
    __tablename__ = "analyst_reports"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    session_id: UUID = Field(foreign_key="rv_sessions.id", index=True)
    model: str = Field(default="")
    summary: str = Field(default="")
    correspondences: list = Field(default_factory=list, sa_column=Column(JSON))
    advisory_score: float | None = Field(default=None)
    created_at: datetime = Field(default_factory=utcnow, nullable=False)


class AuditLog(SQLModel, table=True):
    __tablename__ = "audit_log"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    actor: str = Field(default="operator")
    action: str = Field(index=True)
    entity_type: str
    entity_id: str
    detail: dict = Field(default_factory=dict, sa_column=Column(JSON))
    created_at: datetime = Field(default_factory=utcnow, nullable=False)
