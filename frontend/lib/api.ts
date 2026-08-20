/** Typed REST client for the platform API. */

import type { EventKind, Protocol } from "./protocol";

export interface TaskingSummary {
  id: string;
  taskingNumber: string;
  cue: string;
  cueType: "tasking_number" | "coordinates";
  protocol: Protocol;
  environment: "solo" | "monitored_ai" | "monitored_human";
  seriesId: string | null;
  seriesPosition: number | null;
  arvPairId: string | null;
  createdAt: string;
  sealedAt: string;
  sessionId?: string | null;
  sessionStatus?: string | null;
}

export interface SessionSummary {
  id: string;
  status: "active" | "locked" | "judged" | "archived";
  currentStage: number | null;
  viewerId: string | null;
  viewerName: string;
  operatorId?: string | null;
  operatorName?: string | null;
  monitorId?: string | null;
  monitorName?: string | null;
  monitorMode: "solo" | "monitored_ai" | "monitored_human";
  monitorBlind: boolean;
  startedAt: string;
  lockedAt: string | null;
  feedbackAt: string | null;
  feedbackLatencyMs: number | null;
  aolCount: number;
  breakCount: number;
  leadingFlagCount: number;
  source: string;
  tasking: TaskingSummary;
}

export interface TranscriptEventData {
  id: string;
  sessionId: string;
  seq: number;
  stage: number | null;
  kind: EventKind;
  payload: Record<string, unknown>;
  flaggedLeading: boolean;
  createdAt: string;
  msSinceStart: number;
}

export interface StageRecordData {
  stage: number;
  enteredAt: string;
  exitedAt: string | null;
  dwellMs: number | null;
}

export interface JudgmentData {
  id: string;
  rankOfTrueTarget: number;
  poolSize: number;
  judgeName: string;
  accuracy?: number;
  reliability?: number;
  figureOfMerit?: number;
  fomMethod?: string;
  createdAt: string;
}

export interface SessionDetail extends SessionSummary {
  events: TranscriptEventData[];
  stageRecords: StageRecordData[];
  judgment?: JudgmentData | null;
}

export interface FeedbackData {
  target: {
    id: string;
    kind: string;
    title: string;
    payloadB64: string | null;
    payloadSha256: string | null;
    coordinates: string | null;
    feedbackNotes: string;
    descriptors?: Record<string, number>;
    encoded?: boolean;
  };
  feedbackAt: string;
  feedbackLatencyMs: number | null;
}

export interface PoolMember {
  id: string;
  kind: string;
  payloadB64: string | null;
  coordinates: string | null;
}

export interface AnalystReportData {
  id: string;
  model: string;
  summary: string;
  correspondences: {
    element: string;
    target_feature: string;
    strength: number;
  }[];
  advisoryScore: number | null;
  createdAt: string;
}

export interface ViewerStats {
  id: string | null;
  callsign: string;
  sessions: number;
  judgedSessions: number;
  firstPlaceMatches: number;
  expectedFirstPlace?: number;
  meanRankOfTrueTarget: number | null;
  meanAccuracy?: number | null;
  meanReliability?: number | null;
  meanFigureOfMerit: number | null;
}

export interface OperatorData {
  id: string;
  callsign: string;
  notes: string;
  createdAt: string;
  sessionsOperated: number;
  sessionsMonitored: number;
}

export interface ViewerData {
  id: string;
  callsign: string;
  notes: string;
  createdAt: string;
  sessions: number;
  judgedSessions: number;
  firstPlaceMatches: number;
  meanFigureOfMerit: number | null;
  meanRankOfTrueTarget: number | null;
}

export interface StatsData {
  sessions: {
    total: number;
    active: number;
    byStatus: Record<string, number>;
    byProtocol?: Record<
      string,
      {
        sessions: number;
        judged: number;
        firstPlace: number;
        meanFigureOfMerit: number;
      }
    >;
    byEnvironment?: Record<string, number>;
  };
  protocolHealth: {
    aolTotal: number;
    breakTotal: number;
    aolPerSession: number;
  };
  judging: {
    judgedSessions: number;
    firstPlaceMatches: number;
    expectedFirstPlace: number;
    meanRankOfTrueTarget: number | null;
    meanAccuracy?: number | null;
    meanReliability?: number | null;
    meanFigureOfMerit?: number | null;
    byMethod?: Record<string, number>;
  };
  viewers?: ViewerStats[];
  feedback: { meanLatencyMs: number | null; sessionsWithFeedback: number };
  displacement: Record<
    string,
    { trials: number; hits: number; expectedHits: number }
  >;
}

