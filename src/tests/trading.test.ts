// src/tests/trading.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { wallbitApi } from "../wallbit/api.js"
import { getAssetDetail } from "../actions/assets.js"
import { getCheckingBalance } from "../actions/portfolio.js"
import { isDryRun, executeTrade } from "../actions/trading.js"

vi.mock("../wallbit/api.js", () => ({
  wallbitApi: {
    getFees: vi.fn(),
    createTrade: vi.fn(),
    moveOperation: vi.fn(),
  },
}))

vi.mock("../actions/assets.js", () => ({
  getAssetDetail: vi.fn(),
}))

vi.mock("../actions/portfolio.js", () => ({
  getCheckingBalance: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
  delete process.env.DRY_RUN
})

afterEach(() => {
  delete process.env.DRY_RUN
})

describe("isDryRun", () => {
  it("returns false by default", () => {
    expect(isDryRun()).toBe(false)
  })

  it("returns true when DRY_RUN=true", () => {
    process.env.DRY_RUN = "true"
    expect(isDryRun()).toBe(true)
  })
})

describe("executeTrade — dry-run mode", () => {
  it("returns simulated result without calling API when DRY_RUN=true", async () => {
    process.env.DRY_RUN = "true"
    vi.mocked(getAssetDetail).mockResolvedValueOnce({
      symbol: "AAPL",
      name: "Apple",
      price: 213.32,
      sector: "Technology",
    })

    const result = await executeTrade("AAPL", "BUY", 200)
    expect(result.simulated).toBe(true)
    expect(wallbitApi.createTrade).not.toHaveBeenCalled()
    if (result.simulated) {
      expect(result.symbol).toBe("AAPL")
      expect(result.amount).toBe(200)
    }
  })
})
