// src/cli/profile.ts
import * as p from "@clack/prompts"
import chalk from "chalk"
import { loadProfile, patchProfile } from "../storage/profile.js"
import { runOnboarding } from "./onboarding.js"

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

function sectorsHint(sectors: string[]): string {
  if (sectors.length > 3) {
    return `${sectors.slice(0, 3).join(", ")} + ${sectors.length - 3} more`
  }
  return sectors.join(", ")
}

export async function viewProfile(): Promise<void> {
  const profile = await loadProfile()

  if (!profile) {
    console.log(chalk.dim("\n  No profile set up yet.\n"))
    return
  }

  console.log()
  console.log(chalk.bold("  Investment Profile"))
  console.log(chalk.dim("  ─────────────────────────────────────────────────"))
  console.log(`  ${chalk.dim("Risk tolerance".padEnd(22))}${profile.riskTolerance}`)
  console.log(`  ${chalk.dim("Monthly budget".padEnd(22))}$${profile.monthlyBudget}`)
  console.log(`  ${chalk.dim("Time horizon".padEnd(22))}${profile.timeHorizon} term`)
  console.log(`  ${chalk.dim("Sectors".padEnd(22))}${sectorsHint(profile.sectors)}`)
  console.log(`  ${chalk.dim("Take-profit".padEnd(22))}${profile.takeProfitThreshold}%`)
  console.log(`  ${chalk.dim("Stop-loss".padEnd(22))}${profile.stopLossThreshold}%`)
  console.log()
}

