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

  // Fetch balance first — needed to validate the session budget input
  const balanceSpinner = p.spinner()
  balanceSpinner.start("Fetching balance...")

  let balance: CheckingBalance
  try {
    balance = await getCheckingBalance()
    balanceSpinner.stop("")
  } catch (err) {
    balanceSpinner.stop("Failed to fetch balance.")
    console.error(chalk.red(`\n  Error: ${(err as Error).message}\n`))
    return
  }

  // Session budget prompt
  const budgetStr = await p.text({
    message: `How much do you want to invest today? (USD, max $${balance.available.toFixed(2)})`,
    placeholder: "300",
    validate: (v) => {
      const n = parseFloat(v)
      if (isNaN(n) || n <= 0) return "Must be a positive number"
      if (n > balance.available)
        return `Cannot exceed available balance ($${balance.available.toFixed(2)})`
      return undefined
    },
  })
  if (p.isCancel(budgetStr)) return
  const sessionBudget = parseFloat(budgetStr as string)

  // Fetch portfolio, assets, and Claude recommendations
  const spinner = p.spinner()
  spinner.start("Vantage is analyzing your portfolio...")

  let result: FetchResult | undefined
  try {
    const sectors = profile.sectors.length > 0 ? profile.sectors : ["Technology"]
    const [holdings, sectorBatches] = await Promise.all([
      getStockPortfolio(),
      Promise.all(sectors.map((s) => searchAssets(s, 10))),
    ])
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
    const recommendations = await getRecommendations(
      profile,
      holdings,
      balance,
      assets,
      sessionBudget
    )
    result = { holdings, assets, recommendations }
    spinner.stop("Analysis complete.")
  } catch (err) {
    spinner.stop("Analysis failed.")
    console.error(chalk.red(`\n  Error: ${(err as Error).message}\n`))
    return
  }

  const { recommendations } = result

  renderVantage(recommendations, balance.available, sessionBudget)

  if (recommendations.length === 0) return

  const sells = recommendations.filter((r) => r.action === "SELL")
  const buys  = recommendations.filter((r) => r.action === "BUY")

  // When both action types are present, let the user choose which to run
  let runSells = sells
  let runBuys  = buys

  if (sells.length > 0 && buys.length > 0) {
    const actionOptions = [
      { value: "sell", label: `SELL  (${sells.length} trade${sells.length > 1 ? "s" : ""})` },
      { value: "buy",  label: `BUY   (${buys.length} trade${buys.length > 1 ? "s" : ""})` },
    ]
    const selected = await p.multiselect({
      message: "Select operations to perform:",
      options: actionOptions,
      initialValues: ["sell", "buy"],
      required: false,
    })
    if (p.isCancel(selected) || (selected as string[]).length === 0) return
    const sel = new Set(selected as string[])
    runSells = sel.has("sell") ? sells : []
    runBuys  = sel.has("buy")  ? buys  : []
  }

  // Phase 1: SELLs
  for (const rec of runSells) {
    await executeWithOverride(rec)
  }

  // Phase 2: BUYs with cumulative spend tracking
  let cumulativeSpent = 0
  for (const rec of runBuys) {
    const spent = await executeBuyWithOverride(rec, balance.available, cumulativeSpent)
    cumulativeSpent += spent
  }
}

// Execute a SELL trade with Sentinel review and Yes / No / Edit override.
async function executeWithOverride(rec: Recommendation): Promise<void> {
  if (!Number.isFinite(rec.amount) || rec.amount <= 0) {
    console.log(chalk.red(`  Skipping ${rec.symbol}: invalid amount.`))
    return
  }
  let currentAmount = rec.amount

  while (true) {
    const previewSpinner = p.spinner()
    previewSpinner.start(`Sentinel reviewing ${rec.symbol}...`)

    let preview
    try {
      preview = await getSentinelPreview(rec.symbol, "SELL", currentAmount)
      previewSpinner.stop("")
    } catch (err) {
      previewSpinner.stop(`Sentinel check failed for ${rec.symbol}.`)
      console.error(chalk.red(`  Skipping ${rec.symbol}: ${(err as Error).message}`))
      return
    }

    renderSentinel(preview)

    if (preview.warnings.length > 0) {
      const proceed = await p.confirm({
        message: "Sentinel flagged warnings. Proceed anyway?",
        initialValue: false,
      })
      if (p.isCancel(proceed) || !proceed) {
        console.log(chalk.dim(`  Skipped ${rec.symbol}.`))
        return
      }
    }

    const fullLabel = rec.isFullPosition && currentAmount === rec.amount ? " (full position)" : ""
    const choice = await p.select({
      message: `Execute SELL ${rec.symbol} $${currentAmount}${fullLabel}?`,
      options: [
        { value: "yes", label: "Yes" },
        { value: "no", label: "No" },
        { value: "edit", label: "Edit amount" },
      ],
    })
    if (p.isCancel(choice) || choice === "no") {
      console.log(chalk.dim(`  Skipped ${rec.symbol}.`))
      return
    }
    if (choice === "edit") {
      const newAmountStr = await p.text({
        message: `New amount for SELL ${rec.symbol} (USD, min $1)`,
        initialValue: String(currentAmount),
        validate: (v) => {
          const n = parseFloat(v)
          if (isNaN(n) || n < 1) return "Must be at least $1"
          return undefined
        },
      })
      if (p.isCancel(newAmountStr)) {
        console.log(chalk.dim(`  Skipped ${rec.symbol}.`))
        return
      }
      currentAmount = parseFloat(newAmountStr as string)
      continue
    }
    break
  }

  await runTrade(rec.symbol, "SELL", currentAmount)
}

