// src/actions/trading.ts
import { wallbitApi } from "../wallbit/api.js"
import { getAssetDetail } from "./assets.js"
import { getCheckingBalance } from "./portfolio.js"

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
  amount: number
  estimatedPrice: number
  fee: number
  feePercent: number
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
    feePercent: feeRes.percentage,
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
