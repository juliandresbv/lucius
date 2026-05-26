import { describe, it, expect } from "vitest"
import { computeAvgPricesFromTransactions } from "../actions/history.js"
import type { Transaction } from "../wallbit/types.js"

function tx(
  overrides: Partial<Transaction> & { symbol: string; amount: number; price: number; direction: string }
): Transaction {
  return {
    id: Math.random().toString(),
    type: "TRADE",
    status: "EXECUTED",
    timestamp: "2026-01-01T00:00:00Z",
    ...overrides,
  }
}

describe("computeAvgPricesFromTransactions", () => {
  it("returns empty object for no transactions", () => {
    expect(computeAvgPricesFromTransactions([])).toEqual({})
  })

  it("computes avgPrice for a single BUY", () => {
    const result = computeAvgPricesFromTransactions([
      tx({ symbol: "AAPL", amount: 180, price: 180, direction: "BUY" }),
    ])
    expect(result.AAPL).toBeCloseTo(180)
  })

  it("computes weighted average for multiple BUYs", () => {
    // 1 share @ $150 + 1 share @ $170 → 2 shares, avg = $160
    const result = computeAvgPricesFromTransactions([
      tx({ symbol: "AAPL", amount: 150, price: 150, direction: "BUY", timestamp: "2026-01-01T00:00:00Z" }),
      tx({ symbol: "AAPL", amount: 170, price: 170, direction: "BUY", timestamp: "2026-01-02T00:00:00Z" }),
    ])
    expect(result.AAPL).toBeCloseTo(160)
  })

  it("preserves avgPrice after a partial SELL", () => {
    // Buy 2 shares @ $150 each, sell 1 @ $180 — avg cost stays $150
    const result = computeAvgPricesFromTransactions([
      tx({ symbol: "AAPL", amount: 300, price: 150, direction: "BUY",  timestamp: "2026-01-01T00:00:00Z" }),
      tx({ symbol: "AAPL", amount: 180, price: 180, direction: "SELL", timestamp: "2026-01-02T00:00:00Z" }),
    ])
    expect(result.AAPL).toBeCloseTo(150)
  })

  it("removes symbol after a full SELL", () => {
    const result = computeAvgPricesFromTransactions([
      tx({ symbol: "AAPL", amount: 150, price: 150, direction: "BUY",  timestamp: "2026-01-01T00:00:00Z" }),
      tx({ symbol: "AAPL", amount: 200, price: 200, direction: "SELL", timestamp: "2026-01-02T00:00:00Z" }),
    ])
    expect(result.AAPL).toBeUndefined()
  })

  it("handles multiple symbols independently", () => {
    const result = computeAvgPricesFromTransactions([
      tx({ symbol: "AAPL", amount: 150, price: 150, direction: "BUY" }),
      tx({ symbol: "MSFT", amount: 300, price: 300, direction: "BUY" }),
    ])
    expect(result.AAPL).toBeCloseTo(150)
    expect(result.MSFT).toBeCloseTo(300)
  })

  it("skips transactions with missing price", () => {
    const result = computeAvgPricesFromTransactions([
      { id: "1", type: "TRADE", symbol: "AAPL", amount: 150, price: undefined, direction: "BUY", timestamp: "2026-01-01T00:00:00Z", status: "EXECUTED" },
    ])
    expect(result).toEqual({})
  })

  it("resets basis after full sell so a later rebuy starts fresh", () => {
    // Buy @ $150, sell all @ $200, rebuy @ $220 → avgPrice should be $220, not blended with $150
    const result = computeAvgPricesFromTransactions([
      tx({ symbol: "AAPL", amount: 150, price: 150, direction: "BUY",  timestamp: "2026-01-01T00:00:00Z" }),
      tx({ symbol: "AAPL", amount: 200, price: 200, direction: "SELL", timestamp: "2026-01-02T00:00:00Z" }),
      tx({ symbol: "AAPL", amount: 220, price: 220, direction: "BUY",  timestamp: "2026-01-03T00:00:00Z" }),
    ])
    expect(result.AAPL).toBeCloseTo(220)
  })
})
