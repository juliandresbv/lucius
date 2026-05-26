// src/tests/sim-trading.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest"
import { executeTrade, moveFunds } from "../actions/trading.js"
import * as simState from "../storage/sim-state.js"
import type { SimState } from "../storage/sim-state.js"
import { wallbitApi } from "../wallbit/api.js"
import { getAssetDetail } from "../actions/assets.js"

vi.mock("../wallbit/api.js", () => ({
  wallbitApi: { getFees: vi.fn(), createTrade: vi.fn(), moveOperation: vi.fn() },
}))
vi.mock("../actions/assets.js", () => ({ getAssetDetail: vi.fn() }))
vi.mock("../actions/portfolio.js", () => ({ getCheckingBalance: vi.fn() }))
vi.mock("../storage/sim-state.js", () => ({
  isSimMode: vi.fn(),
  loadSimState: vi.fn(),
  saveSimState: vi.fn().mockResolvedValue(undefined),
}))

const freshSim = (): SimState => ({
  balance: 10000, initialBalance: 10000, holdings: [], transactions: [],
  createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
})

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(simState.isSimMode).mockReturnValue(true)
  vi.mocked(simState.saveSimState).mockResolvedValue(undefined)
  vi.mocked(getAssetDetail).mockResolvedValue({ symbol: "AAPL", name: "Apple", price: 200, sector: "Tech" })
  vi.mocked(wallbitApi.getFees).mockResolvedValue({ tier: "LEVEL2", percentage: 0.0035, fixed: 0, estimatedFee: 0.70 })
})

describe("executeTrade — sim mode BUY", () => {
  it("deducts totalCost from balance, creates holding, records transaction", async () => {
    const sim = freshSim()
    vi.mocked(simState.loadSimState).mockResolvedValue(sim)

    const result = await executeTrade("AAPL", "BUY", 200)

    expect(result.simulated).toBe(true)
    expect(sim.balance).toBeCloseTo(10000 - 200 - 0.70)
    expect(sim.holdings).toHaveLength(1)
    expect(sim.holdings[0].symbol).toBe("AAPL")
    expect(sim.holdings[0].shares).toBeCloseTo(1)      // 200 / 200
    expect(sim.transactions).toHaveLength(1)
    expect(sim.transactions[0].type).toBe("BUY")
    expect(simState.saveSimState).toHaveBeenCalledWith(sim)
    expect(wallbitApi.createTrade).not.toHaveBeenCalled()
  })

  it("throws Insufficient sim balance when balance is too low", async () => {
    vi.mocked(simState.loadSimState).mockResolvedValue({ ...freshSim(), balance: 50 })

    await expect(executeTrade("AAPL", "BUY", 200)).rejects.toThrow("Insufficient sim balance")
    expect(simState.saveSimState).not.toHaveBeenCalled()
  })

  it("merges holding with weighted avg price on second BUY of same symbol", async () => {
    const sim = {
      ...freshSim(),
      balance: 9000,
      holdings: [{ symbol: "AAPL", shares: 1, avgPrice: 180 }],
    }
    vi.mocked(simState.loadSimState).mockResolvedValue(sim)

    await executeTrade("AAPL", "BUY", 200)   // 1 more share at $200

    expect(sim.holdings).toHaveLength(1)
    expect(sim.holdings[0].shares).toBeCloseTo(2)
    expect(sim.holdings[0].avgPrice).toBeCloseTo((180 * 1 + 200) / 2)  // 190
  })
})

describe("executeTrade — sim mode SELL", () => {
  it("credits balance minus fee, reduces holding", async () => {
    const sim = {
      ...freshSim(),
      balance: 8000,
      holdings: [{ symbol: "AAPL", shares: 2, avgPrice: 200 }],
    }
    vi.mocked(simState.loadSimState).mockResolvedValue(sim)
    vi.mocked(wallbitApi.getFees).mockResolvedValue({ tier: "LEVEL2", percentage: 0.0035, fixed: 0, estimatedFee: 0.35 })

    const result = await executeTrade("AAPL", "SELL", 100)

    expect(result.simulated).toBe(true)
    expect(sim.balance).toBeCloseTo(8000 + 100 - 0.35)
    expect(sim.holdings[0].shares).toBeCloseTo(2 - 0.5)   // sold 100/200 = 0.5 shares
  })

  it("throws when no holding exists for symbol", async () => {
    vi.mocked(simState.loadSimState).mockResolvedValue(freshSim())

    await expect(executeTrade("GOOGL", "SELL", 100)).rejects.toThrow("No sim holding for GOOGL")
  })

  it("removes holding when shares reach zero", async () => {
    const sim = {
      ...freshSim(),
      holdings: [{ symbol: "AAPL", shares: 1, avgPrice: 200 }],
    }
    vi.mocked(simState.loadSimState).mockResolvedValue(sim)
    vi.mocked(wallbitApi.getFees).mockResolvedValue({ tier: "LEVEL2", percentage: 0.0035, fixed: 0, estimatedFee: 0.70 })

    await executeTrade("AAPL", "SELL", 200)   // sell full share value

    expect(sim.holdings).toHaveLength(0)
  })
})

describe("moveFunds — sim mode", () => {
  it("DEPOSIT: adds amount to balance and records transaction", async () => {
    const sim = freshSim()
    vi.mocked(simState.loadSimState).mockResolvedValue(sim)

    const result = await moveFunds("DEPOSIT", 500)

    expect(result.simulated).toBe(true)
    expect(sim.balance).toBe(10500)
    expect(sim.transactions[0].type).toBe("DEPOSIT")
    expect(wallbitApi.moveOperation).not.toHaveBeenCalled()
  })

  it("WITHDRAWAL: deducts amount from balance", async () => {
    const sim = freshSim()
    vi.mocked(simState.loadSimState).mockResolvedValue(sim)

    await moveFunds("WITHDRAWAL", 1000)

    expect(sim.balance).toBe(9000)
  })

  it("WITHDRAWAL: throws when balance is insufficient", async () => {
    vi.mocked(simState.loadSimState).mockResolvedValue({ ...freshSim(), balance: 100 })

    await expect(moveFunds("WITHDRAWAL", 500)).rejects.toThrow("Insufficient sim balance")
    expect(simState.saveSimState).not.toHaveBeenCalled()
  })
})
