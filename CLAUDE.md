# Lucius — Claude Code Project Guide

TypeScript CLI investment advisor. Backend: Wallbit brokerage API. AI: Claude Sonnet (main agent) + Claude Haiku (security guard).

---

## Commands

```bash
npm start           # run the app
npm run dev         # run with tsx watch (auto-reload)
npm test            # vitest run (all tests, expect 54 passing)
npm run test:watch  # vitest in watch mode
npm run e2e         # QA dry-run (DRY_RUN=true, no real trades)
npx tsc --noEmit    # type check only
```

---

## Architecture

```
src/index.ts
  └─ showMainMenu()              # cli/menu.ts — main event loop
       └─ runLuciusAgent()       # lucius/agent.ts — conversational loop
            ├─ checkGuard()      # lucius/guard.ts — input validation (all 3 layers)
            ├─ buildSystemPrompt() # lucius/system-prompt.ts
            └─ anthropic.messages.create() + tool dispatch
```

**Key design decisions:**
- One Anthropic client instance per agent session, created in `agent.ts`, passed to `checkGuard` via DI (not constructed inside `guard.ts`).
- Vantage / Sentinel / Meridian are NOT separate API calls — they are context switches within the single Lucius agent, triggered by tool invocations.
- `guard.ts` is purely defensive and has no opinion on investing logic.

---

## Source map

| File | Responsibility |
|------|---------------|
| `src/index.ts` | Entry point: env check, first-run onboarding, main event loop |
| `src/lucius/agent.ts` | Agent loop: reads user input → guard → Anthropic call → tool dispatch → response |
| `src/lucius/guard.ts` | `checkGuard(input, anthropic)` — Layer 1 regex + Layer 2 Haiku + exports `GuardResult` type |
| `src/lucius/system-prompt.ts` | `buildSystemPrompt(profile, balance, holdings)` — injects session context + SECURITY block |
| `src/lucius/tools.ts` | Anthropic tool definitions (`luciusTools`) — 9 tools |
| `src/actions/portfolio.ts` | `getCheckingBalance`, `getStockPortfolio`, `getPortfolioProjection` |
| `src/actions/trading.ts` | `getSentinelPreview`, `executeTrade`, `moveFunds` |
| `src/actions/assets.ts` | `searchAssets(category?, limit?)` |
| `src/actions/recommendations.ts` | `getRecommendations(profile, holdings, balance, assets, budget)` |
| `src/actions/history.ts` | `getTransactionHistory(from?, to?, type?)` |
| `src/display/agents.ts` | `renderVantage`, `renderSentinel`, `renderMeridian` — chalk output only |
| `src/storage/profile.ts` | `loadProfile`, `saveProfile`, `patchProfile` — reads/writes `profile.json` |
| `src/storage/sim-state.ts` | Simulation state: virtual balance in `sim-state.json` |
| `src/wallbit/client.ts` | Wallbit HTTP client (base URL, auth header) |
| `src/wallbit/api.ts` | API wrappers: portfolio, assets, trading, history |
| `src/wallbit/types.ts` | Wallbit API types |

---

## Testing

**Framework:** vitest  
**Test files:** `src/tests/*.test.ts`  
**Expected count:** 54 passing

```bash
npm test            # run all
npx vitest run src/tests/guard.test.ts  # run one file
```

**Test conventions:**
- Mock the Anthropic client via `vi.fn()` and dependency injection — no `vi.mock()` needed for `guard.ts` tests because `checkGuard` receives the client as a parameter.
- Profile tests use `PROFILE_FILE=profile.test.json` (set in vitest config).
- Sim-state tests use `SIM_STATE_FILE=sim-state.test.json`.
- Never make real API calls in unit tests.

---

## Environment variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `WALLBIT_API_KEY` | ✅ | Wallbit brokerage authentication |
| `ANTHROPIC_API_KEY` | ✅ | Claude API (Sonnet + Haiku) |
| `DRY_RUN` | — | `true` = simulate all trades, no real money moves |
| `SIM_MODE` | — | `true` = paper-trading mode with virtual balance |
| `PROFILE_FILE` | — | Override profile path (default: `profile.json`) |
| `SIM_STATE_FILE` | — | Override sim-state path (default: `sim-state.json`) |

`.env` is gitignored. Never commit secrets.

---

## Gitignored local data

```
.env                  # API keys
profile.json          # User investment profile
profile.test.json     # Test profile fixture
sim-state.json        # Paper-trading balance
sim-state.test.json   # Test sim-state fixture
node_modules/
dist/
```

---

## Models

| Constant | Model ID | Where used |
|----------|----------|-----------|
| Main agent | `claude-sonnet-4-6` | `agent.ts` |
| Guard Layer 2 | `claude-haiku-4-5-20251001` | `guard.ts` `llmGuard()` |

---

## Security guardrails

`checkGuard(input, anthropic)` in `guard.ts` runs on every user message before `history.push`.

- **Layer 1** — regex patterns block injection phrases, secrets-fishing, inputs > 2,000 chars. Zero API cost.
- **Layer 2** — `llmGuard()` escalates ambiguous "suspicious" signals to Haiku. **Fails open** — any error returns `{ verdict: "SAFE" }`.
- **Layer 3** — SECURITY block at the end of `buildSystemPrompt()` handles novel phrasings and multi-turn attacks.

`GuardResult` is a discriminated union:
```typescript
type GuardResult =
  | { verdict: "SAFE" }
  | { verdict: "BLOCKED"; reason: Exclude<Verdict, "SAFE">; message: string }
```

---

## TypeScript

- `strict: true`, `module: NodeNext`, `moduleResolution: NodeNext`
- All imports inside `src/` use `.js` extensions (required for NodeNext ESM)
- Use `import type` for type-only imports
- `tsconfig.json` covers `src/**/*` only; `e2e/` runs via `tsx` directly

---

## Code style

- Functional style preferred over classes
- Each file has one clear responsibility
- No barrel files — import directly from the module that owns the type/function
- `chalk` for all terminal output; use `chalk.dim` for secondary info, `chalk.white` for Lucius speech, `chalk.cyan` for user prompts
- All async errors caught at the call site; never swallow errors silently
- No `console.log` in `src/actions/` or `src/storage/` — display layer only in `src/display/` and `src/cli/`

---

## Adding a new tool

1. Add the Anthropic tool definition to `src/lucius/tools.ts`
2. Add the implementation in the appropriate `src/actions/` file
3. Add the `case` to the `dispatch` switch in `src/lucius/agent.ts`
4. If it has display output, add a renderer in `src/display/agents.ts`
5. Add unit tests in `src/tests/`
