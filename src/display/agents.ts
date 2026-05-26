// src/display/agents.ts
import chalk from "chalk"
import type { Recommendation } from "../actions/recommendations.js"
import type { SentinelPreview } from "../actions/trading.js"
import type { PortfolioProjection } from "../actions/portfolio.js"

const BOX_WIDTH = 58
const MAX_CONTENT = BOX_WIDTH - 4  // 54 visible chars between the borders

// Strip ANSI escape codes to get the visible character count
// eslint-disable-next-line no-control-regex
const ANSI_RE = /\x1b\[[0-9;]*m/g
function visibleLen(str: string): number {
  return str.replace(ANSI_RE, "").length
}

function boxTop(title: string): string {
  const pad = BOX_WIDTH - title.length - 5
  return chalk.dim(`  ┌─ ${chalk.bold.white(title)} ${"─".repeat(Math.max(0, pad))}┐`)
}

function boxLine(text: string): string {
  // Truncate to visible width if too long (strip colors on overflow — edge case)
  const content =
    visibleLen(text) > MAX_CONTENT
      ? text.replace(ANSI_RE, "").slice(0, MAX_CONTENT)
      : text
  // Pad based on visible length so the right border always lines up
  const padding = " ".repeat(MAX_CONTENT - visibleLen(content))
  return chalk.dim("  │ ") + content + padding + chalk.dim(" │")
}

function boxBottom(): string {
  return chalk.dim("  └" + "─".repeat(BOX_WIDTH - 2) + "┘")
}

export function renderVantage(
  recommendations: Recommendation[],
  balance: number,
  sessionBudget: number
): void {
  const sells = recommendations.filter((r) => r.action === "SELL")
  const buys = recommendations.filter((r) => r.action === "BUY")

  console.log()
  console.log(boxTop("Vantage"))
  console.log(
    boxLine(
      chalk.dim(
        `Session budget: $${sessionBudget}  ·  Available: $${balance.toFixed(2)}`
      )
    )
  )
  console.log(boxLine(""))

  if (recommendations.length === 0) {
    console.log(
      boxLine(chalk.yellow("No recommendations for current balance / profile."))
    )
  } else {
    if (sells.length > 0) {
      console.log(boxLine(chalk.bold.red("SELL")))
      for (const r of sells) {
        console.log(
          boxLine(
            chalk.red(
              `${r.symbol.padEnd(6)} $${String(r.amount).padStart(6)}  ${r.rationale}`
            )
          )
        )
      }
    }
    if (sells.length > 0 && buys.length > 0) {
      console.log(boxLine(""))
    }
    if (buys.length > 0) {
      console.log(boxLine(chalk.bold.cyan("BUY")))
      for (const r of buys) {
        console.log(
          boxLine(
            chalk.cyan(
              `${r.symbol.padEnd(6)} $${String(r.amount).padStart(6)}  ${r.rationale}`
            )
          )
        )
      }
    }
    if (sells.length > 0) {
      console.log(boxLine(""))
      console.log(boxLine(chalk.dim("SELLs will execute first")))
    }
  }

  console.log(boxBottom())
  console.log()
}

export function renderSentinel(preview: SentinelPreview): void {
  console.log()
  console.log(boxTop("Sentinel"))
  const dirLabel = preview.operationLabel ?? preview.direction
  const coloredDir =
    dirLabel === "SELL" || dirLabel === "WITHDRAWAL"
      ? chalk.red(dirLabel)
      : chalk.cyan(dirLabel)
  console.log(
    boxLine(
      chalk.dim("Simulated: ") +
        coloredDir +
        chalk.dim(` ${preview.symbol} $${preview.amount}`)
    )
  )
  console.log(
    boxLine(
      `Fee: $${preview.fee.toFixed(2)} (${(preview.feeRate * 100).toFixed(2)}%)  ·  Total deducted: $${preview.totalDeducted.toFixed(2)}`
    )
  )
  console.log(
    boxLine(`Post-trade checking balance: $${preview.postTradeBalance.toFixed(2)}`)
  )
  if (preview.warnings.length > 0) {
    for (const w of preview.warnings) {
      console.log(boxLine(chalk.yellow(`⚠  ${w}`)))
    }
  } else {
    console.log(
      boxLine(chalk.green("No anomalies. Within monthly budget. Clear."))
    )
  }
  console.log(boxBottom())
  console.log()
}

export function renderMeridian(
  projection: PortfolioProjection,
  expectedReturn: number
): void {
  const returnPct = (expectedReturn * 100).toFixed(0)
  const horizonLabel: Record<string, string> = {
    short: "short-term (<2 years)",
    medium: "medium-term (2–7 years)",
    long: "long-term (7+ years)",
  }
  console.log()
  console.log(boxTop("Meridian"))
  console.log(
    boxLine(
      `At $${projection.monthlyBudget}/month (${returnPct}% return, ${horizonLabel[projection.timeHorizon]}),`
    )
  )
  console.log(
    boxLine(`projected value: ~$${projection.projectedValue.toLocaleString()}`)
  )
  console.log(
    boxLine(
      projection.onTrack
        ? chalk.green("You're on track for your investment horizon.")
        : chalk.yellow("Consider increasing your monthly contribution.")
    )
  )
  console.log(boxBottom())
  console.log()
}
