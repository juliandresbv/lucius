// src/cli/simulation.ts
import * as p from "@clack/prompts"
import chalk from "chalk"
import { loadSimState, resetSimState, type SimTransaction } from "../storage/sim-state.js"

export async function setSimBalance(): Promise<void> {
  const amountStr = await p.text({
    message: "New starting balance (USD)",
    placeholder: "10000",
    validate: (v) => {
      const n = parseFloat(v)
      if (isNaN(n) || n <= 0) return "Must be a positive number"
      return undefined
    },
  })
  if (p.isCancel(amountStr)) return

  const amount = parseFloat(amountStr as string)
  await resetSimState(amount)
  const bal = amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  console.log(chalk.cyan(`\n  ⚡ Sim balance set to $${bal}. Holdings and ledger cleared.\n`))
}

export async function resetSim(): Promise<void> {
  const sim = await loadSimState()
  const bal = sim.initialBalance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const confirm = await p.confirm({
    message: `Reset simulation to $${bal}? This clears all holdings and transactions.`,
    initialValue: false,
  })
  if (p.isCancel(confirm) || !confirm) return

  await resetSimState()
  console.log(chalk.cyan(`\n  ⚡ Simulation reset to $${bal}.\n`))
}

export async function viewSimLedger(): Promise<void> {
  const sim = await loadSimState()

  if (sim.transactions.length === 0) {
    console.log(chalk.dim("\n  No simulated transactions yet.\n"))
    return
  }

  const currentBal = sim.balance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  console.log()
  console.log(chalk.bold.cyan("  ⚡ Sim Ledger") + chalk.dim(`  (current balance: $${currentBal})`))
  console.log(chalk.dim("  ──────────────────────────────────────────────────────────────"))

  let running = sim.initialBalance
  for (const t of sim.transactions) {
    const delta = computeDelta(t)
    running += delta
    const date = new Date(t.timestamp).toLocaleDateString()
    const typeLabel = t.type.padEnd(12)
    const sym = (t.symbol ?? "USD").padEnd(6)
    const feeStr = t.fee > 0 ? chalk.dim(` fee:$${t.fee.toFixed(2)}`) : ""
    const sign = delta >= 0 ? chalk.green(`+$${Math.abs(delta).toFixed(2)}`) : chalk.red(`-$${Math.abs(delta).toFixed(2)}`)
    console.log(
      `  ${chalk.dim(date.padEnd(12))}${chalk.cyan(typeLabel)}${sym}  ${sign}${feeStr}  ${chalk.dim("bal:")}$${running.toFixed(2)}`
    )
  }
  console.log()
}

function computeDelta(t: SimTransaction): number {
  switch (t.type) {
    case "BUY":        return -(t.amount + t.fee)
    case "SELL":       return t.amount - t.fee
    case "DEPOSIT":    return t.amount
    case "WITHDRAWAL": return -t.amount
  }
}

export async function runSimMenu(): Promise<void> {
  const action = await p.select({
    message: "Simulation actions",
    options: [
      {
        value: "balance",
        label: "Set starting balance",
        hint: "configure simulation funds",
      },
      {
        value: "reset",
        label: "Reset simulation",
        hint: "clear trades and start fresh",
      },
      {
        value: "ledger",
        label: "View sim ledger",
        hint: "browse transaction history",
      },
      { value: "back", label: "Back" },
    ],
  })

  if (p.isCancel(action)) return

  switch (action) {
    case "balance":
      await setSimBalance()
      break
    case "reset":
      await resetSim()
      break
    case "ledger":
      await viewSimLedger()
      break
    case "back":
      return
  }
}
