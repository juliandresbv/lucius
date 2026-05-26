// src/actions/portfolio.ts
import { wallbitApi } from "../wallbit/api.js"
import { loadProfile } from "../storage/profile.js"
import { WallbitError } from "../wallbit/types.js"
import { isSimMode, loadSimState } from "../storage/sim-state.js"
import { getAssetDetail } from "./assets.js"

export interface CheckingBalance {
  available: number
  currency: "USD"
}

export interface PortfolioHolding {
  symbol: string
  shares: number
  currentPrice: number
  value: number
  name?: string
  avgPrice?: number  // available in sim mode; undefined for real Wallbit holdings
}

export interface RoboPortfolio {
  chests: { name: string; balance: number; allocation: number }[]
  totalBalance: number
  dailyVariation: number
  allocation: Record<string, number>
}

export interface PortfolioProjection {
  monthlyBudget: number
  timeHorizon: "short" | "medium" | "long"
  projectedValue: number
  onTrack: boolean
}

export async function getCheckingBalance(): Promise<CheckingBalance> {
  if (isSimMode()) {
    const sim = await loadSimState()
    return { available: sim.balance, currency: "USD" }
  }
  const res = await wallbitApi.getCheckingBalance()
  if (Array.isArray(res)) return { available: 0, currency: "USD" }
  return { available: (res as { available: number }).available ?? 0, currency: "USD" }
}

export async function getStockPortfolio(): Promise<PortfolioHolding[]> {
  if (isSimMode()) {
    const sim = await loadSimState()
    return Promise.all(
      sim.holdings.map(async (h) => {
        const detail = await getAssetDetail(h.symbol).catch(() => null)
        const currentPrice = detail?.price ?? h.avgPrice
        return { symbol: h.symbol, shares: h.shares, currentPrice, value: h.shares * currentPrice, avgPrice: h.avgPrice }
      })
    )
  }
  const res = await wallbitApi.getStockPortfolio()
  return (res.holdings ?? []).map((h) => ({
    symbol: h.symbol, shares: h.shares, currentPrice: h.currentPrice, value: h.value, name: h.name,
  }))
}

export async function getRoboAdvisorPortfolio(): Promise<RoboPortfolio | null> {
  try {
    const res = await wallbitApi.getRoboAdvisorBalance()
    return {
      chests: res.chests ?? [],
      totalBalance: res.totalBalance,
      dailyVariation: res.dailyVariation,
      allocation: res.allocation ?? {},
    }
  } catch (err) {
    // Endpoint requires funded robo account — return null gracefully
    if (err instanceof WallbitError && (err.code === 403 || err.code === 404)) {
      return null
    }
    throw err
  }
}

export async function getPortfolioProjection(): Promise<PortfolioProjection> {
  const profile = await loadProfile()
  if (!profile) throw new Error("No profile found — run onboarding first")

  const { monthlyBudget, timeHorizon, expectedReturn } = profile

  const horizonYears: Record<typeof timeHorizon, number> = {
    short: 1.5,
    medium: 4.5,
    long: 10,
  }

  const n = horizonYears[timeHorizon]
  const r = expectedReturn / 12 // monthly rate
  const months = n * 12

  // Future value of monthly annuity: PMT * [(1+r)^n - 1] / r
  const projectedValue =
    r === 0
      ? monthlyBudget * months
      : monthlyBudget * ((Math.pow(1 + r, months) - 1) / r)

  const holdings = await getStockPortfolio().catch(() => [])
  const onTrack = holdings.length > 0 || monthlyBudget > 0

  return {
    monthlyBudget,
    timeHorizon,
    projectedValue: Math.round(projectedValue),
    onTrack,
  }
}
