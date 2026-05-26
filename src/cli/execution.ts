// src/cli/execution.ts
import * as p from "@clack/prompts"
import chalk from "chalk"
import { moveFunds } from "../actions/trading.js"
import { getCheckingBalance } from "../actions/portfolio.js"
import { renderSentinel } from "../display/agents.js"
import type { SentinelPreview } from "../actions/trading.js"

export async function runMoveFunds(): Promise<void> {
  const directionChoice = await p.select({
    message: "Which operation?",
    options: [
      { value: "DEPOSIT", label: "Deposit funds" },
      { value: "WITHDRAWAL", label: "Withdraw funds" },
    ],
  })
  if (p.isCancel(directionChoice)) return
  const direction = directionChoice as "DEPOSIT" | "WITHDRAWAL"

  const amountStr = await p.text({
    message: "Amount (USD)",
    placeholder: "100",
    validate: (v) => {
      const n = parseFloat(v)
      if (isNaN(n) || n <= 0) return "Must be a positive number"
      return undefined
    },
  })
  if (p.isCancel(amountStr)) return
  const amount = parseFloat(amountStr as string)

  const spinner = p.spinner()
  spinner.start("Sentinel reviewing...")

  let balance
  try {
    balance = await getCheckingBalance()
    spinner.stop("")
  } catch (err) {
    spinner.stop("Failed to fetch balance.")
    console.error(chalk.red(`  Error: ${(err as Error).message}`))
    return
  }

  const postBalance =
    direction === "DEPOSIT" ? balance.available + amount : balance.available - amount

  const preview: SentinelPreview = {
    symbol: "USD",
    direction: direction === "DEPOSIT" ? "BUY" : "SELL",
    operationLabel: direction,
    amount,
    estimatedPrice: 1,
    fee: 0,
    feeRate: 0,
    totalDeducted: direction === "WITHDRAWAL" ? amount : 0,
    postTradeBalance: postBalance,
    withinBudget: true,
    warnings:
      direction === "WITHDRAWAL" && postBalance < 10
        ? ["Withdrawal would leave balance below $10"]
        : [],
  }
  renderSentinel(preview)

  const confirm = await p.confirm({
    message: `Confirm ${direction.toLowerCase()} of $${amount}?`,
    initialValue: false,
  })
  if (p.isCancel(confirm) || !confirm) return

  const execSpinner = p.spinner()
  execSpinner.start(`Processing ${direction.toLowerCase()}...`)

  try {
    const result = await moveFunds(direction, amount)
    execSpinner.stop("")
    if (result.simulated) {
      console.log(
        chalk.yellow(`  ⚡ Simulated: ${result.type} $${result.amount} — ${result.message}`)
      )
    } else {
      console.log(
        chalk.green(`  ✓ ${result.type} $${result.amount} · Status: ${result.status}`)
      )
    }
  } catch (err) {
    execSpinner.stop("")
    console.error(chalk.red(`  ✗ Failed: ${(err as Error).message}`))
  }
}
