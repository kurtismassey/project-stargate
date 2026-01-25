import base64
from pathlib import Path

from agents.models import SessionAnalysis
from agents.target.tool import compress_image
from core.config.logger import logger
from core.config.settings import settings
from core.models.session import Session
from langchain_core.messages import HumanMessage
from langchain_google_genai import ChatGoogleGenerativeAI


async def analyse_session(
    session: Session,
    drawings: list[str],
    target_image: str | None = None,
    target_model: str | None = None,
) -> SessionAnalysis:
    """
    Analyse a completed remote viewing session.

    Args:
        session: The session data
        drawings: A list of base64 data URLs for each stage's drawing
        target_image: The actual target image as base64 string
        target_model: The generated target model as base64 string

    Returns:
        The analyst's structured analysis of the session.
    """
    llm = ChatGoogleGenerativeAI(
        model=settings.LLM_MODEL,
        api_key=settings.GOOGLE_API_KEY,
        temperature=0.7,
    )

    prompt_path = Path(__file__).parent / "prompt.txt"
    with open(prompt_path, "r") as f:
        prompt_template = f.read()

    analyst = llm.with_structured_output(SessionAnalysis)

    chat_history = "\n".join([f"{m.user}: {m.text}" for m in session.chat])
    drawings_input = "\n".join(
        [f"Stage {i + 1}: [Image Data]" for i, d in enumerate(drawings) if d]
    )

    prompt = prompt_template.format(
        input=chat_history,
        drawings_input=drawings_input,
    )

    content = [{"type": "text", "text": prompt}]

    logger.info(f"Starting session analysis with {len(drawings)} drawings")

    if target_image:
        try:
            base64_data = (
                target_image.split(",")[-1] if "," in target_image else target_image
            )
            image_data = base64.b64decode(base64_data)
            compressed_target = compress_image(
                image_data, max_width=600, max_height=400, quality=80
            )
            content.append(
                {
                    "type": "text",
                    "text": "=== ACTUAL TARGET IMAGE (USE THIS FOR ALL ACCURACY SCORING) ===",
                }
            )
            content.append(
                {
                    "type": "image_url",
                    "image_url": f"data:image/jpeg;base64,{compressed_target}",
                }
            )
        except Exception as e:
            logger.error(f"Error compressing target image: {e}")
            content.append(
                {
                    "type": "text",
                    "text": "=== ACTUAL TARGET IMAGE (USE THIS FOR ALL ACCURACY SCORING) ===",
                }
            )
            content.append(
                {
                    "type": "image_url",
                    "image_url": f"data:image/jpeg;base64,{target_image}",
                }
            )

    if target_model:
        try:
            base64_data = (
                target_model.split(",")[-1] if "," in target_model else target_model
            )
            image_data = base64.b64decode(base64_data)
            compressed_model = compress_image(
                image_data, max_width=600, max_height=400, quality=80
            )
            content.append(
                {
                    "type": "text",
                    "text": "=== TARGET MODEL (REFERENCE ONLY - DO NOT USE FOR SCORING) ===",
                }
            )
            content.append(
                {
                    "type": "image_url",
                    "image_url": f"data:image/jpeg;base64,{compressed_model}",
                }
            )
        except Exception as e:
            logger.error(f"Error compressing target model: {e}")
            content.append(
                {
                    "type": "text",
                    "text": "=== TARGET MODEL (REFERENCE ONLY - DO NOT USE FOR SCORING) ===",
                }
            )
            content.append(
                {
                    "type": "image_url",
                    "image_url": f"data:image/jpeg;base64,{target_model}",
                }
            )

    for i, drawing_data in enumerate(drawings):
        if drawing_data:
            try:
                base64_data = (
                    drawing_data.split(",")[-1] if "," in drawing_data else drawing_data
                )
                image_data = base64.b64decode(base64_data)
                compressed_drawing = compress_image(
                    image_data, max_width=400, max_height=300, quality=75
                )
                content.append(
                    {
                        "type": "image_url",
                        "image_url": f"data:image/jpeg;base64,{compressed_drawing}",
                    }
                )
            except Exception as e:
                logger.error(f"Error compressing drawing {i + 1}: {e}")
                continue

    logger.info(f"Analysis complete with {len(content)} content items")

    response = await analyst.ainvoke([HumanMessage(content=content)])  # type: ignore

    if isinstance(response, SessionAnalysis):
        return response
    else:
        return SessionAnalysis(
            overall_summary="Analysis failed",
            stage_by_stage_analysis=[],
            final_assessment_score=0,
            overall_quality_score=0,
            target_accuracy_score=0,
            sensory_details_score=0,
            dimensional_data_score=0,
            emotional_energetic_score=0,
            aol_contamination_score=0,
            consistency_score=0,
            stage_development_score=0,
            composite_score=0.0,
            session_strengths=["Analysis failed"],
            session_weaknesses=["Unable to analyse session"],
            aol_instances=[],
            target_correlations=[],
        )
