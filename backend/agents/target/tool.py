"""Image utilities for sealed target ingestion."""

import base64
from io import BytesIO

from core.config.logger import logger
from PIL import Image


def compress_image(
    image_data: bytes, max_width: int = 800, max_height: int = 600, quality: int = 85
) -> str:
    """Compress raw image bytes and return base64 JPEG.

    Keeps sealed payloads small enough to store inline and cheap to send
    at feedback time.
    """
    try:
        image: Image.Image = Image.open(BytesIO(image_data))

        if image.mode in ("RGBA", "LA", "P"):
            image = image.convert("RGB")

        width, height = image.size
        ratio = min(max_width / width, max_height / height)

        if ratio < 1:
            new_width = int(width * ratio)
            new_height = int(height * ratio)
            image = image.resize((new_width, new_height), Image.Resampling.LANCZOS)

        output = BytesIO()
        image.save(output, format="JPEG", quality=quality, optimize=True)
        return base64.b64encode(output.getvalue()).decode("utf-8")
    except Exception as error:
        logger.error(f"Error compressing image: {error}")
        return base64.b64encode(image_data).decode("utf-8")
