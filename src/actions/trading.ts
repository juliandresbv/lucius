// src/actions/trading.ts
import { wallbitApi } from "../wallbit/api.js"
import { getAssetDetail } from "./assets.js"
import { getCheckingBalance } from "./portfolio.js"
import { isSimMode, loadSimState, saveSimState, type SimTransaction } from "../storage/sim-state.js"

export function isDryRun(): boolean {
  return process.env.DRY_RUN === "true"
}

export interface TradeResult {
  simulated: false
  id: string
  symbol: string
  direction: "BUY" | "SELL"
  amount: number
  price: number
  fee: number
  status: string
  timestamp: string
}

export interface DryRunResult {
  simulated: true
  symbol: string
  direction: "BUY" | "SELL"
  amount: number
  estimatedPrice: number
  message: string
}

export interface SentinelPreview {
  symbol: string
  direction: "BUY" | "SELL"
  /** Optional override for what the display shows instead of `direction` (e.g. "DEPOSIT", "WITHDRAWAL") */
  operationLabel?: string
  amount: number
  estimatedPrice: number
  fee: number
  feeRate: number
  totalDeducted: number
  postTradeBalance: number
  withinBudget: boolean
  warnings: string[]
}

export interface OperationResult {
  simulated: false
  id: string
  type: string
  amount: number
  status: string
  timestamp: string
}

export interface DryRunOperationResult {
  simulated: true
  type: string
  amount: number
  message: string
}

export async function getSentinelPreview(
  symbol: string,
  direction: "BUY" | "SELL",
  amount: number
): Promise<SentinelPreview> {
  const [asset, balance, feeRes] = await Promise.all([
    getAssetDetail(symbol),
    getCheckingBalance(),
    wallbitApi
      .getFees({ type: "TRADE", symbol, direction, amount })
      .catch(() => ({
        tier: "LEVEL2",
        percentage: 0.35,
        fixed: 0,
        estimatedFee: amount * 0.0035,
      })),
  ])

  const fee = feeRes.estimatedFee
  const totalDeducted = direction === "BUY" ? amount + fee : 0
  const postTradeBalance =
    direction === "BUY"
      ? balance.available - totalDeducted
      : balance.available + amount - fee

  const warnings: string[] = []
  if (postTradeBalance < 10) {
    warnings.push("Post-trade balance will be below $10")
  }

  return {
    symbol,
    direction,
    amount,
    estimatedPrice: asset.price,
    fee,
    feeRate: feeRes.percentage,
    totalDeducted,
    postTradeBalance,
    withinBudget: true,
    warnings,
  }
}

export async function executeTrade(
  symbol: string,
  direction: "BUY" | "SELL",
  amount: number
): Promise<TradeResult | DryRunResult> {
  if (isSimMode()) {
    const [asset, feeRes] = await Promise.all([
      getAssetDetail(symbol),
      wallbitApi.getFees({ type: "TRADE", symbol, direction, amount }).catch(() => ({
        tier: "LEVEL2", percentage: 0.0035, fixed: 0, estimatedFee: amount * 0.0035,
      })),
    ])
    const fee = feeRes.estimatedFee
    const sim = await loadSimState()

    if (direction === "BUY") {
      const totalCost = amount + fee
      if (sim.balance < totalCost) {
        throw new Error(
          `Insufficient sim balance ($${sim.balance.toFixed(2)} available, need $${totalCost.toFixed(2)})`
        )
      }
      sim.balance -= totalCost
      const shares = amount / asset.price
      const existing = sim.holdings.find((h) => h.symbol === symbol)
      if (existing) {
        existing.avgPrice = (existing.avgPrice * existing.shares + amount) / (existing.shares + shares)
        existing.shares += shares
      } else {
        sim.holdings.push({ symbol, shares, avgPrice: asset.price })
      }
    } else {
      const shares = amount / asset.price
      const holding = sim.holdings.find((h) => h.symbol === symbol)
      if (!holding) throw new Error(`No sim holding for ${symbol}`)
      if (holding.shares < shares) {
        throw new Error(
          `Insufficient sim shares (have ${holding.shares.toFixed(4)}, need ${shares.toFixed(4)})`
        )
      }
      holding.shares -= shares
      if (holding.shares < 0.0001) sim.holdings = sim.holdings.filter((h) => h.symbol !== symbol)
      sim.balance += amount - fee
    }

    const tx: SimTransaction = {
      id: `sim-${Date.now()}`,
      type: direction,
      symbol,
      amount,
      shares: amount / asset.price,
      price: asset.price,
      fee,
      timestamp: new Date().toISOString(),
    }
    sim.transactions.push(tx)
    await saveSimState(sim)

    return {
      simulated: true,
      symbol,
      direction,
      amount,
      estimatedPrice: asset.price,
      message: "Paper trade recorded to sim ledger",
    }
  }

  if (isDryRun()) {
    const asset = await getAssetDetail(symbol)
    return {
      simulated: true,
      symbol,
      direction,
      amount,
      estimatedPrice: asset.price,
      message: "Dry run — no trade executed",
    }
  }

  const res = await wallbitApi.createTrade({
    symbol,
    direction,
    currency: "USD",
    order_type: "MARKET",
    amount,
  })

  return {
    simulated: false,
    id: res.id,
    symbol: res.symbol,
    direction: res.direction,
    amount: res.amount,
    price: res.price,
    fee: res.fee,
    status: res.status,
    timestamp: res.timestamp,
  }
}

export async function moveFunds(
  type: "DEPOSIT" | "WITHDRAWAL",
  amount: number
): Promise<OperationResult | DryRunOperationResult> {
  if (isSimMode()) {
    const sim = await loadSimState()
    if (type === "DEPOSIT") {
      sim.balance += amount
    } else {
      if (sim.balance < amount) {
        throw new Error(`Insufficient sim balance ($${sim.balance.toFixed(2)} available)`)
      }
      sim.balance -= amount
    }
    const tx: SimTransaction = {
      id: `sim-${Date.now()}`,
      type,
      amount,
      fee: 0,
      timestamp: new Date().toISOString(),
    }
    sim.transactions.push(tx)
    await saveSimState(sim)
    return { simulated: true, type, amount, message: `Simulated ${type} recorded to sim ledger` }
  }

  if (isDryRun()) {
    return {
      simulated: true,
      type,
      amount,
      message: "Dry run — no fund movement executed",
    }
  }

  const res = await wallbitApi.moveOperation({ type, amount })
  return {
    simulated: false,
    id: res.id,
    type: res.type,
    amount: res.amount,
    status: res.status,
    timestamp: res.timestamp,
  }
}
