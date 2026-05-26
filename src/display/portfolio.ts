// src/display/portfolio.ts
import chalk from "chalk"
import type { PortfolioHolding, CheckingBalance } from "../actions/portfolio.js"

export function renderPortfolio(
  balance: CheckingBalance,
  holdings: PortfolioHolding[]
): void {
  console.log()
  console.log(chalk.bold("  Portfolio Overview"))
  console.log(chalk.dim("  ────────────────────────────────────────────"))
  console.log(
    `  ${chalk.dim("Checking balance:")}  ${chalk.bold.green(
      `$${balance.available.toFixed(2)} ${balance.currency}`
    )}`
  )
  console.log()

  if (holdings.length === 0) {
    console.log(chalk.dim("  No stock holdings yet."))
  } else {
    const totalValue = holdings.reduce((sum, h) => sum + h.value, 0)
    const showAvg = holdings.some((h) => h.avgPrice !== undefined && h.avgPrice > 0)

    const header = showAvg
      ? "  Symbol   Shares   Price         Value         Avg           P&L"
      : "  Symbol   Shares   Price         Value"
    const divider = showAvg
      ? "  " + "─".repeat(64)
      : "  " + "─".repeat(42)

    console.log(chalk.dim(header))
    console.log(chalk.dim(divider))

    for (const h of holdings) {
      const symbol = h.symbol.padEnd(9)
      const shares = h.shares.toFixed(2).padEnd(9)
      const price = `$${h.currentPrice.toFixed(2)}`.padEnd(14)
      const value = `$${h.value.toFixed(2)}`

      if (!showAvg) {
        console.log(`  ${chalk.cyan(symbol)}${shares}${price}${chalk.bold(value)}`)
        continue
      }

      const valuePadded = value.padEnd(14)
      if (h.avgPrice !== undefined && h.avgPrice > 0) {
        const avg = `$${h.avgPrice.toFixed(2)}`.padEnd(14)
        const gainPct = ((h.currentPrice - h.avgPrice) / h.avgPrice) * 100
        const isGain = gainPct >= 0
        const pnl = `${isGain ? "+" : ""}${gainPct.toFixed(1)}%`
        const pnlColored = isGain ? chalk.green(pnl) : chalk.red(pnl)
        console.log(`  ${chalk.cyan(symbol)}${shares}${price}${chalk.bold(valuePadded)}${avg}${pnlColored}`)
      } else {
        console.log(`  ${chalk.cyan(symbol)}${shares}${price}${chalk.bold(valuePadded)}${chalk.dim("—             —")}`)
      }
    }

    console.log(chalk.dim(divider))
    console.log(
      `  ${chalk.dim("Total invested:")}    ${chalk.bold.green(`$${totalValue.toFixed(2)}`)}`
    )
  }
  console.log()
}
