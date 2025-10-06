from enum import Enum


class EventType(str, Enum):
    """
    Event types
    """

    # Session list messages
    SESSIONS = "sessions"
    SESSION_UPDATED = "session_updated"
    SESSION_CREATED = "session_created"
    SESSION_DELETED = "session_deleted"
    CREATE_SESSION = "create_session"
    DELETE_SESSION = "delete_session"
    COMPLETE_SESSION = "complete_session"

    # Session messages
    SESSION_CONNECTED = "session_connected"
    DRAW = "draw"
    CLEAR = "clear"
    SYNC_STAGE = "sync_stage"
    CHAT = "chat"
    CHAT_HISTORY = "chat_history"
    DRAWING_HISTORY = "drawing_history"
    SESSION_ANALYSIS = "session_analysis"

    # System messages
    HEARTBEAT = "heartbeat"
    ERROR = "error"
