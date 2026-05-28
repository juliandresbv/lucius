// src/wallbit/types.ts

export interface CheckingBalanceResponse {
  available: number
  currency: string
}

export interface StockHolding {
  symbol: string
  shares: number
  currentPrice: number
  value: number
  name?: string
}

export interface StockPortfolioResponse {
  holdings: StockHolding[]
  totalValue: number
}

export interface Asset {
  symbol: string
  name: string
  price: number
  sector: string
  dividendYield?: number
}

export interface AssetDetail extends Asset {
  marketCap?: number
  description?: string
  CEO?: string
  dividends?: number
}

export interface AssetsResponse {
  data: Asset[]
  total: number
  page: number
}

export interface FeeResponse {
  tier: string
  percentage: number
  fixed: number
  estimatedFee: number
}

export interface TradeRequest {
  symbol: string
  direction: "BUY" | "SELL"
  currency: "USD"
  order_type: "MARKET"
  amount: number
}

export interface TradeResponse {
  id: string
  symbol: string
  direction: "BUY" | "SELL"
  amount: number
  price: number
  fee: number
  status: string
  timestamp: string
}

export interface OperationRequest {
  type: "DEPOSIT" | "WITHDRAWAL"
  amount: number
}

export interface OperationResponse {
  id: string
  type: string
  amount: number
  status: string
  timestamp: string
}

export interface Transaction {
  id: string
  type: string
  symbol?: string
  amount: number
  price?: number
  direction?: string
  timestamp: string
  status: string
}

export interface TransactionsResponse {
  data: Transaction[]
  total: number
}

export class WallbitError extends Error {
  constructor(
    public readonly code: number,
    message: string,
    public readonly retryAfter?: number
  ) {
    super(message)
    this.name = "WallbitError"
  }
}
