import { describe, expect, it } from "vitest";
import {
  cycleMembership,
  membershipOf,
  normalizeEncoding,
} from "./descriptors";

describe("descriptor encoding", () => {
  it("drops unknown keys and zeros", () => {
    expect(normalizeEncoding({ water: 1, bogus: 1, land: 0 })).toEqual({
      water: 1,
    });
  });

  it("clamps partial membership", () => {
    expect(normalizeEncoding({ water: 0.7 })).toEqual({ water: 0.5 });
    expect(normalizeEncoding({ water: 1.8 })).toEqual({ water: 1 });
  });

  it("cycles 0, 1, 0.5", () => {
    expect(cycleMembership(0)).toBe(1);
    expect(cycleMembership(1)).toBe(0.5);
    expect(cycleMembership(0.5)).toBe(0);
  });

  it("reads membership from a sparse map", () => {
    expect(membershipOf({ water: 1 }, "water")).toBe(1);
    expect(membershipOf({}, "water")).toBe(0);
  });
});
