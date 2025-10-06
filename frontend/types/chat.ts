import { Stage } from "@/types/session";

export enum Role {
  VIEWER = "viewer",
  MONITOR = "monitor",
}

export interface ChatMessage {
  id: string;
  user: Role;
  text: string;
  timestamp: string;
  sessionId: string;
  type?: string;
  stage: Stage;
}
