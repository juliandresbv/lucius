// src/actions/recommendations.ts
import Anthropic from "@anthropic-ai/sdk"
import type { UserProfile } from "../storage/profile.js"
import type { PortfolioHolding, CheckingBalance } from "./portfolio.js"
import type { AssetInfo } from "./assets.js"

const anthropic = new Anthropic()

export interface Recommendation {
  symbol: string
  action: "BUY" | "SELL" | "HOLD"
  amount: number
  rationale: string
}

export async function getRecommendations(
  profile: UserProfile,
  portfolio: PortfolioHolding[],
  balance: CheckingBalance,
  assets: AssetInfo[]
): Promise<Recommendation[]> {
  const prompt = buildPrompt(profile, portfolio, balance, assets)

  const msg = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  })

  const text = msg.content
    .filter((c) => c.type === "text")
    .map((c) => (c as { type: "text"; text: string }).text)
    .join("")

  return parseRecommendations(text, portfolio, balance.available, profile.monthlyBudget)
}

function buildPrompt(
  profile: UserProfile,
  portfolio: PortfolioHolding[],
  balance: CheckingBalance,
  assets: AssetInfo[]
): string {
  const holdingsSummary =
    portfolio.length > 0
      ? portfolio
          .map(
            (h) =>
              `${h.symbol}: ${h.shares} shares @ $${h.currentPrice} = $${h.value}`
          )
          .join("\n")
      : "No current holdings"

  const assetsSummary = assets
    .slice(0, 10)
    .map(
      (a) =>
        `${a.symbol} (${a.name}): $${a.price}${a.dividendYield ? `, yield: ${a.dividendYield}%` : ""}`
    )
    .join("\n")

  const maxSpend = Math.min(balance.available, profile.monthlyBudget)

  return `You are Vantage, an investment recommendation engine. Generate 2-3 specific investment recommendations.

USER PROFILE:
- Risk tolerance: ${profile.riskTolerance}
- Monthly budget: $${profile.monthlyBudget}
- Time horizon: ${profile.timeHorizon}
- Sectors of interest: ${profile.sectors.join(", ")}
- Expected annual return: ${(profile.expectedReturn * 100).toFixed(0)}%
- Take profit threshold: ${profile.takeProfitThreshold}%
- Stop loss threshold: ${profile.stopLossThreshold}%

CURRENT PORTFOLIO:
${holdingsSummary}

AVAILABLE BALANCE: $${balance.available}
MAXIMUM TO INVEST THIS SESSION: $${maxSpend}

AVAILABLE ASSETS:
${assetsSummary}

RULES:
- Total of all recommendations must not exceed $${maxSpend}
- Each amount must be a round number (multiple of $10, minimum $10)
- Only recommend BUY for assets from the AVAILABLE ASSETS list above
- Match risk tolerance: conservative = stable/dividend stocks, moderate = mix, aggressive = growth
- Prefer sectors matching the user's interests

Respond ONLY with a JSON array (no markdown, no explanation):
[{"symbol":"AAPL","action":"BUY","amount":200,"rationale":"Brief rationale in plain language"}]`
}

export function parseRecommendations(
  text: string,
  portfolio: PortfolioHolding[],
  availableBalance: number,
  sessionBudget: number
): Recommendation[] {
  try {
    const jsonMatch = text.match(/\[[\s\S]*?\]/)
    if (!jsonMatch) return []
    const parsed = JSON.parse(jsonMatch[0]) as Recommendation[]

    const portfolioSymbols = new Set(portfolio.map((h) => h.symbol))
    const sixtyPct = sessionBudget * 0.6

    const sells = parsed.filter(
      (r) => r.action === "SELL" && portfolioSymbols.has(r.symbol)
    )

    const maxSpend = Math.min(availableBalance, sessionBudget)
    let remaining = maxSpend
    const buys: Recommendation[] = []
    for (const r of parsed) {
      if (r.action !== "BUY") continue
      if (r.amount < 1) continue
      if (r.amount > sixtyPct) continue
      if (r.amount > remaining) continue
      remaining -= r.amount
      buys.push(r)
    }

    return [...sells, ...buys]
  } catch {
    return []
  }
}