export interface SeriesData {
  id: string;
  name: string;
  poolId: string;
  feedbackPolicy: string;
  taskingCount: number;
  createdAt: string;
}

export interface SeriesDetail extends SeriesData {
  trials: TaskingSummary[];
  displacement: Record<string, { trials: number; hits: number }>;
}

export interface PoolData {
  id: string;
  name: string;
  description: string;
  targetCount: number;
  createdAt: string;
}

export interface PoolReceipt {
  id: string;
  kind: string;
  payloadSha256: string | null;
  hasCoordinates: boolean;
  encoded?: boolean;
  sealedAt: string | null;
}

export interface LagTarget {
  lag: number;
  exists: boolean;
  target: { id: string; payloadB64: string | null; coordinates: string | null } | null;
}

export const LAB_KEY_STORAGE = "stargate-lab-key";

export function getLabKey(): string {
  if (typeof window === "undefined") return "";
  return sessionStorage.getItem(LAB_KEY_STORAGE) ?? "";
}

export function setLabKey(key: string) {
  sessionStorage.setItem(LAB_KEY_STORAGE, key);
}

export function clearLabKey() {
  sessionStorage.removeItem(LAB_KEY_STORAGE);
}

export class ApiError extends Error {
  code: string;
  status: number;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const labKey = getLabKey();
  if (labKey) headers.set("X-Lab-Key", labKey);
  const response = await fetch(path, {
    ...init,
    headers,
  });
  if (!response.ok) {
    let code = "error";
    let message = response.statusText;
    try {
      const body = await response.json();
      if (body.detail && typeof body.detail === "object") {
        code = body.detail.code ?? code;
        message = body.detail.message ?? message;
      } else if (typeof body.detail === "string") {
        message = body.detail;
      }
    } catch {
      // Non-JSON error body, keep the status text.
    }
    throw new ApiError(response.status, code, message);
  }
  return response.json() as Promise<T>;
}

