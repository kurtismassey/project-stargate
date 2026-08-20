/**
 * CRV protocol rules, mirrored from backend/services/protocol.py.
 *
 * The backend is authoritative. This mirror exists so the chamber can
 * gate its own controls without a round trip, and so protocol gating is
 * testable in the frontend suite.
 */

export type EventKind =
  | "cue"
  | "ideogram"
  | "ideogram_a"
  | "ideogram_b"
  | "sensory"
  | "dimensional"
  | "aesthetic_impact"
  | "emotional_impact"
  | "tangible"
  | "intangible"
  | "aol"
  | "aol_break"
  | "aol_signal"
  | "sketch"
  | "monitor_prompt"
  | "viewer_note"
  | "break"
  | "stage_advance"
  | "lock"
  | "feedback_view";

export type Protocol = "crv" | "erv" | "arv" | "wrv";

export interface EventView {
  kind: EventKind;
  stage: number | null;
}

export const ALWAYS_ALLOWED: ReadonlySet<EventKind> = new Set([
  "aol",
  "aol_break",
  "break",
  "monitor_prompt",
  "viewer_note",
]);

export const SIGNAL_KINDS: ReadonlySet<EventKind> = new Set([
  "ideogram",
  "ideogram_a",
  "ideogram_b",
  "sensory",
  "dimensional",
  "aesthetic_impact",
  "emotional_impact",
  "tangible",
  "intangible",
  "aol_signal",
  "sketch",
]);

export const CRV_STAGE_ALLOWED: Record<number, ReadonlySet<EventKind>> = {
  1: new Set(["ideogram", "ideogram_a", "ideogram_b"]),
  2: new Set(["sensory", "aesthetic_impact", "sketch"]),
  3: new Set(["dimensional", "aesthetic_impact", "sketch"]),
  4: new Set([
    "sensory",
    "dimensional",
    "aesthetic_impact",
    "emotional_impact",
    "tangible",
    "intangible",
    "aol_signal",
    "sketch",
  ]),
  5: new Set(["sensory", "dimensional", "tangible", "intangible", "sketch"]),
  6: new Set(["dimensional", "tangible", "intangible", "sketch"]),
};

export const ERV_ALLOWED: ReadonlySet<EventKind> = new Set([
  "sensory",
  "dimensional",
  "emotional_impact",
  "sketch",
]);

const STAGE_ADVANCE_REQUIREMENT: Record<number, ReadonlySet<EventKind>> = {
  2: new Set(["sensory"]),
  3: new Set(["dimensional", "sketch"]),
  4: new Set([
    "sensory",
    "dimensional",
    "aesthetic_impact",
    "emotional_impact",
    "tangible",
    "intangible",
    "aol_signal",
  ]),
  5: new Set(["tangible", "intangible"]),
};

export function openAol(events: EventView[]): boolean {
  for (let i = events.length - 1; i >= 0; i--) {
    if (events[i].kind === "aol_break") return false;
    if (events[i].kind === "aol") return true;
  }
  return false;
}

export function stageOneComplete(events: EventView[]): boolean {
  const want: EventKind[] = ["ideogram", "ideogram_a", "ideogram_b"];
  let idx = 0;
  for (const event of events) {
    if (event.stage === 1 && event.kind === want[idx]) {
      idx += 1;
      if (idx === want.length) return true;
    }
  }
  return false;
}

export function canAdvanceStage(
  currentStage: number,
  events: EventView[],
): boolean {
  if (currentStage >= 6) return false;
  if (openAol(events)) return false;
  if (currentStage === 1) return stageOneComplete(events);
  const required = STAGE_ADVANCE_REQUIREMENT[currentStage];
  return events.some(
    (event) => event.stage === currentStage && required.has(event.kind),
  );
}

function hasStageEvent(
  events: EventView[],
  stage: number,
  kind: EventKind,
): boolean {
  return events.some((event) => event.stage === stage && event.kind === kind);
}

/** Whether an event of this kind may be recorded right now. */
export function canRecord(
  protocol: Protocol,
  currentStage: number | null,
  kind: EventKind,
  events: EventView[],
): boolean {
  if (ALWAYS_ALLOWED.has(kind)) return true;
  if (SIGNAL_KINDS.has(kind) && openAol(events)) return false;

  if (protocol === "erv") return ERV_ALLOWED.has(kind);
  if (protocol !== "crv") return false;

  if (currentStage === null || !(currentStage in CRV_STAGE_ALLOWED)) {
    return false;
  }
  if (!CRV_STAGE_ALLOWED[currentStage].has(kind)) return false;

  if (kind === "ideogram_a" && !hasStageEvent(events, 1, "ideogram")) {
    return false;
  }
  if (kind === "ideogram_b" && !hasStageEvent(events, 1, "ideogram_a")) {
    return false;
  }
  return true;
}

export const STAGE_ROMAN: Record<number, string> = {
  1: "I",
  2: "II",
  3: "III",
  4: "IV",
  5: "V",
  6: "VI",
};

export const STAGE_TITLES: Record<number, string> = {
  1: "Ideogram",
  2: "Sensory",
  3: "Dimension",
  4: "Matrix",
  5: "Interrogation",
  6: "Rendering",
};

export const KIND_LABELS: Partial<Record<EventKind, string>> = {
  ideogram: "Ideogram",
  ideogram_a: "A component",
  ideogram_b: "B component",
  sensory: "Sensory",
  dimensional: "Dimensional",
  aesthetic_impact: "Aesthetic impact",
  emotional_impact: "Emotional impact",
  tangible: "Tangible",
  intangible: "Intangible",
  aol_signal: "AOL / signal",
  sketch: "Sketch",
  aol: "AOL",
  aol_break: "AOL break",
  viewer_note: "Note",
  break: "Break",
  monitor_prompt: "Monitor",
  cue: "Cue",
  stage_advance: "Stage advance",
  lock: "Lock",
  feedback_view: "Feedback",
};
