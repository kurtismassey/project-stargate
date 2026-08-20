import { describe, expect, it } from "vitest";
import { deskNeedsUnlock, HealthData } from "./api";

const base: HealthData = {
  status: "ok",
  aiEnabled: false,
  labKeyRequired: false,
  operatorAuthRequired: false,
};

describe("deskNeedsUnlock", () => {
  it("stays open when neither gate is armed", () => {
    expect(deskNeedsUnlock(base)).toBe(false);
  });

  it("locks when a passphrase exists and no credentials are stored", () => {
    expect(deskNeedsUnlock({ ...base, operatorAuthRequired: true })).toBe(true);
  });

  it("locks when a lab key is required and no credentials are stored", () => {
    expect(deskNeedsUnlock({ ...base, labKeyRequired: true })).toBe(true);
  });
});