export const api = {
  health: () =>
    request<{ status: string; aiEnabled: boolean; labKeyRequired: boolean }>(
      "/api/health",
    ),

  stats: () => request<StatsData>("/api/stats"),

  listTaskings: () => request<{ taskings: TaskingSummary[] }>("/api/taskings"),

  createTasking: (body: {
    protocol?: Protocol;
    environment?: string;
    cueType?: string;
    seriesId?: string;
    poolId?: string;
  }) =>
    request<TaskingSummary>("/api/taskings", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  listSessions: () => request<{ sessions: SessionSummary[] }>("/api/sessions"),

  startSession: (
    taskingId: string,
    options?: {
      viewerName?: string;
      viewerId?: string;
      operatorId?: string;
      monitorId?: string;
    },
  ) =>
    request<SessionSummary>("/api/sessions", {
      method: "POST",
      body: JSON.stringify({
        taskingId,
        viewerName: options?.viewerName,
        viewerId: options?.viewerId,
        operatorId: options?.operatorId,
        monitorId: options?.monitorId,
      }),
    }),

  listOperators: () => request<{ operators: OperatorData[] }>("/api/operators"),

  createOperator: (callsign: string) =>
    request<OperatorData>("/api/operators", {
      method: "POST",
      body: JSON.stringify({ callsign }),
    }),

  sendMonitorPrompt: (sessionId: string, text: string) =>
    request<{ event: TranscriptEventData }>(
      `/api/sessions/${sessionId}/monitor-prompts`,
      {
        method: "POST",
        body: JSON.stringify({ text }),
      },
    ),

  listViewers: () => request<{ viewers: ViewerData[] }>("/api/viewers"),

  createViewer: (callsign: string) =>
    request<ViewerData>("/api/viewers", {
      method: "POST",
      body: JSON.stringify({ callsign }),
    }),

  getViewer: (viewerId: string) =>
    request<
      ViewerData & { stats: ViewerStats; sessions: SessionSummary[] }
    >(`/api/viewers/${viewerId}`),

  getSession: (sessionId: string) =>
    request<SessionDetail>(`/api/sessions/${sessionId}`),

  appendEvent: (
    sessionId: string,
    kind: EventKind,
    payload: Record<string, unknown>,
  ) =>
    request<{
      event: TranscriptEventData;
      monitorEvents: TranscriptEventData[];
    }>(`/api/sessions/${sessionId}/events`, {
      method: "POST",
      body: JSON.stringify({ kind, payload }),
    }),

  advanceStage: (sessionId: string) =>
    request<SessionSummary>(`/api/sessions/${sessionId}/advance`, {
      method: "POST",
    }),

  lockSession: (sessionId: string) =>
    request<SessionSummary>(`/api/sessions/${sessionId}/lock`, {
      method: "POST",
    }),

  getFeedback: (sessionId: string) =>
    request<FeedbackData>(`/api/sessions/${sessionId}/feedback`),

  getJudgingPool: (sessionId: string) =>
    request<{ pool: PoolMember[] }>(`/api/sessions/${sessionId}/judging-pool`),

  recordJudgment: (
    sessionId: string,
    rankings: { targetId: string; rank: number }[],
    judgeName?: string,
    responseDescriptors?: Record<string, number>,
  ) =>
    request<{
      id: string;
      rankOfTrueTarget: number;
      poolSize: number;
      accuracy: number;
      reliability: number;
      figureOfMerit: number;
      fomMethod: string;
    }>(`/api/sessions/${sessionId}/judgments`, {
      method: "POST",
      body: JSON.stringify({ rankings, judgeName, responseDescriptors }),
    }),

  suggestDescriptors: (sessionId: string) =>
    request<{ descriptors: Record<string, number> }>(
      `/api/sessions/${sessionId}/descriptor-suggestion`,
    ),

  recordDisplacement: (
    sessionId: string,
    body: { lag: number; rank: number; poolSize: number },
  ) =>
    request<{ id: string; lag: number; rank: number; isHit: boolean }>(
      `/api/sessions/${sessionId}/displacement`,
      {
        method: "POST",
        body: JSON.stringify(body),
      },
    ),

  listSeries: () => request<{ series: SeriesData[] }>("/api/series"),

  createSeries: (body: {
    name: string;
    trialCount?: number;
    protocol?: Protocol;
    environment?: string;
  }) =>
    request<SeriesData>("/api/series", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  getSeries: (seriesId: string) => request<SeriesDetail>(`/api/series/${seriesId}`),

  sealSeriesTrials: (
    seriesId: string,
    body: { trialCount: number; protocol?: Protocol; environment?: string },
  ) =>
    request<SeriesDetail>(`/api/series/${seriesId}/trials`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  getLagTargets: (sessionId: string) =>
    request<{ lags: LagTarget[] }>(`/api/sessions/${sessionId}/lag-targets`),

  listAnalysis: (sessionId: string) =>
    request<{ reports: AnalystReportData[] }>(
      `/api/sessions/${sessionId}/analysis`,
    ),

  runAnalysis: (sessionId: string) =>
    request<AnalystReportData>(`/api/sessions/${sessionId}/analysis`, {
      method: "POST",
    }),

  listPools: () => request<{ pools: PoolData[] }>("/api/pools"),

  createPool: (name: string, description?: string) =>
    request<PoolData>("/api/pools", {
      method: "POST",
      body: JSON.stringify({ name, description }),
    }),

  getPool: (poolId: string) =>
    request<PoolData & { receipts: PoolReceipt[] }>(`/api/pools/${poolId}`),

  addTarget: (
    poolId: string,
    body: {
      payloadB64?: string;
      title?: string;
      coordinates?: string;
      kind?: "image" | "coordinate_site";
      descriptors?: Record<string, number>;
    },
  ) =>
    request<{ id: string; payloadSha256: string | null; kind: string }>(
      `/api/pools/${poolId}/targets`,
      { method: "POST", body: JSON.stringify(body) },
    ),

  getSessionPackage: (sessionId: string) =>
    request<Record<string, unknown>>(`/api/sessions/${sessionId}/package`),

  getSeriesPackage: (seriesId: string) =>
    request<Record<string, unknown>>(`/api/series/${seriesId}/package`),
};

export function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
