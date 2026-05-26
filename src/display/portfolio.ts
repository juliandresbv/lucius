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
    console.log(chalk.dim("  Symbol   Shares   Price         Value"))
    console.log(chalk.dim("  ────────────────────────────────────────────"))
    for (const h of holdings) {
      const symbol = h.symbol.padEnd(9)
      const shares = h.shares.toFixed(2).padEnd(9)
      const price = `$${h.currentPrice.toFixed(2)}`.padEnd(14)
      const value = `$${h.value.toFixed(2)}`
      console.log(
        `  ${chalk.cyan(symbol)}${shares}${price}${chalk.bold(value)}`
      )

      // Print sub-line if avgPrice is available
      if (h.avgPrice !== undefined) {
        const avgCostValue = `$${h.avgPrice.toFixed(2)}`
        const gainLoss = h.currentPrice - h.avgPrice
        const gainLossPercent = (gainLoss / h.avgPrice) * 100
        const sign = gainLossPercent >= 0 ? "+" : ""
        const gainLossColor = gainLossPercent >= 0 ? chalk.green : chalk.red

        console.log(
          `    ${chalk.dim("avg")} ${avgCostValue}  ${gainLossColor(`${sign}${gainLossPercent.toFixed(1)}%`)}`
        )
      }
    }
    console.log(chalk.dim("  ────────────────────────────────────────────"))
    console.log(
      `  ${chalk.dim("Total invested:")}    ${chalk.bold.green(`$${totalValue.toFixed(2)}`)}`
    )
  }
  console.log()
}
