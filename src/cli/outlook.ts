// src/cli/outlook.ts
import * as p from "@clack/prompts"
import chalk from "chalk"
import { getPortfolioProjection } from "../actions/portfolio.js"
import { loadProfile } from "../storage/profile.js"
import { renderMeridian } from "../display/agents.js"

export async function showLongTermOutlook(): Promise<void> {
  const profile = await loadProfile()
  if (!profile) {
    console.error(chalk.red("\n  No profile found — run onboarding first.\n"))
    return
  }

  const spinner = p.spinner()
  spinner.start("Meridian is computing your projection...")

  try {
    const projection = await getPortfolioProjection()
    spinner.stop("Projection ready.")
    renderMeridian(projection, profile.expectedReturn)
  } catch (err) {
    spinner.stop("Projection failed.")
    console.error(chalk.red(`\n  Error: ${(err as Error).message}\n`))
  }
}
