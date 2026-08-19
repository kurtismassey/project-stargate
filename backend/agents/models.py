from pydantic import BaseModel, Field


class StageAnalysis(BaseModel):
    """
    Analysis of a single stage in a remote viewing session.
    """

    stage: int = Field(description="The stage number being analysed.")
    summary: str = Field(
        description="A concise summary of the viewer's perceptions and drawings in this stage."
    )
    key_elements: list[str] = Field(
        description="A list of the most important objects, concepts, or sensory data from this stage."
    )


class SessionAnalysis(BaseModel):
    """
    A complete, structured analysis of a remote viewing session with comprehensive scoring.
    """

    overall_summary: str = Field(
        description="A high-level summary of the entire session, synthesizing all stages."
    )
    stage_by_stage_analysis: list[StageAnalysis] = Field(
        description="A detailed breakdown of the analysis for each individual stage."
    )
    final_assessment_score: int = Field(
        description="An overall session quality score from 0 (no discernible data) to 7 (clear, detailed, and accurate target description), based on the established marking criteria.",
        ge=0,
        le=7,
    )

    overall_quality_score: int = Field(
        description="Overall session quality and coherence score (0-7)",
        ge=0,
        le=7,
    )
    target_accuracy_score: int = Field(
        description="Accuracy of target correlation score (0-7)",
        ge=0,
        le=7,
    )
    sensory_details_score: int = Field(
        description="Richness and specificity of sensory data score (0-7)",
        ge=0,
        le=7,
    )
    dimensional_data_score: int = Field(
        description="Accuracy of dimensional data score (0-7)",
        ge=0,
        le=7,
    )
    emotional_energetic_score: int = Field(
        description="Quality of emotional and energetic data score (0-7)",
        ge=0,
        le=7,
    )
    aol_contamination_score: int = Field(
        description="Level of AOL contamination score (0-7, lower is better)",
        ge=0,
        le=7,
    )
    consistency_score: int = Field(
        description="Consistency across stages score (0-7)",
        ge=0,
        le=7,
    )
    stage_development_score: int = Field(
        description="Progressive development through stages score (0-7)",
        ge=0,
        le=7,
    )

    composite_score: float = Field(
        description="Weighted composite score based on all metrics",
        ge=0.0,
        le=7.0,
    )

    session_strengths: list[str] = Field(
        description="Key strengths identified in the session",
        default_factory=list,
    )
    session_weaknesses: list[str] = Field(
        description="Areas for improvement identified in the session",
        default_factory=list,
    )
    aol_instances: list[str] = Field(
        description="Specific AOL contamination instances with examples",
        default_factory=list,
    )
    target_correlations: list[str] = Field(
        description="Specific correlations between session data and target",
        default_factory=list,
    )


class MonitorResponse(BaseModel):
    """
    Response from the monitor to the viewer.
    """

    response: str = Field(description="The monitor's response to the viewer.")
