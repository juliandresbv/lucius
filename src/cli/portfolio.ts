// src/cli/portfolio.ts
import * as p from "@clack/prompts"
import chalk from "chalk"
import {
  getCheckingBalance,
  getStockPortfolio,
  getRoboAdvisorPortfolio,
} from "../actions/portfolio.js"
import { renderPortfolio } from "../display/portfolio.js"

export async function showPortfolio(): Promise<void> {
  const spinner = p.spinner()
  spinner.start("Fetching your portfolio...")

  try {
    const [balance, holdings, robo] = await Promise.all([
      getCheckingBalance(),
      getStockPortfolio(),
      getRoboAdvisorPortfolio(),
    ])
    spinner.stop("Portfolio loaded.")

    renderPortfolio(balance, holdings)

    if (robo) {
      console.log(chalk.bold("  Robo Advisor"))
      console.log(chalk.dim("  ──────────────────────────────────────────"))
      console.log(
        `  Total balance: ${chalk.bold.green(`$${robo.totalBalance.toFixed(2)}`)}`
      )
      console.log(
        `  Daily change:  ${
          robo.dailyVariation >= 0
            ? chalk.green(`+$${robo.dailyVariation.toFixed(2)}`)
            : chalk.red(`$${robo.dailyVariation.toFixed(2)}`)
        }`
      )
      console.log()
    }
  } catch (err) {
    spinner.stop("Failed to load portfolio.")
    console.error(chalk.red(`\n  Error: ${(err as Error).message}\n`))
  }
}
