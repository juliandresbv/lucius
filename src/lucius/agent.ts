// src/lucius/agent.ts
import Anthropic from "@anthropic-ai/sdk"
import chalk from "chalk"
import * as readline from "node:readline/promises"
import { stdin as input, stdout as output } from "node:process"
import { luciusTools } from "./tools.js"
import { buildSystemPrompt } from "./system-prompt.js"
import {
  getCheckingBalance,
  getStockPortfolio,
  getPortfolioProjection,
} from "../actions/portfolio.js"
import { searchAssets } from "../actions/assets.js"
import { getRecommendations } from "../actions/recommendations.js"
import { getSentinelPreview, executeTrade, moveFunds } from "../actions/trading.js"
import { getTransactionHistory } from "../actions/history.js"
import { renderSentinel, renderVantage, renderMeridian } from "../display/agents.js"
import { loadProfile } from "../storage/profile.js"
import type { UserProfile } from "../storage/profile.js"
import type { CheckingBalance } from "../actions/portfolio.js"

const anthropic = new Anthropic()

type Message = Anthropic.MessageParam

export async function runLuciusAgent(): Promise<void> {
  const profile = await loadProfile()
  if (!profile) {
    console.error(chalk.red("\n  No profile found — run onboarding first.\n"))
    return
  }

  process.stdout.write(chalk.dim("\n  Initializing Lucius...\n"))
  const [balance, holdings] = await Promise.all([
    getCheckingBalance(),
    getStockPortfolio(),
  ])

  const systemPrompt = buildSystemPrompt(profile, balance, holdings)
  const history: Message[] = []

  const rl = readline.createInterface({ input, output })

  console.log()
  console.log(
    chalk.bold.white("  Lucius") +
      chalk.dim(" is ready. Type ") +
      chalk.cyan("exit") +
      chalk.dim(" to return to the menu.")
  )
  console.log()

  while (true) {
    let userInput: string
    try {
      userInput = await rl.question(chalk.cyan("  You: "))
    } catch {
      break
    }

    if (userInput.trim().toLowerCase() === "exit") break
    if (!userInput.trim()) continue

    history.push({ role: "user", content: userInput })

    let response: Anthropic.Message
    try {
      response = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 4096,
        system: systemPrompt,
        tools: luciusTools,
        messages: history,
      })
    } catch (err) {
      console.error(chalk.red(`\n  Error: ${(err as Error).message}\n`))
      history.pop()
      continue
    }

    // Agentic loop: keep going while there are tool_use calls
    while (response.stop_reason === "tool_use") {
      const toolResults: Anthropic.ToolResultBlockParam[] = []

      for (const block of response.content) {
        if (block.type === "text" && block.text.trim()) {
          console.log(chalk.white("\n  Lucius: ") + block.text + "\n")
        }
        if (block.type === "tool_use") {
          const result = await dispatch(block, profile, balance)
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: JSON.stringify(result),
          })
        }
      }

      history.push({ role: "assistant", content: response.content })
      history.push({ role: "user", content: toolResults })

      response = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 4096,
        system: systemPrompt,
        tools: luciusTools,
        messages: history,
      })
    }

    // Final text response
    const finalText = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b as Anthropic.TextBlock).text)
      .join("")

    if (finalText.trim()) {
      console.log(chalk.white("\n  Lucius: ") + finalText + "\n")
    }

    history.push({ role: "assistant", content: response.content })
  }

  rl.close()
  console.log(chalk.dim("\n  Returning to menu...\n"))
}

async function dispatch(
  block: Anthropic.ToolUseBlock,
  profile: UserProfile,
  balance: CheckingBalance
): Promise<unknown> {
  const inp = block.input as Record<string, unknown>

  switch (block.name) {
    case "get_checking_balance":
      return getCheckingBalance()

    case "get_stock_portfolio":
      return getStockPortfolio()

    case "get_portfolio_projection": {
      const projection = await getPortfolioProjection()
      renderMeridian(projection, profile.expectedReturn)
      return projection
    }

    case "search_assets":
      return searchAssets(
        inp.category as string | undefined,
        (inp.limit as number | undefined) ?? 10
      )

    case "get_recommendations": {
      const [currentBalance, holdings, assets] = await Promise.all([
        getCheckingBalance(),
        getStockPortfolio(),
        searchAssets(profile.sectors[0] ?? "Technology", 10),
      ])
      const recs = await getRecommendations(profile, holdings, currentBalance, assets)
      renderVantage(recs, currentBalance.available, profile.monthlyBudget)
      return recs
    }

    case "get_sentinel_preview": {
      const preview = await getSentinelPreview(
        inp.symbol as string,
        inp.direction as "BUY" | "SELL",
        inp.amount as number
      )
      renderSentinel(preview)
      return preview
    }

    case "execute_trade":
      return executeTrade(
        inp.symbol as string,
        inp.direction as "BUY" | "SELL",
        inp.amount as number
      )

    case "move_funds":
      return moveFunds(inp.type as "DEPOSIT" | "WITHDRAWAL", inp.amount as number)

    case "get_transaction_history":
      return getTransactionHistory(
        inp.from_date as string | undefined,
        inp.to_date as string | undefined,
        inp.type as string | undefined
      )

    default:
      return { error: `Unknown tool: ${block.name}` }
  }
}
