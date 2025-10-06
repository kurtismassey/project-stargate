export enum SessionStatus {
  ACTIVE = "active",
  COMPLETED = "completed",
  ASSESSING = "assessing",
}

export enum Stage {
  STAGE_I = 1,
  STAGE_II = 2,
  STAGE_III = 3,
  STAGE_IV = 4,
  STAGE_V = 5,
  STAGE_VI = 6,
}

export interface Session {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: SessionStatus;
  stage: Stage;
}
