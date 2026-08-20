import { describe, expect, it } from "vitest";
import {
  canAdvanceStage,
  canRecord,
  EventView,
  openAol,
  stageOneComplete,
} from "./protocol";

const trio: EventView[] = [
  { kind: "ideogram", stage: 1 },
  { kind: "ideogram_a", stage: 1 },
  { kind: "ideogram_b", stage: 1 },
];

describe("stage gating", () => {
  it("refuses Stage II objectification before the Stage I ideogram exists", () => {
    expect(canRecord("crv", 1, "sensory", [])).toBe(false);
  });

  it("allows the ideogram in Stage I", () => {
    expect(canRecord("crv", 1, "ideogram", [])).toBe(true);
  });

  it("enforces ideogram decode order", () => {
    expect(canRecord("crv", 1, "ideogram_a", [])).toBe(false);
    expect(
      canRecord("crv", 1, "ideogram_a", [{ kind: "ideogram", stage: 1 }]),
    ).toBe(true);
    expect(
      canRecord("crv", 1, "ideogram_b", [{ kind: "ideogram", stage: 1 }]),
    ).toBe(false);
  });

  it("refuses later-stage matrix content in Stage II", () => {
    expect(canRecord("crv", 2, "intangible", trio)).toBe(false);
    expect(canRecord("crv", 2, "sensory", trio)).toBe(true);
  });

  it("opens Stage IV matrix columns only in Stage IV and later", () => {
    expect(canRecord("crv", 4, "intangible", trio)).toBe(true);
    expect(canRecord("crv", 4, "emotional_impact", trio)).toBe(true);
  });
});

describe("stage advancement", () => {
  it("blocks advance until the ideogram trio is complete", () => {
    expect(canAdvanceStage(1, [])).toBe(false);
    expect(canAdvanceStage(1, trio.slice(0, 2))).toBe(false);
    expect(canAdvanceStage(1, trio)).toBe(true);
  });

  it("requires the trio in order", () => {
    const outOfOrder: EventView[] = [
      { kind: "ideogram_b", stage: 1 },
      { kind: "ideogram_a", stage: 1 },
      { kind: "ideogram", stage: 1 },
    ];
    expect(stageOneComplete(outOfOrder)).toBe(false);
  });

  it("requires stage structure before advancing later stages", () => {
    expect(canAdvanceStage(2, trio)).toBe(false);
    expect(
      canAdvanceStage(2, [...trio, { kind: "sensory", stage: 2 }]),
    ).toBe(true);
  });

  it("never advances past Stage VI", () => {
    expect(canAdvanceStage(6, trio)).toBe(false);
  });

  it("blocks advance while an AOL is open", () => {
    expect(canAdvanceStage(1, [...trio, { kind: "aol", stage: 1 }])).toBe(
      false,
    );
  });
});

describe("AOL gating", () => {
  it("tracks open AOL declarations", () => {
    expect(openAol([{ kind: "aol", stage: 1 }])).toBe(true);
    expect(
      openAol([
        { kind: "aol", stage: 1 },
        { kind: "aol_break", stage: 1 },
      ]),
    ).toBe(false);
  });

  it("refuses signal entries while an AOL is open", () => {
    const events: EventView[] = [...trio, { kind: "aol", stage: 1 }];
    expect(canRecord("crv", 1, "ideogram", events)).toBe(false);
    expect(canRecord("crv", 1, "aol_break", events)).toBe(true);
  });

  it("reopens the signal line after the AOL break", () => {
    const events: EventView[] = [
      ...trio,
      { kind: "aol", stage: 1 },
      { kind: "aol_break", stage: 1 },
    ];
    expect(canRecord("crv", 1, "ideogram", events)).toBe(true);
  });

  it("always allows declaring AOL and breaks", () => {
    for (const stage of [1, 2, 3, 4, 5, 6]) {
      expect(canRecord("crv", stage, "aol", [])).toBe(true);
      expect(canRecord("crv", stage, "break", [])).toBe(true);
      expect(canRecord("crv", stage, "viewer_note", [])).toBe(true);
    }
  });
});

describe("ERV variant", () => {
  it("has no stage gating for its vocabulary", () => {
    expect(canRecord("erv", null, "sensory", [])).toBe(true);
    expect(canRecord("erv", null, "sketch", [])).toBe(true);
  });

  it("refuses CRV structure kinds", () => {
    expect(canRecord("erv", null, "ideogram", [])).toBe(false);
  });

  it("still gates on open AOL", () => {
    expect(canRecord("erv", null, "sensory", [{ kind: "aol", stage: null }])).toBe(
      false,
    );
  });
});
