// src/actions/history.ts
import { wallbitApi } from "../wallbit/api.js"
import type { Transaction } from "../wallbit/types.js"
import { isSimMode, loadSimState } from "../storage/sim-state.js"

// Re-export for use by CLI and Lucius layers
export type { Transaction }

/**
 * Pure function — computes weighted average cost per share for each symbol
 * from an ordered-or-unordered list of trade transactions.
 *
 * Algorithm (average cost method):
 * - BUY:  increases totalShares and totalCost
 * - SELL: decreases totalShares; avgPrice stays the same (cost basis unchanged)
 * - Full sell (totalShares → 0): resets the basis so a later rebuy starts fresh
 *
 * Exported for unit testing without API mocking.
 */
export function computeAvgPricesFromTransactions(
  transactions: Transaction[]
): Record<string, number> {
  // Process chronologically so sells reduce the correct running basis
  const sorted = [...transactions].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  )

  const basis: Record<string, { totalCost: number; totalShares: number }> = {}

  for (const t of sorted) {
    if (!t.symbol || !t.price || t.price <= 0) continue
    const shares = t.amount / t.price
    if (!basis[t.symbol]) basis[t.symbol] = { totalCost: 0, totalShares: 0 }

    if (t.direction === "BUY") {
      basis[t.symbol].totalCost += t.amount
      basis[t.symbol].totalShares += shares
    } else if (t.direction === "SELL") {
      const { totalCost, totalShares } = basis[t.symbol]
      if (totalShares <= 0) continue
      const avgCost = totalCost / totalShares
      basis[t.symbol].totalShares -= shares
      basis[t.symbol].totalCost -= shares * avgCost
      // Treat as fully sold if floating-point residual
      if (basis[t.symbol].totalShares < 0.0001) {
        basis[t.symbol] = { totalCost: 0, totalShares: 0 }
      }
    }
  }

  const result: Record<string, number> = {}
  for (const [symbol, { totalCost, totalShares }] of Object.entries(basis)) {
    if (totalShares >= 0.0001 && totalCost > 0) {
      result[symbol] = totalCost / totalShares
    }
  }
  return result
}

const PAGE_SIZE = 50

/** Fetches ALL trade transactions (paginated) and returns weighted avg cost per symbol. */
export async function computeAvgPrices(): Promise<Record<string, number>> {
  const firstPage = await wallbitApi.getTransactions({ type: "TRADE", limit: PAGE_SIZE, page: 1 })
  const allTransactions = [...(firstPage.data ?? [])]
  const total = firstPage.total ?? 0
  const totalPages = Math.ceil(total / PAGE_SIZE)

  for (let page = 2; page <= totalPages; page++) {
    const res = await wallbitApi.getTransactions({ type: "TRADE", limit: PAGE_SIZE, page })
    allTransactions.push(...(res.data ?? []))
  }

  return computeAvgPricesFromTransactions(allTransactions)
}

export async function getTransactionHistory(
  fromDate?: string,
  toDate?: string,
  type?: string
): Promise<Transaction[]> {
  if (isSimMode()) {
    const sim = await loadSimState()
    return sim.transactions.map((t) => ({
      id: t.id,
      type: t.type,
      symbol: t.symbol ?? "USD",
      amount: t.amount,
      price: t.price ?? 1,
      direction: t.type === "BUY" || t.type === "DEPOSIT" ? "BUY" : "SELL",
      timestamp: t.timestamp,
      status: "SIMULATED",
    }))
  }
  const res = await wallbitApi.getTransactions({
    from_date: fromDate,
    to_date: toDate,
    type,
    limit: 50,
  })
  return (res.data ?? []).map((t) => ({
    id: t.id, type: t.type, symbol: t.symbol, amount: t.amount,
    price: t.price, direction: t.direction, timestamp: t.timestamp, status: t.status,
  }))
}
