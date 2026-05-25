// e2e/qa-run.ts — end-to-end action layer QA with DRY_RUN=true
// Uses PROFILE_FILE=profile.test.json so the production profile is never touched.
import "dotenv/config"
process.env.PROFILE_FILE = "profile.test.json"
import chalk from "chalk"

// ── helpers ──────────────────────────────────────────────────────────────────

function pass(label: string, detail = "") {
  console.log(chalk.green("  ✓") + " " + chalk.bold(label) + (detail ? chalk.dim("  " + detail) : ""))
}

function fail(label: string, err: unknown) {
  const msg = err instanceof Error ? err.message : String(err)
  console.log(chalk.red("  ✗") + " " + chalk.bold(label) + chalk.red("  " + msg))
}

function section(title: string) {
  console.log("\n" + chalk.bold.white("  " + title))
  console.log(chalk.dim("  " + "─".repeat(50)))
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log()
  console.log(chalk.bold.white("  Lucius QA Run") + chalk.dim("  DRY_RUN=" + process.env.DRY_RUN))
  console.log(chalk.dim("  " + "═".repeat(50)))

  // ── 1. Profile ──────────────────────────────────────────────────────────
  section("1. Profile storage")
  const { saveProfile, loadProfile } = await import("../src/storage/profile.js")

  let profile
  try {
    profile = await saveProfile({
      riskTolerance: "moderate",
      monthlyBudget: 300,
      timeHorizon: "medium",
      sectors: ["Technology", "ETFs"],
      takeProfitThreshold: 20,
      stopLossThreshold: 15,
    })
    pass("saveProfile()", `risk=${profile.riskTolerance}, budget=$${profile.monthlyBudget}, expectedReturn=${(profile.expectedReturn*100).toFixed(0)}%`)
  } catch (e) { fail("saveProfile()", e); process.exit(1) }

  try {
    const loaded = await loadProfile()
    if (!loaded) throw new Error("returned null")
    pass("loadProfile()", `horizon=${loaded.timeHorizon}, sectors=${loaded.sectors.join(", ")}`)
  } catch (e) { fail("loadProfile()", e) }

  // ── 2. Portfolio ────────────────────────────────────────────────────────
  section("2. Portfolio actions")
  const { getCheckingBalance, getStockPortfolio, getRoboAdvisorPortfolio, getPortfolioProjection } = await import("../src/actions/portfolio.js")

  try {
    const balance = await getCheckingBalance()
    pass("getCheckingBalance()", `available=${JSON.stringify(balance.available)}, currency=${balance.currency}`)
  } catch (e) { fail("getCheckingBalance()", e) }

  try {
    const holdings = await getStockPortfolio()
    pass("getStockPortfolio()", `${holdings.length} holdings`)
  } catch (e) { fail("getStockPortfolio()", e) }

  try {
    const robo = await getRoboAdvisorPortfolio()
    pass("getRoboAdvisorPortfolio()", robo ? `balance=$${robo.totalBalance}` : "null (no robo account — expected)")
  } catch (e) { fail("getRoboAdvisorPortfolio()", e) }

  try {
    const proj = await getPortfolioProjection()
    pass("getPortfolioProjection()", `projected=$${proj.projectedValue.toLocaleString()}, onTrack=${proj.onTrack}`)
  } catch (e) { fail("getPortfolioProjection()", e) }

  // ── 3. Assets ───────────────────────────────────────────────────────────
  section("3. Asset search (fallback expected on 403)")
  const { searchAssets, getAssetDetail } = await import("../src/actions/assets.js")

  let assets
  try {
    assets = await searchAssets("Technology", 5)
    pass("searchAssets('Technology')", `${assets.length} assets, first=${assets[0]?.symbol}`)
  } catch (e) { fail("searchAssets()", e) }

  try {
    const etfs = await searchAssets("ETFs", 5)
    const hasVOO = etfs.some(a => a.symbol === "VOO")
    if (!hasVOO) throw new Error("VOO not in ETFs fallback")
    pass("searchAssets('ETFs')", `${etfs.length} assets, VOO present ✓`)
  } catch (e) { fail("searchAssets('ETFs')", e) }

  try {
    const detail = await getAssetDetail("AAPL")
    pass("getAssetDetail('AAPL')", `price=$${detail.price}, sector=${detail.sector}`)
  } catch (e) { fail("getAssetDetail('AAPL')", e) }

  // ── 4. Trading — dry run ────────────────────────────────────────────────
  section("4. Trading (DRY_RUN=true)")
  const { isDryRun, executeTrade, moveFunds, getSentinelPreview } = await import("../src/actions/trading.js")

  try {
    const dry = isDryRun()
    if (!dry) throw new Error("DRY_RUN should be true")
    pass("isDryRun()", "true ✓")
  } catch (e) { fail("isDryRun()", e) }

  try {
    const result = await executeTrade("AAPL", "BUY", 200)
    if (!result.simulated) throw new Error("Expected simulated=true")
    pass("executeTrade('AAPL','BUY',200)", `simulated=true, symbol=${result.symbol}, amount=$${result.amount}`)
  } catch (e) { fail("executeTrade()", e) }

  try {
    const result = await moveFunds("DEPOSIT", 100)
    if (!result.simulated) throw new Error("Expected simulated=true")
    pass("moveFunds('DEPOSIT',100)", `simulated=true, type=${result.type}, amount=$${result.amount}`)
  } catch (e) { fail("moveFunds()", e) }

  try {
    const preview = await getSentinelPreview("AAPL", "BUY", 200)
    pass("getSentinelPreview('AAPL','BUY',200)", `fee=$${preview.fee.toFixed(2)}, postBalance=$${preview.postTradeBalance.toFixed(2)}, warnings=${preview.warnings.length}`)
  } catch (e) { fail("getSentinelPreview()", e) }

  // ── 5. History ──────────────────────────────────────────────────────────
  section("5. Transaction history")
  const { getTransactionHistory } = await import("../src/actions/history.js")

  try {
    const txs = await getTransactionHistory()
    pass("getTransactionHistory()", `${txs.length} transactions`)
  } catch (e) { fail("getTransactionHistory()", e) }

  // ── 6. Recommendations (Claude) ─────────────────────────────────────────
  section("6. Recommendations (calls Claude)")
  const { getRecommendations } = await import("../src/actions/recommendations.js")

  try {
    const balance = { available: 300, currency: "USD" as const }
    const holdings: never[] = []
    const recs = await getRecommendations(profile, holdings, balance, assets ?? [])
    pass("getRecommendations()", `${recs.length} recommendations: ${recs.map(r => `${r.symbol} $${r.amount}`).join(", ") || "none"}`)
  } catch (e) { fail("getRecommendations()", e) }

  // ── 7. Display cards ────────────────────────────────────────────────────
  section("7. Display cards (visual check)")
  const { renderVantage, renderSentinel, renderMeridian } = await import("../src/display/agents.js")

  const mockRecs = [
    { symbol: "VOO", action: "BUY" as const, amount: 150, rationale: "Broad market exposure, low fees" },
    { symbol: "AAPL", action: "BUY" as const, amount: 100, rationale: "Strong earnings, moderate risk" },
  ]
  renderVantage(mockRecs, 300, 300)

  const mockPreview = {
    symbol: "VOO", direction: "BUY" as const, amount: 150,
    estimatedPrice: 498.23, fee: 0.53, feePercent: 0.35,
    totalDeducted: 150.53, postTradeBalance: 149.47,
    withinBudget: true, warnings: [],
  }
  renderSentinel(mockPreview)

  const { getPortfolioProjection: getProj } = await import("../src/actions/portfolio.js")
  try {
    const proj = await getProj()
    renderMeridian(proj, profile.expectedReturn)
    pass("All 3 cards rendered ✓", "")
  } catch (e) { fail("renderMeridian()", e) }

  // ── Summary ─────────────────────────────────────────────────────────────
  console.log("\n" + chalk.dim("  " + "═".repeat(50)))
  console.log(chalk.bold.white("  QA run complete.\n"))
}

main().catch(err => {
  console.error(chalk.red("\n  Fatal: " + (err as Error).message))
  process.exit(1)
})
