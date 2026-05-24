// src/actions/assets.ts
import { wallbitApi } from "../wallbit/api.js"
import { getFallbackAssets, getAllFallbackAssets } from "../wallbit/fallback-assets.js"
import { WallbitError } from "../wallbit/types.js"
import type { Asset } from "../wallbit/types.js"

export interface AssetInfo {
  symbol: string
  name: string
  price: number
  sector: string
  dividendYield?: number
}

export interface AssetDetailInfo extends AssetInfo {
  marketCap?: number
  description?: string
  CEO?: string
  dividends?: number
}

export async function searchAssets(
  category?: string,
  limit = 20
): Promise<AssetInfo[]> {
  try {
    const res = await wallbitApi.getAssets({ category, limit })
    if (res.data && res.data.length > 0) {
      return res.data.map(mapAsset)
    }
    // Empty data — fall back to curated list
    return category
      ? getFallbackAssets(category).slice(0, limit)
      : getAllFallbackAssets().slice(0, limit)
  } catch (err) {
    if (err instanceof WallbitError && (err.code === 403 || err.code === 401)) {
      return category
        ? getFallbackAssets(category).slice(0, limit)
        : getAllFallbackAssets().slice(0, limit)
    }
    throw err
  }
}

export async function getAssetDetail(symbol: string): Promise<AssetDetailInfo> {
  try {
    const res = await wallbitApi.getAssetDetail(symbol)
    return {
      symbol: res.symbol,
      name: res.name,
      price: res.price,
      sector: res.sector,
      dividendYield: res.dividendYield,
      marketCap: res.marketCap,
      description: res.description,
      CEO: res.CEO,
      dividends: res.dividends,
    }
  } catch (err) {
    if (err instanceof WallbitError && (err.code === 403 || err.code === 401)) {
      const fallback = getAllFallbackAssets().find((a) => a.symbol === symbol)
      if (fallback) return { ...fallback }
      throw new Error(`Asset ${symbol} not found in fallback list — check symbol`)
    }
    throw err
  }
}

function mapAsset(a: Asset): AssetInfo {
  return {
    symbol: a.symbol,
    name: a.name,
    price: a.price,
    sector: a.sector,
    dividendYield: a.dividendYield,
  }
}
