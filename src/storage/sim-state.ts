// src/storage/sim-state.ts
import { readFile, writeFile } from "node:fs/promises"
import { resolve } from "node:path"

export function isSimMode(): boolean {
  return process.env.SIM_MODE === "true"
}

// Resolved at call time so SIM_STATE_FILE env var is respected even if set after module load
function getSimStatePath(): string {
  return resolve(process.cwd(), process.env.SIM_STATE_FILE ?? "sim-state.json")
}

const DEFAULT_BALANCE = (): number =>
  parseFloat(process.env.SIM_BALANCE ?? "10000")

export interface SimHolding {
  symbol: string
  shares: number      // accumulated (USD amount / price at trade time)
  avgPrice: number    // weighted average purchase price
}

export interface SimTransaction {
  id: string
  type: "BUY" | "SELL" | "DEPOSIT" | "WITHDRAWAL"
  symbol?: string
  amount: number      // USD
  shares?: number
  price?: number      // price per share at trade time
  fee: number
  timestamp: string   // ISO 8601
}

export interface SimState {
  balance: number
  initialBalance: number
  holdings: SimHolding[]
  transactions: SimTransaction[]
  createdAt: string
  updatedAt: string
}

function createFreshState(initialBalance: number): SimState {
  const now = new Date().toISOString()
  return { balance: initialBalance, initialBalance, holdings: [], transactions: [], createdAt: now, updatedAt: now }
}

export async function loadSimState(): Promise<SimState> {
  try {
    const data = await readFile(getSimStatePath(), "utf-8")
    try {
      const parsed = JSON.parse(data) as SimState
      if (typeof parsed.balance === "number" && Array.isArray(parsed.holdings)) {
        return parsed
      }
    } catch {
      // JSON parse error — treat as corrupt, fall through to fresh state
    }
    // Corrupt or invalid schema — overwrite with fresh state
    const fresh = createFreshState(DEFAULT_BALANCE())
    await saveSimState(fresh)
    return fresh
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err
    const fresh = createFreshState(DEFAULT_BALANCE())
    await saveSimState(fresh)
    return fresh
  }
}

export async function saveSimState(state: SimState): Promise<void> {
  const toWrite = { ...state, updatedAt: new Date().toISOString() }
  await writeFile(getSimStatePath(), JSON.stringify(toWrite, null, 2), "utf-8")
}

export async function resetSimState(initialBalance?: number): Promise<SimState> {
  const current = await loadSimState().catch(() => null)
  const balance = initialBalance ?? current?.initialBalance ?? DEFAULT_BALANCE()
  const fresh = createFreshState(balance)
  await saveSimState(fresh)
  return fresh
}
