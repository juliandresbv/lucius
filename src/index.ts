// src/index.ts
import "dotenv/config"
import chalk from "chalk"
import { loadProfile } from "./storage/profile.js"
import { runOnboarding } from "./cli/onboarding.js"
import { showMainMenu } from "./cli/menu.js"
import { runLuciusAgent } from "./lucius/agent.js"

async function printHeader(): Promise<void> {
  console.log()
  console.log(`  ${chalk.bold.white("Lucius")}  ${chalk.dim("v0.1.0")}`)
  console.log(chalk.dim("  AI-powered investment advisor"))

  if (process.env.DRY_RUN === "true") {
    console.log()
    console.log(chalk.yellow("  ⚙  DEV — DRY_RUN active, no real trades will execute"))
  }

  if (process.env.SIM_MODE === "true") {
    const { loadSimState } = await import("./storage/sim-state.js")
    const sim = await loadSimState().catch(() => null)
    const stateFile = process.env.SIM_STATE_FILE ?? "sim-state.json"
    console.log()
    console.log(chalk.cyan("  ⚡ SIMULATION MODE — trades are paper-only, balance is virtual"))
    if (sim) {
      const bal = sim.balance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      console.log(chalk.dim(`     Sim balance: $${bal}  ·  State: ${stateFile}`))
    }
  }

  console.log()
}

async function main(): Promise<void> {
  await printHeader()

  // Env check
  if (!process.env.WALLBIT_API_KEY) {
    console.error(
      chalk.red(
        "\n  Error: WALLBIT_API_KEY not set.\n  Copy .env.example to .env and add your key.\n"
      )
    )
    process.exit(1)
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error(
      chalk.red(
        "\n  Error: ANTHROPIC_API_KEY not set.\n  Copy .env.example to .env and add your key.\n"
      )
    )
    process.exit(1)
  }

  // Onboard if no profile
  let profile = await loadProfile()
  if (!profile) {
    profile = await runOnboarding()
    // After onboarding, run recommendations immediately (first run UX)
    const { runRecommendations } = await import("./cli/recommendations.js")
    await runRecommendations()
  }

  // Main event loop
  while (true) {
    const next = await showMainMenu()

    if (next === "exit") {
      console.log(chalk.dim("\n  Goodbye.\n"))
      process.exit(0)
    }

    if (next === "lucius") {
      await runLuciusAgent()
    }
  }
}

main().catch((err: Error) => {
  console.error(chalk.red(`\n  Fatal error: ${err.message}\n`))
  process.exit(1)
})
