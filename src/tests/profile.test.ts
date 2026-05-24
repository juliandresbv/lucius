// src/tests/profile.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest"
import { RETURN_BY_RISK } from "../storage/profile.js"

// Mock fs/promises to avoid disk writes in tests
vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
}))

describe("RETURN_BY_RISK", () => {
  it("returns 5% for conservative", () => {
    expect(RETURN_BY_RISK.conservative).toBe(0.05)
  })
  it("returns 7% for moderate", () => {
    expect(RETURN_BY_RISK.moderate).toBe(0.07)
  })
  it("returns 10% for aggressive", () => {
    expect(RETURN_BY_RISK.aggressive).toBe(0.10)
  })
})

describe("saveProfile", () => {
  it("derives expectedReturn from riskTolerance — never asks user", async () => {
    const { writeFile } = await import("node:fs/promises")
    vi.mocked(writeFile).mockResolvedValueOnce(undefined)

    const { saveProfile } = await import("../storage/profile.js")
    const profile = await saveProfile({
      riskTolerance: "moderate",
      monthlyBudget: 300,
      timeHorizon: "medium",
      sectors: ["Technology"],
      takeProfitThreshold: 20,
      stopLossThreshold: 15,
    })

    expect(profile.expectedReturn).toBe(0.07)
    expect(profile.createdAt).toBeTruthy()
  })
})

describe("loadProfile", () => {
  it("returns null when profile.json does not exist", async () => {
    const { readFile } = await import("node:fs/promises")
    vi.mocked(readFile).mockRejectedValueOnce(new Error("ENOENT"))

    const { loadProfile } = await import("../storage/profile.js")
    const result = await loadProfile()
    expect(result).toBeNull()
  })
})
