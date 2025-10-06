from pathlib import Path

from agents.models import MonitorResponse
from core.config.settings import settings
from core.models.session import ChatMessage
from langchain_core.messages import HumanMessage
from langchain_google_genai import ChatGoogleGenerativeAI


async def get_monitor_response(
    chat_history: list[ChatMessage],
    message: ChatMessage,
    drawing_data: str | None = None,
) -> str:
    """
    Process viewer's session data and provide appropriate guidance.

    Args:
        chat_history: The history of chat messages in the session
        message: The viewer's message
        drawing_data: The current drawing state as a base64 data URL

    Returns:
        The monitor's response to the viewer.
    """
    llm = ChatGoogleGenerativeAI(
        model=settings.LLM_MODEL,
        api_key=settings.GOOGLE_API_KEY,
        temperature=0.7,
    )

    prompt_path = Path(__file__).parent / "prompt.txt"
    with open(prompt_path, "r") as f:
        prompt_template = f.read()

    monitor = llm.with_structured_output(MonitorResponse)

    chat_history_str = "\n".join([f"{m.user}: {m.text}" for m in chat_history])
    new_message = f"\n{message.user}: {message.text}"
    full_chat = chat_history_str + new_message

    prompt = prompt_template.format(input=full_chat)
    content = [{"type": "text", "text": prompt}]

    if drawing_data:
        content.append(
            {
                "type": "image_url",
                "image_url": drawing_data,
            }
        )

    human_message = HumanMessage(content=content)  # type: ignore
    response = await monitor.ainvoke([human_message])

    if hasattr(response, "response"):
        return response.response
    else:
        return str(response)
