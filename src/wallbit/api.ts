// src/wallbit/api.ts
import { wallbitFetch } from "./client.js"
import type {
  CheckingBalanceResponse,
  StockPortfolioResponse,
  RoboAdvisorResponse,
  AssetsResponse,
  AssetDetail,
  FeeResponse,
  TradeRequest,
  TradeResponse,
  OperationRequest,
  OperationResponse,
  TransactionsResponse,
} from "./types.js"

export const wallbitApi = {
  async getCheckingBalance(): Promise<CheckingBalanceResponse> {
    return wallbitFetch<CheckingBalanceResponse>("/balance/checking")
  },

  async getStockPortfolio(): Promise<StockPortfolioResponse> {
    return wallbitFetch<StockPortfolioResponse>("/balance/stocks")
  },

  async getRoboAdvisorBalance(): Promise<RoboAdvisorResponse> {
    return wallbitFetch<RoboAdvisorResponse>("/roboadvisor/balance")
  },

  async getAssets(
    params: { category?: string; page?: number; limit?: number } = {}
  ): Promise<AssetsResponse> {
    const qs = new URLSearchParams()
    if (params.category) qs.set("category", params.category)
    qs.set("page", String(params.page ?? 1))
    qs.set("limit", String(params.limit ?? 20))
    return wallbitFetch<AssetsResponse>(`/assets?${qs}`)
  },

  async getAssetDetail(symbol: string): Promise<AssetDetail> {
    return wallbitFetch<AssetDetail>(`/assets/${symbol}`)
  },

  async getFees(params: {
    type: string
    symbol: string
    direction: "BUY" | "SELL"
    amount: number
  }): Promise<FeeResponse> {
    // API returns {fee_type, tier, percentage_fee, fixed_fee_usd}
    // Normalize to our FeeResponse shape
    const raw = await wallbitFetch<Record<string, unknown>>("/fees", {
      method: "POST",
      body: JSON.stringify(params),
    })
    const percentageFee = (raw.percentage_fee as number | undefined) ?? (raw.percentage as number | undefined) ?? 0.0035
    const fixedFee = (raw.fixed_fee_usd as number | undefined) ?? (raw.fixed as number | undefined) ?? 0
    return {
      tier: (raw.tier as string) ?? "LEVEL2",
      percentage: percentageFee,
      fixed: fixedFee,
      estimatedFee: params.amount * percentageFee + fixedFee,
    }
  },

  async createTrade(req: TradeRequest): Promise<TradeResponse> {
    return wallbitFetch<TradeResponse>("/trades", {
      method: "POST",
      body: JSON.stringify(req),
    })
  },

  async moveOperation(req: OperationRequest): Promise<OperationResponse> {
    return wallbitFetch<OperationResponse>("/operations/internal", {
      method: "POST",
      body: JSON.stringify(req),
    })
  },

  async getTransactions(
    params: {
      type?: string
      from_date?: string
      to_date?: string
      limit?: number
      page?: number
    } = {}
  ): Promise<TransactionsResponse> {
    const qs = new URLSearchParams()
    if (params.type) qs.set("type", params.type)
    if (params.from_date) qs.set("from_date", params.from_date)
    if (params.to_date) qs.set("to_date", params.to_date)
    if (params.limit) qs.set("limit", String(params.limit))
    if (params.page !== undefined) qs.set("page", String(params.page))
    return wallbitFetch<TransactionsResponse>(`/transactions?${qs}`)
  },
}
