// src/tests/assets.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest"
import { WallbitError } from "../wallbit/types.js"
import { wallbitApi } from "../wallbit/api.js"
import { searchAssets } from "../actions/assets.js"

vi.mock("../wallbit/api.js", () => ({
  wallbitApi: {
    getAssets: vi.fn(),
    getAssetDetail: vi.fn(),
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe("searchAssets", () => {
  it("returns live data when API returns non-empty results", async () => {
    vi.mocked(wallbitApi.getAssets).mockResolvedValueOnce({
      data: [{ symbol: "AAPL", name: "Apple", price: 200, sector: "Technology" }],
      total: 1,
      page: 1,
    })

    const result = await searchAssets("Technology")
    expect(result[0].symbol).toBe("AAPL")
    expect(result[0].price).toBe(200)
  })

  it("falls back to hardcoded list when API returns empty data", async () => {
    vi.mocked(wallbitApi.getAssets).mockResolvedValueOnce({
      data: [],
      total: 0,
      page: 1,
    })

    const result = await searchAssets("Technology")
    expect(result.length).toBeGreaterThan(0)
    expect(result.some((a) => a.symbol === "AAPL")).toBe(true)
  })

  it("falls back to hardcoded list when API returns 403", async () => {
    vi.mocked(wallbitApi.getAssets).mockRejectedValueOnce(new WallbitError(403, "Forbidden"))

    const result = await searchAssets("ETFs")
    expect(result.some((a) => a.symbol === "VOO")).toBe(true)
  })
})
