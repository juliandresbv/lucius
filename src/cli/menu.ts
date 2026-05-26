// src/cli/menu.ts
import * as p from "@clack/prompts"
import chalk from "chalk"
import { showPortfolio } from "./portfolio.js"
import { runRecommendations } from "./recommendations.js"
import { showLongTermOutlook } from "./outlook.js"
import { runMoveFunds } from "./execution.js"
import { runOnboarding } from "./onboarding.js"
import { getTransactionHistory } from "../actions/history.js"
import { isSimMode } from "../storage/sim-state.js"
import { setSimBalance, resetSim, viewSimLedger } from "./simulation.js"

export async function showMainMenu(): Promise<"lucius" | "exit"> {
  while (true) {
    const options: Parameters<typeof p.select>[0]["options"] = [
      { value: "portfolio", label: "1. View portfolio" },
      { value: "recommendations", label: "2. Get recommendations" },
      { value: "outlook", label: "3. Long-term outlook" },
      { value: "funds", label: "4. Move funds" },
      { value: "history", label: "5. Transaction history" },
      { value: "profile", label: "6. Update profile" },
      { value: "lucius", label: "L. Talk to Lucius" },
      ...(isSimMode()
        ? [
            { value: "sim-balance", label: "⚡  Set starting balance" },
            { value: "sim-reset",   label: "⚡  Reset simulation" },
            { value: "sim-ledger",  label: "⚡  View sim ledger" },
          ]
        : []),
      { value: "exit", label: "Exit" },
    ]

    const choice = await p.select({
      message: chalk.bold("What would you like to do?"),
      options,
    })

    if (p.isCancel(choice) || choice === "exit") return "exit"
    if (choice === "lucius") return "lucius"

    switch (choice) {
      case "portfolio":
        await showPortfolio()
        break
      case "recommendations":
        await runRecommendations()
        break
      case "outlook":
        await showLongTermOutlook()
        break
      case "funds":
        await runMoveFunds()
        break
      case "history":
        await showHistory()
        break
      case "profile":
        await runOnboarding()
        break
      case "sim-balance": await setSimBalance(); break
      case "sim-reset":   await resetSim();      break
      case "sim-ledger":  await viewSimLedger();  break
    }
  }
}

async function showHistory(): Promise<void> {
  const spinner = p.spinner()
  spinner.start("Loading transactions...")

  try {
    const transactions = await getTransactionHistory(undefined, undefined, "TRADE")
    spinner.stop("Transactions loaded.")

    if (transactions.length === 0) {
      console.log(chalk.dim("\n  No transactions found.\n"))
      return
    }

    console.log()
    console.log(chalk.bold("  Transaction History"))
    console.log(chalk.dim("  ─────────────────────────────────────────────────"))
    for (const t of transactions.slice(0, 20)) {
      const date = new Date(t.timestamp).toLocaleDateString()
      const dir = t.direction ? `${t.direction} ` : ""
      const sym = t.symbol ? `${t.symbol} ` : ""
      console.log(
        `  ${chalk.dim(date.padEnd(12))}${chalk.cyan(t.type.padEnd(14))}${dir}${sym}$${t.amount.toFixed(2)}  ${chalk.dim(t.status)}`
      )
    }
    console.log()
  } catch (err) {
    spinner.stop("Failed to load transactions.")
    console.error(chalk.red(`\n  Error: ${(err as Error).message}\n`))
  }
}
