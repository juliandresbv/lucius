// src/wallbit/client.ts
import { WallbitError } from "./types.js"

const BASE_URL = "https://api.wallbit.io/api/public/v1"

function getApiKey(): string {
  const key = process.env.WALLBIT_API_KEY
  if (!key) throw new Error("WALLBIT_API_KEY not set in environment")
  return key
}

const RETRY_DELAYS_MS = [1000, 2000, 4000]

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function wallbitFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${BASE_URL}${path}`
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> ?? {}),
    "X-API-Key": getApiKey(),
    ...(options.method === "POST" ? { "Content-Type": "application/json" } : {}),
  }

  let lastError: WallbitError | undefined

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    if (attempt > 0) await sleep(RETRY_DELAYS_MS[attempt - 1])

    const res = await fetch(url, { ...options, headers })

    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get("Retry-After") ?? "60", 10)
      throw new WallbitError(429, "Rate limit exceeded", retryAfter)
    }

    // Retry on 5xx server errors
    if (res.status >= 500) {
      const body = await res.text().catch(() => "")
      lastError = new WallbitError(res.status, `HTTP ${res.status}: ${body}`)
      continue
    }

    if (!res.ok) {
      const body = await res.text().catch(() => "")
      const errorMessages: Record<number, string> = {
        400: "Bad request — validation error or insufficient funds",
        401: "Invalid API key",
        403: "Insufficient permissions or unfunded account",
        404: "Resource not found",
        412: "KYC incomplete",
        422: "Validation error",
      }
      throw new WallbitError(
        res.status,
        errorMessages[res.status] ?? `HTTP ${res.status}: ${body}`
      )
    }

    const json = (await res.json()) as Record<string, unknown>
    // Unwrap Wallbit's standard {"data": ...} envelope
    if (json !== null && typeof json === "object" && "data" in json) {
      return json.data as T
    }
    return json as T
  }

  throw lastError!
}
