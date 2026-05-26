import { describe, it, expect } from "vitest"
import { parseRecommendations } from "../actions/recommendations.js"
import type { PortfolioHolding } from "../actions/portfolio.js"

const portfolio: PortfolioHolding[] = [
  { symbol: "AAPL", shares: 2, currentPrice: 180, value: 360 },
]

describe("parseRecommendations", () => {
  it("returns [] on malformed JSON", () => {
    expect(parseRecommendations("not json", portfolio, 1000, 300)).toEqual([])
  })

  it("drops HOLD entries", () => {
    const text = JSON.stringify([
      { symbol: "AAPL", action: "HOLD", amount: 100, rationale: "hold" },
    ])
    expect(parseRecommendations(text, portfolio, 1000, 300)).toEqual([])
  })

  it("filters out SELLs for symbols not in portfolio", () => {
    const text = JSON.stringify([
      { symbol: "MSFT", action: "SELL", amount: 100, rationale: "sell" },
    ])
    expect(parseRecommendations(text, portfolio, 1000, 300)).toEqual([])
  })

  it("keeps SELLs for symbols in portfolio", () => {
    const text = JSON.stringify([
      { symbol: "AAPL", action: "SELL", amount: 100, rationale: "sell" },
    ])
    const result = parseRecommendations(text, portfolio, 1000, 300)
    expect(result).toHaveLength(1)
    expect(result[0].symbol).toBe("AAPL")
    expect(result[0].action).toBe("SELL")
  })

  it("filters out BUYs with amount < 1", () => {
    const text = JSON.stringify([
      { symbol: "VOO", action: "BUY", amount: 0.5, rationale: "buy" },
    ])
    expect(parseRecommendations(text, portfolio, 1000, 300)).toEqual([])
  })

  it("filters out BUYs where amount > sessionBudget * 0.6", () => {
    // sessionBudget=300, 60%=180, amount 200 > 180 → dropped
    const text = JSON.stringify([
      { symbol: "VOO", action: "BUY", amount: 200, rationale: "buy" },
    ])
    expect(parseRecommendations(text, portfolio, 1000, 300)).toEqual([])
  })

  it("drops second BUY when cumulative cap exceeded", () => {
    const text = JSON.stringify([
      { symbol: "VOO", action: "BUY", amount: 150, rationale: "first" },
      { symbol: "MSFT", action: "BUY", amount: 160, rationale: "second" },
    ])
    // remaining after first: 300-150=150. second (160) > 150 → dropped
    const result = parseRecommendations(text, portfolio, 1000, 300)
    expect(result).toHaveLength(1)
    expect(result[0].symbol).toBe("VOO")
  })

  it("uses min(availableBalance, sessionBudget) as cumulative cap", () => {
    // availableBalance=50 < sessionBudget=300 → cap=50, amount 100 > 50 → dropped
    const text = JSON.stringify([
      { symbol: "VOO", action: "BUY", amount: 100, rationale: "buy" },
    ])
    expect(parseRecommendations(text, portfolio, 50, 300)).toEqual([])
  })

  it("returns SELLs before BUYs", () => {
    const text = JSON.stringify([
      { symbol: "VOO", action: "BUY", amount: 100, rationale: "buy" },
      { symbol: "AAPL", action: "SELL", amount: 100, rationale: "sell" },
    ])
    const result = parseRecommendations(text, portfolio, 1000, 300)
    expect(result[0].action).toBe("SELL")
    expect(result[1].action).toBe("BUY")
  })
})