export async function runPatchProfile(): Promise<void> {
  let profile = await loadProfile()

  if (!profile) {
    await runOnboarding()
    return
  }

  while (true) {
    const section = await p.select({
      message: "Which section would you like to update?",
      options: [
        { value: "risk",       label: "Risk tolerance",        hint: profile.riskTolerance },
        { value: "budget",     label: "Monthly budget",        hint: `$${profile.monthlyBudget}` },
        { value: "horizon",    label: "Time horizon",          hint: `${profile.timeHorizon} term` },
        { value: "sectors",    label: "Sectors",               hint: sectorsHint(profile.sectors) },
        { value: "takeprofit", label: "Take-profit threshold", hint: `${profile.takeProfitThreshold}%` },
        { value: "stoploss",   label: "Stop-loss threshold",   hint: `${profile.stopLossThreshold}%` },
        { value: "done",       label: "Done" },
      ],
    })

    if (p.isCancel(section) || section === "done") return

    switch (section) {
      case "risk": {
        const riskTolerance = await p.select({
          message: "How would you describe your approach to risk?",
          options: [
            { value: "conservative", label: "Conservative", hint: "I prefer stability. Slow and steady." },
            { value: "moderate",     label: "Moderate",     hint: "Balanced. Some risk for better returns." },
            { value: "aggressive",   label: "Aggressive",   hint: "I can handle volatility. I'm here to grow." },
          ],
        })
        if (p.isCancel(riskTolerance)) return
        try {
          profile = await patchProfile({ riskTolerance: riskTolerance as "conservative" | "moderate" | "aggressive" })
          console.log(chalk.dim("  ✓ Risk tolerance updated."))
        } catch {
          p.cancel("Failed to save — profile may have been deleted.")
          return
        }
        break
      }
      case "budget": {
        const budgetStr = await p.text({
          message: "How much would you like to invest per month? (USD)",
          placeholder: String(profile.monthlyBudget),
          validate: (v) => {
            const n = parseFloat(v)
            if (isNaN(n) || n <= 0) return "Must be a positive number"
            return undefined
          },
        })
        if (p.isCancel(budgetStr)) return
        try {
          profile = await patchProfile({ monthlyBudget: parseFloat(budgetStr as string) })
          console.log(chalk.dim("  ✓ Monthly budget updated."))
        } catch {
          p.cancel("Failed to save — profile may have been deleted.")
          return
        }
        break
      }
      case "horizon": {
        const timeHorizon = await p.select({
          message: "When do you expect to need this money?",
          options: [
            { value: "short",  label: "Short term",  hint: "Within 2 years" },
            { value: "medium", label: "Medium term", hint: "2 to 7 years" },
            { value: "long",   label: "Long term",   hint: "7 years or more" },
          ],
        })
        if (p.isCancel(timeHorizon)) return
        try {
          profile = await patchProfile({ timeHorizon: timeHorizon as "short" | "medium" | "long" })
          console.log(chalk.dim("  ✓ Time horizon updated."))
        } catch {
          p.cancel("Failed to save — profile may have been deleted.")
          return
        }
        break
      }
      case "sectors": {
        const newSectors = await p.multiselect({
          message: "Which sectors interest you? (Space to select, Enter to confirm)",
          options: SECTORS.map((s) => ({ value: s, label: s })),
          initialValues: profile.sectors,
          required: true,
        })
        if (p.isCancel(newSectors)) return
        try {
          profile = await patchProfile({ sectors: newSectors as string[] })
          console.log(chalk.dim("  ✓ Sectors updated."))
        } catch {
          p.cancel("Failed to save — profile may have been deleted.")
          return
        }
        break
      }
      case "takeprofit": {
        const takeProfitChoice = await p.select({
          message: "At what % gain would you want to consider selling?",
          options: [
            { value: "10",     label: "10%",    hint: "Take profits early" },
            { value: "20",     label: "20%",    hint: "Standard target (recommended)" },
            { value: "30",     label: "30%",    hint: "Let winners run" },
            { value: "custom", label: "Custom", hint: "Enter your own value" },
          ],
        })
        if (p.isCancel(takeProfitChoice)) return
        let takeProfitThreshold: number
        if (takeProfitChoice === "custom") {
          const customTP = await p.text({
            message: "Take-profit threshold (%)",
            validate: (v) => {
              const n = parseFloat(v)
              if (isNaN(n) || n <= 0 || n > 1000) return "Must be between 1 and 1000"
              return undefined
            },
          })
          if (p.isCancel(customTP)) return
          takeProfitThreshold = parseFloat(customTP as string)
        } else {
          takeProfitThreshold = parseFloat(takeProfitChoice as string)
        }
        try {
          profile = await patchProfile({ takeProfitThreshold })
          console.log(chalk.dim("  ✓ Take-profit threshold updated."))
        } catch {
          p.cancel("Failed to save — profile may have been deleted.")
          return
        }
        break
      }
      case "stoploss": {
        const stopLossChoice = await p.select({
          message: "At what % loss would you want Sentinel to flag a position?",
          options: [
            { value: "10",     label: "10%",    hint: "Protective" },
            { value: "15",     label: "15%",    hint: "Balanced (recommended)" },
            { value: "25",     label: "25%",    hint: "High tolerance" },
            { value: "custom", label: "Custom", hint: "Enter your own value" },
          ],
        })
        if (p.isCancel(stopLossChoice)) return
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
          if (p.isCancel(customSL)) return
          stopLossThreshold = parseFloat(customSL as string)
        } else {
          stopLossThreshold = parseFloat(stopLossChoice as string)
        }
        try {
          profile = await patchProfile({ stopLossThreshold })
          console.log(chalk.dim("  ✓ Stop-loss threshold updated."))
        } catch {
          p.cancel("Failed to save — profile may have been deleted.")
          return
        }
        break
      }
    }
  }
}

export async function runProfileMenu(): Promise<void> {
  while (true) {
    const action = await p.select({
      message: "Investment profile",
      options: [
        { value: "view",   label: "View investing profile" },
        { value: "update", label: "Update investing profile" },
        { value: "back",   label: "Back" },
      ],
    })

    if (p.isCancel(action) || action === "back") return

    switch (action) {
      case "view":
        await viewProfile()
        break
      case "update":
        await runPatchProfile()
        break
    }
  }
}
