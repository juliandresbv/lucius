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
  assets: AssetInfo[],
  sessionBudget: number
): Promise<Recommendation[]> {
  const prompt = buildPrompt(profile, portfolio, balance, assets, sessionBudget)

  const msg = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  })

  const text = msg.content
    .filter((c) => c.type === "text")
    .map((c) => (c as { type: "text"; text: string }).text)
    .join("")

  return parseRecommendations(text, portfolio, balance.available, sessionBudget)
}

export function buildPrompt(
  profile: UserProfile,
  portfolio: PortfolioHolding[],
  balance: CheckingBalance,
  assets: AssetInfo[],
  sessionBudget: number
): string {
  const holdingsSummary =
    portfolio.length > 0
      ? portfolio
          .map((h) => {
            const base = `${h.symbol}: ${h.shares} shares @ $${h.currentPrice} = $${h.value}`
            if (h.avgPrice !== undefined) {
              const gainPct = ((h.currentPrice - h.avgPrice) / h.avgPrice) * 100
              const sign = gainPct >= 0 ? "+" : ""
              return `${base} (avg cost $${h.avgPrice.toFixed(2)}, ${sign}${gainPct.toFixed(1)}%)`
            }
            return base
          })
          .join("\n")
      : "No current holdings"

  const sellCandidates = portfolio
    .filter((h): h is PortfolioHolding & { avgPrice: number } => h.avgPrice !== undefined)
    .flatMap((h) => {
      const gainPct = ((h.currentPrice - h.avgPrice) / h.avgPrice) * 100
      if (gainPct >= profile.takeProfitThreshold) {
        return [`${h.symbol}: +${gainPct.toFixed(1)}% (above take-profit of ${profile.takeProfitThreshold}%) → SELL`]
      }
      if (gainPct <= -profile.stopLossThreshold) {
        return [`${h.symbol}: ${gainPct.toFixed(1)}% (below stop-loss of ${profile.stopLossThreshold}%) → SELL`]
      }
      return []
    })

  const assetsSummary = assets
    .slice(0, 10)
    .map(
      (a) =>
        `${a.symbol} (${a.name}): $${a.price}${a.dividendYield ? `, yield: ${a.dividendYield}%` : ""}`
    )
    .join("\n")

  const sellEvaluation =
    sellCandidates.length > 0
      ? `SELL CANDIDATES (holdings that have crossed a threshold — you MUST recommend SELL for these):\n${sellCandidates.map((c) => `- ${c}`).join("\n")}`
      : `No holdings have crossed take-profit (${profile.takeProfitThreshold}%) or stop-loss (${profile.stopLossThreshold}%) thresholds.`

  return `You are Vantage, an investment recommendation engine. Generate 2-3 specific investment recommendations.

USER PROFILE:
- Risk tolerance: ${profile.riskTolerance}
- Time horizon: ${profile.timeHorizon}
- Sectors of interest: ${profile.sectors.join(", ")}
- Expected annual return: ${(profile.expectedReturn * 100).toFixed(0)}%
- Take profit threshold: ${profile.takeProfitThreshold}%
- Stop loss threshold: ${profile.stopLossThreshold}%

CURRENT PORTFOLIO:
${holdingsSummary}

AVAILABLE BALANCE: $${balance.available}
SESSION BUDGET: $${sessionBudget}

AVAILABLE ASSETS:
${assetsSummary}

SELL EVALUATION:
${sellEvaluation}

RULES:
- Total of all BUY recommendations must not exceed $${sessionBudget}
- Minimum $1 per trade
- No single pick may exceed 60% of the session budget ($${Math.floor(sessionBudget * 0.6)})
- Only recommend BUY for assets from the AVAILABLE ASSETS list above
- You MUST include a SELL for every SELL CANDIDATE listed above
- You may also recommend SELL for other current holdings if strategically warranted
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
