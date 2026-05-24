// src/wallbit/fallback-assets.ts
import type { Asset } from "./types.js"

export const FALLBACK_ASSETS: Record<string, Asset[]> = {
  Technology: [
    { symbol: "AAPL", name: "Apple Inc.", price: 213.32, sector: "Technology", dividendYield: 0.5 },
    { symbol: "MSFT", name: "Microsoft Corporation", price: 420.21, sector: "Technology", dividendYield: 0.7 },
    { symbol: "GOOGL", name: "Alphabet Inc.", price: 178.45, sector: "Technology", dividendYield: 0 },
    { symbol: "NVDA", name: "NVIDIA Corporation", price: 950.10, sector: "Technology", dividendYield: 0.03 },
    { symbol: "META", name: "Meta Platforms Inc.", price: 510.88, sector: "Technology", dividendYield: 0.4 },
    { symbol: "AMZN", name: "Amazon.com Inc.", price: 195.50, sector: "Technology", dividendYield: 0 },
  ],
  ETFs: [
    { symbol: "VOO", name: "Vanguard S&P 500 ETF", price: 520.40, sector: "ETFs", dividendYield: 1.3 },
    { symbol: "QQQ", name: "Invesco QQQ Trust", price: 490.55, sector: "ETFs", dividendYield: 0.6 },
    { symbol: "SPY", name: "SPDR S&P 500 ETF", price: 578.32, sector: "ETFs", dividendYield: 1.2 },
    { symbol: "VTI", name: "Vanguard Total Stock Market ETF", price: 278.90, sector: "ETFs", dividendYield: 1.4 },
  ],
  Finance: [
    { symbol: "JPM", name: "JPMorgan Chase & Co.", price: 222.15, sector: "Finance", dividendYield: 2.2 },
    { symbol: "BAC", name: "Bank of America Corp.", price: 44.80, sector: "Finance", dividendYield: 2.4 },
    { symbol: "V", name: "Visa Inc.", price: 282.45, sector: "Finance", dividendYield: 0.8 },
    { symbol: "MA", name: "Mastercard Inc.", price: 480.20, sector: "Finance", dividendYield: 0.6 },
  ],
  Health: [
    { symbol: "JNJ", name: "Johnson & Johnson", price: 155.20, sector: "Health", dividendYield: 3.2 },
    { symbol: "UNH", name: "UnitedHealth Group Inc.", price: 497.80, sector: "Health", dividendYield: 1.6 },
    { symbol: "PFE", name: "Pfizer Inc.", price: 27.50, sector: "Health", dividendYield: 6.2 },
  ],
  "Consumer Goods": [
    { symbol: "KO", name: "Coca-Cola Company", price: 72.40, sector: "Consumer Goods", dividendYield: 3.1 },
    { symbol: "PEP", name: "PepsiCo Inc.", price: 163.20, sector: "Consumer Goods", dividendYield: 3.4 },
    { symbol: "WMT", name: "Walmart Inc.", price: 91.30, sector: "Consumer Goods", dividendYield: 1.2 },
  ],
  "Energy & Water": [
    { symbol: "XOM", name: "Exxon Mobil Corp.", price: 118.60, sector: "Energy & Water", dividendYield: 3.4 },
    { symbol: "CVX", name: "Chevron Corporation", price: 162.80, sector: "Energy & Water", dividendYield: 4.2 },
  ],
  "Real Estate": [
    { symbol: "AMT", name: "American Tower Corp.", price: 188.50, sector: "Real Estate", dividendYield: 3.3 },
    { symbol: "PLD", name: "Prologis Inc.", price: 113.40, sector: "Real Estate", dividendYield: 3.5 },
  ],
  Dividends: [
    { symbol: "T", name: "AT&T Inc.", price: 21.80, sector: "Dividends", dividendYield: 5.8 },
    { symbol: "VZ", name: "Verizon Communications Inc.", price: 42.50, sector: "Dividends", dividendYield: 6.3 },
    { symbol: "ABBV", name: "AbbVie Inc.", price: 176.20, sector: "Dividends", dividendYield: 3.9 },
  ],
  "Argentinian ADRs": [
    { symbol: "MELI", name: "MercadoLibre Inc.", price: 2180.40, sector: "Argentinian ADRs", dividendYield: 0 },
    { symbol: "GLOB", name: "Globant S.A.", price: 155.20, sector: "Argentinian ADRs", dividendYield: 0 },
    { symbol: "DESP", name: "Despegar.com Corp.", price: 15.40, sector: "Argentinian ADRs", dividendYield: 0 },
  ],
  "Most Popular": [
    { symbol: "AAPL", name: "Apple Inc.", price: 213.32, sector: "Most Popular", dividendYield: 0.5 },
    { symbol: "TSLA", name: "Tesla Inc.", price: 248.50, sector: "Most Popular", dividendYield: 0 },
    { symbol: "NVDA", name: "NVIDIA Corporation", price: 950.10, sector: "Most Popular", dividendYield: 0.03 },
    { symbol: "SPY", name: "SPDR S&P 500 ETF", price: 578.32, sector: "Most Popular", dividendYield: 1.2 },
  ],
}

export function getFallbackAssets(category: string): Asset[] {
  return FALLBACK_ASSETS[category] ?? []
}

export function getAllFallbackAssets(): Asset[] {
  const seen = new Set<string>()
  const result: Asset[] = []
  for (const assets of Object.values(FALLBACK_ASSETS)) {
    for (const asset of assets) {
      if (!seen.has(asset.symbol)) {
        seen.add(asset.symbol)
        result.push(asset)
      }
    }
  }
  return result
}
