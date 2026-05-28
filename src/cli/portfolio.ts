// src/cli/portfolio.ts
import * as p from "@clack/prompts"
import chalk from "chalk"
import {
  getCheckingBalance,
  getStockPortfolio,
} from "../actions/portfolio.js"
import { renderPortfolio } from "../display/portfolio.js"

export async function showPortfolio(): Promise<void> {
  const spinner = p.spinner()
  spinner.start("Fetching your portfolio...")

  try {
    const [balance, holdings] = await Promise.all([
      getCheckingBalance(),
      getStockPortfolio(),
    ])
    spinner.stop("Portfolio loaded.")
    renderPortfolio(balance, holdings)
  } catch (err) {
    spinner.stop("Failed to load portfolio.")
    console.error(chalk.red(`\n  Error: ${(err as Error).message}\n`))
  }
}
