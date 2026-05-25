// src/tests/wallbit-client.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest"

// Mock global fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

// Set up env before importing client
beforeEach(() => {
  vi.resetModules()
  process.env.WALLBIT_API_KEY = "test-api-key"
})

describe("wallbitFetch", () => {
  it("throws WallbitError with code 401 on unauthorized", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      headers: { get: () => null },
      text: async () => "Unauthorized",
    })

    const { wallbitFetch } = await import("../wallbit/client.js")
    const { WallbitError } = await import("../wallbit/types.js")

    await expect(wallbitFetch("/balance/checking")).rejects.toThrow(WallbitError)
  })

  it("throws WallbitError with retryAfter on 429", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      headers: { get: (h: string) => (h === "Retry-After" ? "30" : null) },
      text: async () => "Rate limit",
    })

    const { wallbitFetch } = await import("../wallbit/client.js")
    const { WallbitError } = await import("../wallbit/types.js")

    await expect(wallbitFetch("/balance/checking")).rejects.toMatchObject({
      code: 429,
      retryAfter: 30,
    } satisfies Partial<InstanceType<typeof WallbitError>>)
  })

  it("sends X-API-Key header on every request", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({ available: 100, currency: "USD" }),
    })

    const { wallbitFetch } = await import("../wallbit/client.js")
    await wallbitFetch("/balance/checking")

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/balance/checking"),
      expect.objectContaining({
        headers: expect.objectContaining({ "X-API-Key": "test-api-key" }),
      })
    )
  })
})
