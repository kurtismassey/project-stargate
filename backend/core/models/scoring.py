from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING, Union
from uuid import UUID, uuid4

from sqlalchemy import JSON, Column
from sqlmodel import Field, Relationship, SQLModel

if TYPE_CHECKING:
    from core.models.session import Session


class ScoringCategory(str, Enum):
    """
    Scoring categories based on the framework
    """

    OVERALL_QUALITY = "overall_quality"
    TARGET_ACCURACY = "target_accuracy"
    SENSORY_DETAILS = "sensory_details"
    DIMENSIONAL_DATA = "dimensional_data"
    EMOTIONAL_ENERGETIC = "emotional_energetic"
    AOL_CONTAMINATION = "aol_contamination"
    CONSISTENCY = "consistency"
    STAGE_DEVELOPMENT = "stage_development"


class ScoreValue(int, Enum):
    """
    Project Stargate scoring scale (0-7)
    """

    NO_DATA = 0  # No discernible data
    MINIMAL_DATA = 1  # Very little, questionable data
    BASIC_DATA = 2  # Some accurate but basic data
    GOOD_DATA = 3  # Good data with several identifiable elements
    CLEAR_DATA = 4  # Good, clear data with significant identifiable elements
    EXCELLENT_DATA = 5  # Excellent data with high degree of correlation
    PRECISE_DATA = 6  # Excellent data with precise details and clear drawings
    PERFECT_DATA = 7  # Perfect, unambiguous description and depiction


class AOLType(str, Enum):
    """
    Analytic Overlay (AOL) contamination types
    """

    AOL_STRUCTURE = "aol_structure"  # Viewer imposes structure on data
    AOL_MOVEMENT = "aol_movement"  # Viewer adds movement to static targets
    AOL_SYMBOL = "aol_symbol"  # Viewer uses symbols instead of raw data
    AOL_ANALYSIS = "aol_analysis"  # Viewer analyses instead of perceiving
    AOL_IMAGINATION = "aol_imagination"  # Viewer imagines rather than perceives


class SessionScore(SQLModel, table=True):
    """
    Main scoring table for remote viewing sessions
    """

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    session_id: UUID = Field(foreign_key="session.id", nullable=False)

    # Overall scores (0-7 scale)
    overall_quality_score: int = Field(ge=0, le=7, nullable=False)
    target_accuracy_score: int = Field(ge=0, le=7, nullable=False)
    sensory_details_score: int = Field(ge=0, le=7, nullable=False)
    dimensional_data_score: int = Field(ge=0, le=7, nullable=False)
    emotional_energetic_score: int = Field(ge=0, le=7, nullable=False)
    aol_contamination_score: int = Field(ge=0, le=7, nullable=False)  # Lower is better
    consistency_score: int = Field(ge=0, le=7, nullable=False)
    stage_development_score: int = Field(ge=0, le=7, nullable=False)

    # Calculated composite score
    composite_score: float = Field(nullable=False)

    # Detailed analysis
    strengths: list[str] = Field(default_factory=list, sa_column=Column(JSON))
    weaknesses: list[str] = Field(default_factory=list, sa_column=Column(JSON))
    aol_instances: list[str] = Field(default_factory=list, sa_column=Column(JSON))
    target_correlations: list[str] = Field(default_factory=list, sa_column=Column(JSON))

    # Relationships
    session: Union["Session", None] = Relationship(back_populates="analysis")
    stage_scores: list["StageScore"] = Relationship(back_populates="session_score")

    created_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)
    updated_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)


class StageScore(SQLModel, table=True):
    """
    Individual stage scoring within a session
    """

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    session_score_id: UUID = Field(foreign_key="sessionscore.id", nullable=False)
    stage: int = Field(ge=1, le=6, nullable=False)

    # Stage-specific scores
    data_quality_score: int = Field(ge=0, le=7, nullable=False)
    target_relevance_score: int = Field(ge=0, le=7, nullable=False)
    sensory_richness_score: int = Field(ge=0, le=7, nullable=False)
    dimensional_accuracy_score: int = Field(ge=0, le=7, nullable=False)
    aol_contamination_score: int = Field(ge=0, le=7, nullable=False)  # Lower is better

    # Stage analysis
    key_elements: list[str] = Field(default_factory=list, sa_column=Column(JSON))
    sensory_data: list[str] = Field(default_factory=list, sa_column=Column(JSON))
    dimensional_data: list[str] = Field(default_factory=list, sa_column=Column(JSON))
    aol_instances: list[str] = Field(default_factory=list, sa_column=Column(JSON))
    target_correlations: list[str] = Field(default_factory=list, sa_column=Column(JSON))

    session_score: Union["SessionScore", None] = Relationship(
        back_populates="stage_scores"
    )

    created_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)


class ScoringCriteria(SQLModel, table=True):
    """
    Reference table for scoring criteria and guidelines
    """

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    category: ScoringCategory = Field(nullable=False)
    score_value: ScoreValue = Field(nullable=False)
    description: str = Field(nullable=False)
    examples: list[str] = Field(default_factory=list, sa_column=Column(JSON))
    created_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)


class AOLInstance(SQLModel, table=True):
    """
    Specific instances of Analytic Overlay contamination
    """

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    session_score_id: UUID = Field(foreign_key="sessionscore.id", nullable=False)
    stage: int = Field(ge=1, le=6, nullable=False)
    aol_type: AOLType = Field(nullable=False)
    description: str = Field(nullable=False)
    severity: int = Field(ge=1, le=7, nullable=False)  # 1=minimal, 7=severe
    context: str = Field(nullable=False)  # What the viewer said/drew
    created_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)
