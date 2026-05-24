# Lucius — Session Handoff
**Updated:** 2026-05-24 | **Deadline:** 2026-05-26
**Next action:** Invoke `superpowers:subagent-driven-development` skill with the implementation plan

---

## What's done

- ✅ Full brainstorming + feasibility validation complete
- ✅ Design spec approved → `docs/specs/2026-05-23-lucius-design.md`
- ✅ Wallbit API tested live (see findings below)
- ✅ Architecture, action layer, Lucius agent, sub-agents, onboarding all designed
- ✅ **Implementation plan written → `docs/superpowers/plans/2026-05-24-lucius-implementation.md`**
  - 25 tasks, fully coded, no placeholders
  - Self-review complete — 2 TypeScript bugs fixed inline

---

## The product

**Lucius** — TypeScript CLI investment advisor with two interfaces sharing one action layer:
- **CLI mode** — explicit menus (@clack/prompts)
- **Lucius mode** — conversational Claude agent with tool_use

**Three sub-agents** (chalk terminal cards, shared by both interfaces):
- **Vantage** — investment recommendations (calls Claude)
- **Sentinel** — pre-trade review (uses live fees: 0.35%)
- **Meridian** — long-term projection (7% moderate / 5% conservative / 10% aggressive)

---

## Key architectural decisions

1. **Shared action layer** — `src/actions/` called by both CLI and Lucius tools
2. **Dry-run gate** — `isDryRun()` in `actions/trading.ts`, reads `DRY_RUN` env var
3. **Asset fallback list** — hardcoded ~20 assets/sector in `src/wallbit/fallback-assets.ts`
4. **expectedReturn** — auto-derived from `riskTolerance` in `saveProfile()`, never asked
5. **Fees** — `POST /fees` called by `getSentinelPreview()` before every trade confirmation; fallback to 0.35% if call fails
6. **MARKET orders only** — hardcoded `order_type: "MARKET"` in `executeTrade()`
7. **profile.json** — local file, written by 6-step onboarding wizard
8. **`Transaction` type** — defined once in `src/wallbit/types.ts`, re-exported from `src/actions/history.ts`
9. **`FetchResult` interface** — used in `src/cli/recommendations.ts` to avoid TypeScript assignment-before-use on try/catch

---

## Wallbit API — live test results

| Endpoint | Status |
|---|---|
| `GET /balance/checking` | ✅ Works |
| `GET /balance/stocks` | ✅ Works |
| `GET /transactions` | ✅ Works |
| `POST /fees` | ✅ Works — 0.35% LEVEL2, $0 fixed |
| `GET /rates` | ✅ Works |
| `GET /assets?category=X` | ⚠️ Returns empty (unfunded account) — fallback covers this |
| `GET /assets?search=X` | ❌ 403 — **do not use search param** |
| `GET /assets/{symbol}` | ❌ 403 on unfunded account — fallback covers this |
| `GET /roboadvisor/balance` | ❌ Needs funded account — null-safe in `getRoboAdvisorPortfolio()` |

**Root cause of 403s:** Unfunded account. Asset data unlocks once account has a deposit.

---

## API keys status

ALL previously tested keys are expired. User must generate a fresh key:
- Wallbit Dashboard → Settings → API Keys → create with **trade** scope
- Copy to `.env` as `WALLBIT_API_KEY`

**Before implementing:**
1. Generate fresh trade-scoped API key
2. (Optional but recommended) Fund account (min $10) to unlock `/assets` endpoint
3. Verify: `curl https://api.wallbit.io/api/public/v1/balance/checking -H "X-API-Key: <new_key>"`

---

## Spec + Plan locations

```
docs/specs/2026-05-23-lucius-design.md        ← approved design spec
docs/superpowers/plans/2026-05-24-lucius-implementation.md  ← implementation plan
```

---

## Plan summary (25 tasks)

| Task | What it builds |
|---|---|
| 1 | Project scaffold (package.json, tsconfig, vitest, .env.example, .gitignore) |
| 2 | `src/wallbit/types.ts` — all API interfaces + WallbitError |
| 3 | `src/wallbit/client.ts` — fetch wrapper + tests |
| 4 | `src/wallbit/api.ts` — one function per endpoint |
| 5 | `src/wallbit/fallback-assets.ts` — curated ~20 assets/sector |
| 6 | `src/storage/profile.ts` — read/write profile.json + tests |
| 7 | `src/actions/portfolio.ts` — balance, holdings, projection |
| 8 | `src/actions/assets.ts` — search with fallback + tests |
| 9 | `src/actions/trading.ts` — dry-run gate, Sentinel preview + tests |
| 10 | `src/actions/history.ts` — transaction history |
| 11 | `src/actions/recommendations.ts` — Claude Vantage advisor |
| 12 | `src/actions/index.ts` — barrel exports |
| 13 | `src/display/agents.ts` — Vantage/Sentinel/Meridian chalk cards |
| 14 | `src/display/portfolio.ts` — portfolio table renderer |
| 15 | `src/cli/onboarding.ts` — 6-step @clack wizard |
| 16 | `src/cli/portfolio.ts` — view portfolio screen |
| 17 | `src/cli/recommendations.ts` — Vantage → Sentinel → execute flow |
| 18 | `src/cli/outlook.ts` — long-term outlook (Meridian) |
| 19 | `src/cli/execution.ts` — move funds screen (Sentinel) |
| 20 | `src/cli/menu.ts` — main menu loop + history screen |
| 21 | `src/lucius/system-prompt.ts` — Lucius system prompt builder |
| 22 | `src/lucius/tools.ts` — Claude tool definitions (9 tools) |
| 23 | `src/lucius/agent.ts` — conversational loop with tool_use |
| 24 | `src/index.ts` — entry point |
| 25 | Full test suite + smoke test |

---

## Next session — what to do

1. Open `~/Desktop/lucius/` as working directory
2. Read `docs/superpowers/plans/2026-05-24-lucius-implementation.md`
3. Invoke `superpowers:subagent-driven-development` skill
4. Feed it the plan — it dispatches one subagent per task with review between tasks
5. Use `DRY_RUN=true` for all testing until account is funded

---

## Stack

```
Node 18+ · TypeScript 5 · tsx (dev) · @clack/prompts · @anthropic-ai/sdk
native fetch · chalk · dotenv · vitest
Model: claude-sonnet-4-6
```
