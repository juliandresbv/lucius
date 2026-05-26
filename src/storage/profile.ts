// src/storage/profile.ts
import { readFile, writeFile } from "node:fs/promises"
import { resolve } from "node:path"

const PROFILE_PATH = resolve(
  process.cwd(),
  process.env.PROFILE_FILE ?? "profile.json"
)

export const RETURN_BY_RISK: Record<"conservative" | "moderate" | "aggressive", number> = {
  conservative: 0.05,
  moderate: 0.07,
  aggressive: 0.10,
}

export interface UserProfile {
  riskTolerance: "conservative" | "moderate" | "aggressive"
  monthlyBudget: number
  timeHorizon: "short" | "medium" | "long"
  sectors: string[]
  takeProfitThreshold: number
  stopLossThreshold: number
  expectedReturn: number  // derived — never user-entered
  createdAt: string
}

export async function loadProfile(): Promise<UserProfile | null> {
  try {
    const data = await readFile(PROFILE_PATH, "utf-8")
    return JSON.parse(data) as UserProfile
  } catch {
    return null
  }
}

export async function saveProfile(
  profile: Omit<UserProfile, "expectedReturn" | "createdAt">
): Promise<UserProfile> {
  const full: UserProfile = {
    ...profile,
    expectedReturn: RETURN_BY_RISK[profile.riskTolerance],
    createdAt: new Date().toISOString(),
  }
  await writeFile(PROFILE_PATH, JSON.stringify(full, null, 2), "utf-8")
  return full
}

export async function patchProfile(
  updates: Partial<Omit<UserProfile, "expectedReturn" | "createdAt">>
): Promise<UserProfile> {
  const existing = await loadProfile()
  if (!existing) throw new Error("No profile found")
  const merged = { ...existing, ...updates }
  const full: UserProfile = {
    riskTolerance: merged.riskTolerance,
    monthlyBudget: merged.monthlyBudget,
    timeHorizon: merged.timeHorizon,
    sectors: merged.sectors,
    takeProfitThreshold: merged.takeProfitThreshold,
    stopLossThreshold: merged.stopLossThreshold,
    expectedReturn: RETURN_BY_RISK[merged.riskTolerance],
    createdAt: existing.createdAt,
  }
  await writeFile(PROFILE_PATH, JSON.stringify(full, null, 2), "utf-8")
  return full
}
