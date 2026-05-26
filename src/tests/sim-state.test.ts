// src/tests/sim-state.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
}))

describe("isSimMode", () => {
  beforeEach(() => { vi.resetModules() })
  afterEach(() => { delete process.env.SIM_MODE })

  it("returns false by default", async () => {
    const { isSimMode } = await import("../storage/sim-state.js")
    expect(isSimMode()).toBe(false)
  })

  it("returns true when SIM_MODE=true", async () => {
    process.env.SIM_MODE = "true"
    const { isSimMode } = await import("../storage/sim-state.js")
    expect(isSimMode()).toBe(true)
  })
})

describe("loadSimState", () => {
  beforeEach(() => { vi.resetModules(); vi.clearAllMocks(); delete process.env.SIM_BALANCE })

  it("auto-creates fresh state when file does not exist", async () => {
    const { readFile, writeFile } = await import("node:fs/promises")
    vi.mocked(readFile).mockRejectedValueOnce(Object.assign(new Error("ENOENT: no such file"), { code: "ENOENT" }))
    vi.mocked(writeFile).mockResolvedValueOnce(undefined)

    const { loadSimState } = await import("../storage/sim-state.js")
    const state = await loadSimState()

    expect(state.balance).toBe(10000)
    expect(state.initialBalance).toBe(10000)
    expect(state.holdings).toEqual([])
    expect(state.transactions).toEqual([])
    expect(writeFile).toHaveBeenCalledOnce()
  })

  it("returns existing state when file exists", async () => {
    const { readFile } = await import("node:fs/promises")
    const existing = {
      balance: 8000, initialBalance: 10000,
      holdings: [{ symbol: "AAPL", shares: 1, avgPrice: 210 }],
      transactions: [], createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
    }
    vi.mocked(readFile).mockResolvedValueOnce(JSON.stringify(existing) as unknown as string & Uint8Array)

    const { loadSimState } = await import("../storage/sim-state.js")
    const state = await loadSimState()

    expect(state.balance).toBe(8000)
    expect(state.holdings[0].symbol).toBe("AAPL")
  })
})

describe("resetSimState", () => {
  beforeEach(() => { vi.resetModules(); vi.clearAllMocks() })

  it("resets balance to stored initialBalance, clears holdings and transactions", async () => {
    const { readFile, writeFile } = await import("node:fs/promises")
    const existing = {
      balance: 500, initialBalance: 10000,
      holdings: [{ symbol: "AAPL", shares: 1, avgPrice: 210 }],
      transactions: [{ id: "sim-1", type: "BUY", amount: 200, fee: 0.7, timestamp: "2026-01-01T00:00:00.000Z" }],
      createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
    }
    vi.mocked(readFile).mockResolvedValueOnce(JSON.stringify(existing) as unknown as string & Uint8Array)
    vi.mocked(writeFile).mockResolvedValueOnce(undefined)

    const { resetSimState } = await import("../storage/sim-state.js")
    const fresh = await resetSimState()

    expect(fresh.balance).toBe(10000)
    expect(fresh.holdings).toEqual([])
    expect(fresh.transactions).toEqual([])
  })

  it("resets to a new initialBalance when amount given", async () => {
    const { readFile, writeFile } = await import("node:fs/promises")
    vi.mocked(readFile).mockRejectedValueOnce(Object.assign(new Error("ENOENT: no such file"), { code: "ENOENT" }))
    vi.mocked(writeFile).mockResolvedValueOnce(undefined) // saveSimState from loadSimState (ENOENT path)
    vi.mocked(writeFile).mockResolvedValueOnce(undefined) // saveSimState from resetSimState

    const { resetSimState } = await import("../storage/sim-state.js")
    const fresh = await resetSimState(5000)

    expect(fresh.balance).toBe(5000)
    expect(fresh.initialBalance).toBe(5000)
  })
})
