"""Structured outputs for the AI monitor and analyst."""

from pydantic import BaseModel, Field


class MonitorDecision(BaseModel):
    """One review pass over the viewer's latest transcript entry.

    The monitor's default is silence. It speaks only to keep structure,
    never to add content [CRV-MANUAL].
    """

    action: str = Field(
        description="Either 'silence' or 'prompt'. Silence is the default."
    )
    text: str = Field(
        default="",
        description=(
            "The prompt to give when action is 'prompt'. Short prescribed "
            "patter only, one sentence."
        ),
    )
    aol_suspected: bool = Field(
        default=False,
        description=(
            "True when the entry reads as analytic naming rather than "
            "low-level signal data."
        ),
    )


class Correspondence(BaseModel):
    element: str = Field(description="Transcript element, quoted or summarized")
    target_feature: str = Field(
        description="Feature of the sealed target it corresponds to, or "
        "'none' when the element has no match"
    )
    strength: float = Field(
        ge=0, le=1, description="Correspondence strength, 0 none to 1 exact"
    )


class AnalystAssessment(BaseModel):
    """Advisory post-lock read of a session against the sealed target."""

    summary: str = Field(description="Concise narrative of the session's fit")
    correspondences: list[Correspondence] = Field(default_factory=list)
    advisory_score: float = Field(
        ge=0,
        le=7,
        description=(
            "Advisory accuracy on the historical 0 to 7 scale. Never the "
            "official score, judging is [UTTS-1995]."
        ),
    )
