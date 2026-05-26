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
  isFullPosition?: boolean
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

  // ── sell evaluation — all holdings shown, threshold-crossers flagged ────
  const sellLines = portfolio.map((h) => {
    if (h.avgPrice !== undefined) {
      const gainPct = ((h.currentPrice - h.avgPrice) / h.avgPrice) * 100
      const sign = gainPct >= 0 ? "+" : ""
      const mandatory =
        gainPct >= profile.takeProfitThreshold || gainPct <= -profile.stopLossThreshold
      const tag = mandatory ? " → MUST SELL" : ""
      return `- ${h.symbol}: ${sign}${gainPct.toFixed(1)}% vs avg cost $${h.avgPrice.toFixed(2)}${tag}`
    }
    return `- ${h.symbol}: cost basis unavailable — evaluate for strategic SELL`
  })

  const hasMandatory = sellLines.some((l) => l.includes("MUST SELL"))

  const sellEvaluation =
    portfolio.length === 0
      ? "No current holdings."
      : `${sellLines.join("\n")}\n\n${
          hasMandatory
            ? "You MUST recommend SELL for all holdings marked → MUST SELL."
            : `No thresholds crossed (take-profit ${profile.takeProfitThreshold}%, stop-loss ${profile.stopLossThreshold}%). Evaluate holdings above and recommend SELL where strategically justified (e.g., overweight position, sector rebalance, better opportunity available).`
        }`

  const assetsSummary = assets
    .slice(0, 10)
    .map(
      (a) =>
        `${a.symbol} (${a.name}): $${a.price}${a.dividendYield ? `, yield: ${a.dividendYield}%` : ""}`
    )
    .join("\n")

  return `You are Vantage, an investment recommendation engine. Generate specific investment recommendations including both BUY and SELL actions where appropriate.

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
- No single BUY may exceed 60% of the session budget ($${Math.floor(sessionBudget * 0.6)})
- Only recommend BUY for assets from the AVAILABLE ASSETS list above
- You MUST include a SELL for every holding marked → MUST SELL above
- You SHOULD actively recommend SELL for other holdings when strategically justified
- For SELL, set amount to the holding's full position value (or a partial USD amount if selling only part)
- Match risk tolerance: conservative = stable/dividend stocks, moderate = mix, aggressive = growth
- Prefer sectors matching the user's interests

Respond ONLY with a JSON array (no markdown, no explanation):
[{"symbol":"JNJ","action":"SELL","amount":450,"rationale":"Brief rationale"},{"symbol":"AAPL","action":"BUY","amount":200,"rationale":"Brief rationale"}]`
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

    const portfolioMap = new Map(portfolio.map((h) => [h.symbol, h]))
    const sixtyPct = sessionBudget * 0.6

    const sells = parsed
      .filter((r) => r.action === "SELL" && portfolioMap.has(r.symbol))
      .map((r) => {
        const positionValue = portfolioMap.get(r.symbol)!.value
        const providedAmount = Number.isFinite(r.amount) && r.amount > 0
        const amount = providedAmount ? r.amount : positionValue
        const isFullPosition = Math.abs(amount - positionValue) < 0.01 ? true : undefined
        return { ...r, amount, isFullPosition }
      })

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
