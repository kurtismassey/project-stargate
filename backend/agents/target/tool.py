import base64
import os
import random
from io import BytesIO
from pathlib import Path

from core.config.logger import logger
from core.config.settings import settings
from langchain_core.messages import HumanMessage
from langchain_google_genai import ChatGoogleGenerativeAI
from PIL import Image
from tenacity import retry, stop_after_attempt, wait_exponential

_PROMPT_TEMPLATE = (Path(__file__).parent / "prompt.txt").read_text(encoding="utf-8")


def compress_image(
    image_data: bytes, max_width: int = 800, max_height: int = 600, quality: int = 85
) -> str:
    """
    Compress an image to reduce its size and token count.

    Args:
        image_data: Raw image bytes
        max_width: Maximum width in pixels
        max_height: Maximum height in pixels
        quality: JPEG quality (1-100)

    Returns:
        Base64 encoded compressed image
    """
    try:
        # Open the image
        image: Image.Image = Image.open(BytesIO(image_data))

        # Convert to RGB if necessary (for JPEG compatibility)
        if image.mode in ("RGBA", "LA", "P"):
            image = image.convert("RGB")

        # Calculate new dimensions while maintaining aspect ratio
        width, height = image.size
        ratio = min(max_width / width, max_height / height)

        if ratio < 1:
            new_width = int(width * ratio)
            new_height = int(height * ratio)
            image = image.resize((new_width, new_height), Image.Resampling.LANCZOS)

        # Save as compressed JPEG
        output = BytesIO()
        image.save(output, format="JPEG", quality=quality, optimize=True)
        compressed_data = output.getvalue()

        # Convert to base64
        return base64.b64encode(compressed_data).decode("utf-8")

    except Exception as e:
        logger.error(f"Error compressing image: {e}")
        # Fallback to original data
        return base64.b64encode(image_data).decode("utf-8")


async def select_random_target_image() -> str:
    """
    Select a random target image from the targets directory and convert to base64.

    Returns:
        A base64 encoded image string.
    """
    # Get the targets directory path
    targets_dir = Path(__file__).parent.parent.parent / "targets"

    # Get all image files from the targets directory
    image_extensions = {".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp"}
    image_files = [
        f
        for f in os.listdir(targets_dir)
        if os.path.isfile(targets_dir / f)
        and Path(f).suffix.lower() in image_extensions
    ]

    if not image_files:
        raise FileNotFoundError("No image files found in targets directory")

    # Select a random image file
    selected_file = random.choice(image_files)
    image_path = targets_dir / selected_file

    # Read the image file and compress it
    with open(image_path, "rb") as image_file:
        image_data = image_file.read()
        # Compress the image to reduce token count
        compressed_base64 = compress_image(
            image_data, max_width=800, max_height=600, quality=85
        )
        return compressed_base64


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=4, max=10),
    reraise=True,
)
async def generate_target_model_image(
    description: str, sketches: list[str] | None = None
) -> str:
    """
    Generate a target model image based on a description and sketches.

    Args:
        description: A textual description of the target.
        sketches: List of base64 encoded sketch images to use as visual context.

    Returns:
        A base64 encoded image string.
    """
    llm = ChatGoogleGenerativeAI(
        model=settings.IMAGE_MODEL,
        api_key=settings.GOOGLE_API_KEY,
        temperature=0.3,
    )

    prompt = _PROMPT_TEMPLATE.format(description=description)

    content = [
        {
            "type": "text",
            "text": prompt,
        }
    ]

    if sketches:
        for i, sketch in enumerate(sketches):
            if sketch and sketch.strip():
                if not sketch.startswith("data:image"):
                    sketch = f"data:image/jpeg;base64,{sketch}"
                content.append({"type": "image_url", "image_url": {"url": sketch}})  # type: ignore
                logger.info(
                    f"Added sketch {i + 1} as visual context for target model generation"
                )

    message = HumanMessage(content=content)  # type: ignore

    response = await llm.ainvoke(
        [message],
        generation_config={"response_modalities": ["TEXT", "IMAGE"]},
    )

    response_content = response.content

    if isinstance(response_content, list) and len(response_content) > 0:
        for item in response_content:
            if isinstance(item, dict) and "image_url" in item:
                image_data_url = item["image_url"]["url"]
                break
            elif isinstance(item, str) and item.startswith("data:image"):
                image_data_url = item
                break
        else:
            raise ValueError("No image found in response content")
    elif isinstance(response_content, str) and response_content.startswith(
        "data:image"
    ):
        image_data_url = response_content
    else:
        raise ValueError(
            f"Unexpected response content structure: {type(response_content)}"
        )

    # Extract base64 data from data URL
    if "," not in image_data_url:
        raise ValueError("Invalid image data URL format")

    base64_data = image_data_url.split(",")[-1]
    image_data = base64.b64decode(base64_data)
    compressed_base64 = compress_image(
        image_data, max_width=600, max_height=400, quality=80
    )
    logger.info("Target model generated successfully")
    return compressed_base64
