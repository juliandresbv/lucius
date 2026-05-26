// src/lucius/guard.ts
import type Anthropic from "@anthropic-ai/sdk"

type Verdict = "SAFE" | "OUT_OF_SCOPE" | "INJECTION" | "SECRETS"

export type GuardResult =
  | { verdict: "SAFE" }
  | { verdict: "BLOCKED"; reason: Verdict; message: string }

const REFUSAL: Record<Exclude<Verdict, "SAFE">, string> = {
  INJECTION:
    "That's not something I can help with. Let's stick to your investments.",
  SECRETS:
    "I don't have access to system configuration and wouldn't share it. What would you like to work on?",
  OUT_OF_SCOPE:
    "I'm focused on your investment portfolio. I can't help with that, but I can help with recommendations, projections, or portfolio analysis.",
}

const INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(all\s+)?previous\s+instructions/i,
  /forget\s+(that\s+you\s+are|you\s+are|your\s+instructions)/i,
  /new\s+system\s+prompt/i,
  /you\s+are\s+now\s+(a\s+)?(?!lucius)/i,
  /pretend\s+(you\s+are|to\s+be)/i,
  /roleplay\s+as/i,
  /as\s+DAN\b/i,
  /jailbreak/i,
  /override\s+your\s+(instructions|rules|constraints)/i,
  /bypass\s+your/i,
  /disregard\s+(all|your)/i,
]

const SECRETS_PATTERNS: RegExp[] = [
  /ANTHROPIC_API_KEY/i,
  /WALLBIT_API_KEY/i,
  /\bapi[\s_-]?key\b/i,
  /environment\s+variable/i,
  /\benv\s+var\b/i,
  /print\s+your\s+(system\s+)?prompt/i,
  /reveal\s+your\s+(system\s+)?prompt/i,
  /what\s+is\s+your\s+(system\s+)?prompt/i,
  /show\s+me\s+your\s+(system\s+)?prompt/i,
  /your\s+instructions\s+are/i,
  /\bcredentials\b/i,
]

const SUSPICIOUS_PATTERNS: RegExp[] = [
  /system\s+prompt/i,
  /your\s+instructions/i,
  /your\s+configuration/i,
  /your\s+rules/i,
  /how\s+are\s+you\s+configured/i,
  /what\s+are\s+your\s+tools/i,
]

export async function checkGuard(
  input: string,
  _anthropic: Anthropic
): Promise<GuardResult> {
  if (input.length > 2000) {
    return { verdict: "BLOCKED", reason: "INJECTION", message: REFUSAL.INJECTION }
  }

  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(input)) {
      return { verdict: "BLOCKED", reason: "INJECTION", message: REFUSAL.INJECTION }
    }
  }

  for (const pattern of SECRETS_PATTERNS) {
    if (pattern.test(input)) {
      return { verdict: "BLOCKED", reason: "SECRETS", message: REFUSAL.SECRETS }
    }
  }

  const isSuspicious = SUSPICIOUS_PATTERNS.some((p) => p.test(input))
  if (!isSuspicious) return { verdict: "SAFE" }

  // Layer 2 stub — replaced in Task 2
  return { verdict: "SAFE" }
}
