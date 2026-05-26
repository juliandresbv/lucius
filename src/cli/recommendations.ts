// src/cli/recommendations.ts
import * as p from "@clack/prompts"
import chalk from "chalk"
import { getCheckingBalance, getStockPortfolio } from "../actions/portfolio.js"
import { searchAssets } from "../actions/assets.js"
import { getRecommendations, type Recommendation } from "../actions/recommendations.js"
import { getSentinelPreview, executeTrade } from "../actions/trading.js"
import { renderVantage, renderSentinel } from "../display/agents.js"
import { loadProfile } from "../storage/profile.js"
import type { CheckingBalance } from "../actions/portfolio.js"
import type { AssetInfo } from "../actions/assets.js"

interface FetchResult {
  balance: CheckingBalance
  holdings: Awaited<ReturnType<typeof getStockPortfolio>>
  assets: AssetInfo[]
  recommendations: Recommendation[]
}

export async function runRecommendations(): Promise<void> {
  const profile = await loadProfile()
  if (!profile) {
    console.error(chalk.red("\n  No profile found — run onboarding first.\n"))
    return
  }

  const spinner = p.spinner()
  spinner.start("Vantage is analyzing your portfolio...")

  let result: FetchResult | undefined

  try {
    const sectors = profile.sectors.length > 0 ? profile.sectors : ["Technology"]
    const [[balance, holdings], sectorBatches] = await Promise.all([
      Promise.all([getCheckingBalance(), getStockPortfolio()]),
      Promise.all(sectors.map(s => searchAssets(s, 10))),
    ])
    // Merge and deduplicate assets across all sectors
    const seen = new Set<string>()
    const assets: AssetInfo[] = []
    for (const batch of sectorBatches) {
      for (const a of batch) {
        if (!seen.has(a.symbol)) {
          seen.add(a.symbol)
          assets.push(a)
        }
      }
    }
    const recommendations = await getRecommendations(profile, holdings, balance, assets)
    result = { balance, holdings, assets, recommendations }
    spinner.stop("Analysis complete.")
  } catch (err) {
    spinner.stop("Analysis failed.")
    console.error(chalk.red(`\n  Error: ${(err as Error).message}\n`))
    return
  }

  const { balance, recommendations } = result

  renderVantage(recommendations, balance.available, profile.monthlyBudget)

  if (recommendations.length === 0) return

  const execute = await p.confirm({
    message: "Would you like to execute these recommendations?",
    initialValue: false,
  })
  if (p.isCancel(execute) || !execute) return

  for (const rec of recommendations) {
    const previewSpinner = p.spinner()
    previewSpinner.start(`Sentinel reviewing ${rec.symbol}...`)

    let preview
    try {
      preview = await getSentinelPreview(
        rec.symbol,
        rec.action as "BUY" | "SELL",
        rec.amount
      )
      previewSpinner.stop("")
    } catch (err) {
      previewSpinner.stop(`Sentinel check failed for ${rec.symbol}.`)
      console.error(chalk.red(`  Skipping ${rec.symbol}: ${(err as Error).message}`))
      continue
    }

    renderSentinel(preview)

    if (preview.warnings.length > 0) {
      const proceed = await p.confirm({
        message: "Sentinel flagged warnings. Proceed anyway?",
        initialValue: false,
      })
      if (p.isCancel(proceed) || !proceed) {
        console.log(chalk.dim(`  Skipped ${rec.symbol}.`))
        continue
      }
    }

    const confirm = await p.confirm({
      message: `Execute: ${rec.action} ${rec.symbol} $${rec.amount}?`,
      initialValue: false,
    })
    if (p.isCancel(confirm) || !confirm) {
      console.log(chalk.dim(`  Skipped ${rec.symbol}.`))
      continue
    }

    const execSpinner = p.spinner()
    execSpinner.start(`Executing ${rec.action} ${rec.symbol}...`)

    try {
      const tradeResult = await executeTrade(
        rec.symbol,
        rec.action as "BUY" | "SELL",
        rec.amount
      )
      execSpinner.stop("")
      if (tradeResult.simulated) {
        console.log(
          chalk.yellow(
            `  ⚡ Simulated: ${tradeResult.symbol} — ${tradeResult.message}`
          )
        )
      } else {
        console.log(
          chalk.green(
            `  ✓ ${tradeResult.direction} ${tradeResult.symbol} $${tradeResult.amount} executed · Status: ${tradeResult.status}`
          )
        )
      }
    } catch (err) {
      execSpinner.stop("")
      console.error(chalk.red(`  ✗ Failed: ${(err as Error).message}`))
    }
  }
}
