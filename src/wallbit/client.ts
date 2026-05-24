// src/wallbit/client.ts
import { WallbitError } from "./types.js"

const BASE_URL = "https://api.wallbit.io/api/public/v1"

function getApiKey(): string {
  const key = process.env.WALLBIT_API_KEY
  if (!key) throw new Error("WALLBIT_API_KEY not set in environment")
  return key
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

  const res = await fetch(url, { ...options, headers })

  if (res.status === 429) {
    const retryAfter = parseInt(res.headers.get("Retry-After") ?? "60", 10)
    throw new WallbitError(429, "Rate limit exceeded", retryAfter)
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

  return res.json() as Promise<T>
}
