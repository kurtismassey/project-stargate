import { Stage } from "./session";
import { Role } from "./chat";

export enum EventType {
  // Session list messages
  SESSIONS = "sessions",
  SESSION_UPDATED = "session_updated",
  SESSION_CREATED = "session_created",
  SESSION_DELETED = "session_deleted",
  DELETE_SESSION = "delete_session",
  COMPLETE_SESSION = "complete_session",

  // Session messages
  SESSION_CONNECTED = "session_connected",
  DRAW = "draw",
  CLEAR = "clear",
  SYNC_STAGE = "sync_stage",
  CHAT = "chat",
  CHAT_HISTORY = "chat_history",
  DRAWING_HISTORY = "drawing_history",
  SESSION_ANALYSIS = "session_analysis",

  // System messages
  HEARTBEAT = "heartbeat",
  ERROR = "error",
}

export interface ServerChatMessage {
  id: string;
  user: string;
  text: string;
  timestamp: string;
  sessionId: string;
}

export interface DrawMessage {
  sessionId: string;
  stageNumber: number;
  prevX: number;
  prevY: number;
  x: number;
  y: number;
  color: string;
}

export interface ClearMessage {
  sessionId: string;
  stageNumber: number;
}

export interface ClientDrawMessage {
  type: EventType.DRAW;
  sessionId: string;
  stageNumber: number;
  prevX: number;
  prevY: number;
  x: number;
  y: number;
  color: string;
}

export interface ClientClearMessage {
  type: EventType.CLEAR;
  sessionId: string;
  stageNumber: number;
}

export interface ClientSyncStageMessage {
  type: EventType.SYNC_STAGE;
  sessionId: string;
  stageNumber: Stage;
}

export interface ClientChatMessage {
  type: EventType.CHAT;
  user: Role;
  text: string;
  stage: Stage;
}

export interface ClientCompleteSessionMessage {
  type: EventType.COMPLETE_SESSION;
  sessionId: string;
}

export interface SessionMessage {
  type: EventType;
  sessionId?: string;
  stageNumber?: number;
  prevX?: number;
  prevY?: number;
  x?: number;
  y?: number;
  color?: string;
  user?: string;
  text?: string;
  stage?: number;
  drawing?: string;
  drawings?: string[];
}
