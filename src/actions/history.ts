// src/actions/history.ts
import { wallbitApi } from "../wallbit/api.js"
import type { Transaction } from "../wallbit/types.js"

// Re-export for use by CLI and Lucius layers
export type { Transaction }

export async function getTransactionHistory(
  fromDate?: string,
  toDate?: string,
  type?: string
): Promise<Transaction[]> {
  const res = await wallbitApi.getTransactions({
    from_date: fromDate,
    to_date: toDate,
    type,
    limit: 50,
  })
  return (res.data ?? []).map((t) => ({
    id: t.id,
    type: t.type,
    symbol: t.symbol,
    amount: t.amount,
    price: t.price,
    direction: t.direction,
    timestamp: t.timestamp,
    status: t.status,
  }))
}
