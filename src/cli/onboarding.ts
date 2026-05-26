// src/cli/onboarding.ts
import * as p from "@clack/prompts"
import chalk from "chalk"
import { saveProfile } from "../storage/profile.js"
import type { UserProfile } from "../storage/profile.js"

const SECTORS = [
  "Technology",
  "Health",
  "Consumer Goods",
  "Energy & Water",
  "Finance",
  "Real Estate",
  "ETFs",
  "Dividends",
  "Argentinian ADRs",
  "Most Popular",
]

export async function runOnboarding(): Promise<UserProfile> {
  console.clear()
  p.intro(chalk.bold.white("Welcome to Lucius."))
  console.log(
    chalk.dim(
      "  I'll ask you a few questions to understand your investment goals.\n  Takes about 2 minutes.\n"
    )
  )

  // Step 1 — Risk tolerance
  const riskTolerance = await p.select({
    message: "How would you describe your approach to risk?",
    options: [
      {
        value: "conservative",
        label: "Conservative",
        hint: "I prefer stability. Slow and steady.",
      },
      {
        value: "moderate",
        label: "Moderate",
        hint: "Balanced. Some risk for better returns.",
      },
      {
        value: "aggressive",
        label: "Aggressive",
        hint: "I can handle volatility. I'm here to grow.",
      },
    ],
  })
  if (p.isCancel(riskTolerance)) process.exit(0)

  // Step 2 — Monthly budget
  const budgetStr = await p.text({
    message: "How much would you like to invest per month? (USD)",
    placeholder: "0",
    validate: (v) => {
      const n = parseFloat(v)
      if (isNaN(n) || n <= 0) return "Must be a positive number"
      return undefined
    },
  })
  if (p.isCancel(budgetStr)) process.exit(0)
  const monthlyBudget = parseFloat(budgetStr as string)

  // Step 3 — Time horizon
  const timeHorizon = await p.select({
    message: "When do you expect to need this money?",
    options: [
      { value: "short", label: "Short term", hint: "Within 2 years" },
      { value: "medium", label: "Medium term", hint: "2 to 7 years" },
      { value: "long", label: "Long term", hint: "7 years or more" },
    ],
  })
  if (p.isCancel(timeHorizon)) process.exit(0)

  // Step 4 — Sectors
  const sectors = await p.multiselect({
    message: "Which sectors interest you? (Space to toggle · Enter to confirm)",
    options: SECTORS.map((s) => ({ value: s, label: s })),
    required: true,
  })
  if (p.isCancel(sectors)) process.exit(0)

  // Step 5 — Take profit
  const takeProfitChoice = await p.select({
    message: "At what % gain would you want to consider selling?",
    options: [
      { value: "10", label: "10%", hint: "Take profits early" },
      { value: "20", label: "20%", hint: "Standard target (recommended)" },
      { value: "30", label: "30%", hint: "Let winners run" },
      { value: "custom", label: "Custom", hint: "Enter your own value" },
    ],
  })
  if (p.isCancel(takeProfitChoice)) process.exit(0)

  let takeProfitThreshold: number
  if (takeProfitChoice === "custom") {
    const customTP = await p.text({
      message: "Take-profit threshold (%)",
      validate: (v) => {
        const n = parseFloat(v)
        if (isNaN(n) || n <= 0) return "Must be a positive number"
        return undefined
      },
    })
    if (p.isCancel(customTP)) process.exit(0)
    takeProfitThreshold = parseFloat(customTP as string)
  } else {
    takeProfitThreshold = parseFloat(takeProfitChoice as string)
  }

  // Step 6 — Stop loss
  const stopLossChoice = await p.select({
    message: "At what % loss would you want Sentinel to flag a position?",
    options: [
      { value: "10", label: "10%", hint: "Protective" },
      { value: "15", label: "15%", hint: "Balanced (recommended)" },
      { value: "25", label: "25%", hint: "High tolerance" },
      { value: "custom", label: "Custom", hint: "Enter your own value" },
    ],
  })
  if (p.isCancel(stopLossChoice)) process.exit(0)

  let stopLossThreshold: number
  if (stopLossChoice === "custom") {
    const customSL = await p.text({
      message: "Stop-loss threshold (%)",
      validate: (v) => {
        const n = parseFloat(v)
        if (isNaN(n) || n <= 0 || n > 100) return "Must be between 1 and 100"
        return undefined
      },
    })
    if (p.isCancel(customSL)) process.exit(0)
    stopLossThreshold = parseFloat(customSL as string)
  } else {
    stopLossThreshold = parseFloat(stopLossChoice as string)
  }

  const s = p.spinner()
  s.start("Saving your profile...")
  const profile = await saveProfile({
    riskTolerance: riskTolerance as "conservative" | "moderate" | "aggressive",
    monthlyBudget,
    timeHorizon: timeHorizon as "short" | "medium" | "long",
    sectors: sectors as string[],
    takeProfitThreshold,
    stopLossThreshold,
  })
  s.stop("Profile saved.")

  p.outro(
    [
      chalk.bold("✓ Profile created."),
      chalk.dim(`  Risk profile:   ${profile.riskTolerance}`),
      chalk.dim(`  Monthly budget: $${profile.monthlyBudget}`),
      chalk.dim(`  Horizon:        ${profile.timeHorizon} term`),
      chalk.dim(`  Sectors:        ${profile.sectors.join(", ")}`),
      chalk.dim(
        `  Take profit:    ${profile.takeProfitThreshold}%  ·  Stop loss: ${profile.stopLossThreshold}%`
      ),
    ].join("\n")
  )

  return profile
}
