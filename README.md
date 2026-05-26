# Lucius

**AI-powered CLI investment advisor** backed by [Wallbit](https://wallbit.io) and Claude.

Lucius is a personal finance assistant that lives in your terminal. It connects to your Wallbit brokerage account, understands your investment profile, and helps you make decisions — from portfolio analysis to executing trades — through a natural conversation.

---

## Features

- **Portfolio view** — live holdings, prices, and values from your Wallbit account
- **AI recommendations** — Vantage context: personalized suggestions based on your profile, budget, and sectors
- **Trade preview** — Sentinel context: simulated result, fee, post-trade balance, and warnings before any trade
- **Trade execution** — BUY / SELL with explicit confirmation required
- **Long-term projections** — Meridian context: compound growth forecast against your time horizon
- **Fund transfers** — deposit and withdrawal with confirmation
- **Transaction history** — last 20 trades with date, type, and amount
- **Investment profile** — risk tolerance, monthly budget, time horizon, sectors, take-profit / stop-loss thresholds
- **Security guardrails** — three-layer guard blocking prompt injection, secrets-fishing, and out-of-scope requests

---

## Requirements

- Node.js 20+
- A [Wallbit](https://wallbit.io) account and API key
- An [Anthropic](https://console.anthropic.com) API key

---

## Setup

```bash
git clone <repo>
cd lucius
npm install
cp .env.example .env
```

Edit `.env`:

```env
WALLBIT_API_KEY=your_wallbit_api_key_here
ANTHROPIC_API_KEY=your_anthropic_api_key_here
```

---

## Usage

```bash
npm start
```

On first run, Lucius will walk you through a quick onboarding to set your investment profile. After that, you land on the main menu:

```
  Lucius  v0.1.0
  AI-powered investment advisor

  What would you like to do?
  ❯ L. Talk to Lucius
    1. View portfolio
    2. Get recommendations
    3. Long-term outlook
    4. Manage funds
    5. Transaction history
    6. Investment profile
    Exit
```

**Talk to Lucius** opens the conversational interface. Type naturally — Lucius will call tools on your behalf and always ask before moving money.

Type `exit` to return to the menu.

---

## Models

| Role | Model |
|------|-------|
| Main agent | `claude-sonnet-4-6` |
| Security guard (Layer 2) | `claude-haiku-4-5-20251001` |

---

## Development

```bash
npm run dev        # tsx watch — reloads on file change
npm test           # vitest run (68 tests)
npm run test:watch # vitest watch mode
npm run e2e        # dry-run QA script (no real trades)
```

### Environment flags

| Variable | Default | Effect |
|----------|---------|--------|
| `DRY_RUN=true` | `false` | All trade calls are simulated; no real money moves |
| `SIM_MODE=true` | `false` | Uses a virtual paper-trading balance from `sim-state.json` |
| `SIM_BALANCE` | `0` | Starting balance in USD for a fresh simulation state |
| `PROFILE_FILE` | `profile.json` | Override the profile path (used by tests: `profile.test.json`) |
| `SIM_STATE_FILE` | `sim-state.json` | Override the sim-state path |

---

## Project structure

```
src/
  index.ts              # Entry point — env check, onboarding, main loop
  lucius/
    agent.ts            # Conversational agent loop (Claude Sonnet + tool dispatch)
    guard.ts            # Three-layer security guard (checkGuard, llmGuard)
    system-prompt.ts    # buildSystemPrompt() — profile + balance + SECURITY block
    tools.ts            # Anthropic tool definitions
  cli/
    menu.ts             # Main menu
    onboarding.ts       # First-run profile setup
    profile.ts          # Profile management menu
    portfolio.ts        # Portfolio display
    recommendations.ts  # Recommendations display
    outlook.ts          # Long-term outlook display
    execution.ts        # Trade execution UI
    simulation.ts       # Simulation mode actions
  actions/
    portfolio.ts        # getCheckingBalance, getStockPortfolio, getPortfolioProjection
    assets.ts           # searchAssets
    recommendations.ts  # getRecommendations
    trading.ts          # getSentinelPreview, executeTrade, moveFunds
    history.ts          # getTransactionHistory
  display/
    agents.ts           # renderVantage, renderSentinel, renderMeridian
    portfolio.ts        # Portfolio table renderer
  storage/
    profile.ts          # loadProfile, saveProfile, patchProfile
    sim-state.ts        # Simulation state persistence
  wallbit/
    client.ts           # Wallbit HTTP client
    api.ts              # API call wrappers
    types.ts            # Wallbit API types
    fallback-assets.ts  # Static asset list (used when API is unavailable)
  tests/                # vitest unit tests
e2e/
  qa-run.ts             # End-to-end QA script (DRY_RUN=true)
```

---

## Security

Lucius applies a three-layer guard to every user message before it reaches the main agent:

1. **Layer 1 — TypeScript fast check** (`guard.ts`): regex patterns block definite injection phrases, secrets-fishing attempts, and inputs over 2,000 characters with zero API cost.
2. **Layer 2 — Haiku escalation** (`guard.ts`): ambiguous "suspicious" signals are classified by `claude-haiku-4-5-20251001`. Fails open — a guard error never blocks a legitimate user.
3. **Layer 3 — Hardened system prompt** (`system-prompt.ts`): the SECURITY block in the system prompt is the last line of defense for novel phrasings and multi-turn manipulation.

---

## Local data

Lucius stores two JSON files locally (both are gitignored):

| File | Contents |
|------|----------|
| `profile.json` | Your investment profile |
| `sim-state.json` | Paper-trading balance (simulation mode only) |

---

## License

MIT
