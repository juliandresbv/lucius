import { describe, it, expect } from "vitest"
import { parseRecommendations, buildPrompt } from "../actions/recommendations.js"
import type { PortfolioHolding, CheckingBalance } from "../actions/portfolio.js"
import type { UserProfile } from "../storage/profile.js"
import type { AssetInfo } from "../actions/assets.js"

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

describe("buildPrompt", () => {
  const profile: UserProfile = {
    riskTolerance: "moderate",
    monthlyBudget: 500,   // intentionally different from sessionBudget
    timeHorizon: "medium",
    sectors: ["Technology"],
    takeProfitThreshold: 20,
    stopLossThreshold: 15,
    expectedReturn: 0.07,
    createdAt: "2026-01-01T00:00:00.000Z",
  }
  const balance: CheckingBalance = { available: 1000, currency: "USD" }
  const assets: AssetInfo[] = []

  it("contains SESSION BUDGET with the sessionBudget value", () => {
    const prompt = buildPrompt(profile, portfolio, balance, assets, 300)
    expect(prompt).toContain("SESSION BUDGET")
    expect(prompt).toContain("300")
  })

  it("does not contain Monthly budget label", () => {
    const prompt = buildPrompt(profile, portfolio, balance, assets, 300)
    expect(prompt).not.toContain("Monthly budget:")
  })

  it("contains 60% cap rule", () => {
    const prompt = buildPrompt(profile, portfolio, balance, assets, 300)
    expect(prompt).toContain("60%")
  })

  it("contains $1 minimum rule", () => {
    const prompt = buildPrompt(profile, portfolio, balance, assets, 300)
    expect(prompt).toContain("$1")
  })

  it("includes gain/loss % in holdings summary when avgPrice is present", () => {
    const portfolioWithAvg: PortfolioHolding[] = [
      { symbol: "AAPL", shares: 2, currentPrice: 216, value: 432, avgPrice: 180 },
    ]
    const prompt = buildPrompt(profile, portfolioWithAvg, balance, assets, 300)
    expect(prompt).toContain("+20.0%")
    expect(prompt).toContain("avg cost $180.00")
  })

  it("flags SELL CANDIDATES when holding exceeds take-profit threshold", () => {
    const portfolioWithAvg: PortfolioHolding[] = [
      { symbol: "AAPL", shares: 2, currentPrice: 216, value: 432, avgPrice: 180 },
    ]
    // takeProfitThreshold is 20, gainPct is exactly 20% → should flag
    const prompt = buildPrompt(profile, portfolioWithAvg, balance, assets, 300)
    expect(prompt).toContain("SELL CANDIDATES")
    expect(prompt).toContain("AAPL")
    expect(prompt).toContain("MUST recommend SELL")
  })

  it("omits SELL EVALUATION section when includeSell is false", () => {
    const prompt = buildPrompt(profile, portfolio, balance, assets, 300, { includeSell: false })
    expect(prompt).not.toContain("SELL EVALUATION")
    expect(prompt).not.toContain("MUST recommend SELL")
  })

  it("omits SESSION BUDGET and AVAILABLE ASSETS when includeBuy is false", () => {
    const prompt = buildPrompt(profile, portfolio, balance, assets, 300, { includeBuy: false })
    expect(prompt).not.toContain("SESSION BUDGET")
    expect(prompt).not.toContain("AVAILABLE ASSETS")
    expect(prompt).not.toContain("60%")
  })
})