// Execute a BUY trade with cumulative tracking. Returns amount spent (0 on skip/fail).
async function executeBuyWithOverride(
  rec: Recommendation,
  availableBalance: number,
  cumulativeSpent: number
): Promise<number> {
  let currentAmount = rec.amount

  while (true) {
    const previewSpinner = p.spinner()
    previewSpinner.start(`Sentinel reviewing ${rec.symbol}...`)

    let preview
    try {
      preview = await getSentinelPreview(rec.symbol, "BUY", currentAmount)
      previewSpinner.stop("")
    } catch (err) {
      previewSpinner.stop(`Sentinel check failed for ${rec.symbol}.`)
      console.error(chalk.red(`  Skipping ${rec.symbol}: ${(err as Error).message}`))
      return 0
    }

    renderSentinel(preview)

    if (preview.warnings.length > 0) {
      const proceed = await p.confirm({
        message: "Sentinel flagged warnings. Proceed anyway?",
        initialValue: false,
      })
      if (p.isCancel(proceed) || !proceed) {
        console.log(chalk.dim(`  Skipped ${rec.symbol}.`))
        return 0
      }
    }

    const choice = await p.select({
      message: `Execute BUY ${rec.symbol} $${currentAmount}?`,
      options: [
        { value: "yes", label: "Yes" },
        { value: "no", label: "No" },
        { value: "edit", label: "Edit amount" },
      ],
    })
    if (p.isCancel(choice) || choice === "no") {
      console.log(chalk.dim(`  Skipped ${rec.symbol}.`))
      return 0
    }
    if (choice === "edit") {
      const remaining = availableBalance - cumulativeSpent
      const newAmountStr = await p.text({
        message: `New amount for BUY ${rec.symbol} (USD, min $1, max $${remaining.toFixed(2)})`,
        initialValue: String(currentAmount),
        validate: (v) => {
          const n = parseFloat(v)
          if (isNaN(n) || n < 1) return "Must be at least $1"
          if (n > remaining)
            return `Cannot exceed remaining budget ($${remaining.toFixed(2)})`
          return undefined
        },
      })
      if (p.isCancel(newAmountStr)) {
        console.log(chalk.dim(`  Skipped ${rec.symbol}.`))
        return 0
      }
      currentAmount = parseFloat(newAmountStr as string)
      continue
    }
    break
  }

  const success = await runTrade(rec.symbol, "BUY", currentAmount)
  return success ? currentAmount : 0
}

// Shared trade executor. Returns true on success.
async function runTrade(
  symbol: string,
  direction: "BUY" | "SELL",
  amount: number
): Promise<boolean> {
  const execSpinner = p.spinner()
  execSpinner.start(`Executing ${direction} ${symbol}...`)

  try {
    const tradeResult = await executeTrade(symbol, direction, amount)
    execSpinner.stop("")
    if (tradeResult.simulated) {
      console.log(
        chalk.yellow(`  ⚡ Simulated: ${tradeResult.symbol} — ${tradeResult.message}`)
      )
    } else {
      const color = direction === "SELL" ? chalk.red : chalk.cyan
      console.log(
        color(
          `  ✓ ${direction} ${tradeResult.symbol} $${tradeResult.amount} executed · Status: ${tradeResult.status}`
        )
      )
    }
    return true
  } catch (err) {
    execSpinner.stop("")
    console.error(chalk.red(`  ✗ Failed: ${(err as Error).message}`))
    return false
  }
}
