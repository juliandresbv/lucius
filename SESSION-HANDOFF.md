# Lucius — Session Handoff
**Updated:** 2026-05-24 | **Deadline:** 2026-05-26
**Next action:** Resume `superpowers:subagent-driven-development` from Task 9

---

## What's done

- ✅ Full brainstorming + feasibility validation
- ✅ Design spec → `docs/specs/2026-05-23-lucius-design.md`
- ✅ Implementation plan → `docs/superpowers/plans/2026-05-24-lucius-implementation.md` (25 tasks)
- ✅ **Task 1:** Project scaffold (package.json, tsconfig, vitest, git init, src/ dirs)
- ✅ **Task 2:** `src/wallbit/types.ts` — all API interfaces + WallbitError
- ✅ **Task 3:** `src/wallbit/client.ts` — fetch wrapper + tests (3 passing) — includes fix: header ordering prevents X-API-Key override
- ✅ **Task 4:** `src/wallbit/api.ts` — typed API wrapper (all endpoints)
- ✅ **Task 5:** `src/wallbit/fallback-assets.ts` — 10 sectors, ~20 assets
- ✅ **Task 6:** `src/storage/profile.ts` — loadProfile/saveProfile + tests (5 passing)
- ✅ **Task 7:** `src/actions/portfolio.ts` — getCheckingBalance, getStockPortfolio, getRoboAdvisorPortfolio (null-safe), getPortfolioProjection
- ✅ **Task 8:** `src/actions/assets.ts` + `src/tests/assets.test.ts` — searchAssets with fallback, getAssetDetail — 3 tests passing

**Test suite:** 11 tests passing (3 files)

---

## Tasks remaining (17 of 25)

| Task | File | Status |
|---|---|---|
| 9 | `src/actions/trading.ts` + tests | **NEXT** |
| 10 | `src/actions/history.ts` | pending |
| 11 | `src/actions/recommendations.ts` | pending |
| 12 | `src/actions/index.ts` | pending |
| 13 | `src/display/agents.ts` | pending |
| 14 | `src/display/portfolio.ts` | pending |
| 15 | `src/cli/onboarding.ts` | pending |
| 16 | `src/cli/portfolio.ts` | pending |
| 17 | `src/cli/outlook.ts` | pending |
| 18 | `src/cli/recommendations.ts` | pending |
| 19 | `src/cli/execution.ts` | pending |
| 20 | `src/cli/menu.ts` | pending |
| 21 | `src/lucius/system-prompt.ts` | pending |
| 22 | `src/lucius/tools.ts` | pending |
| 23 | `src/lucius/agent.ts` | pending |
| 24 | `src/index.ts` | pending |
| 25 | Full tests + smoke test | pending |

---

## Current git state

```
~/Desktop/lucius/
├── src/
│   ├── wallbit/
│   │   ├── types.ts           ✅
│   │   ├── client.ts          ✅
│   │   ├── api.ts             ✅
│   │   └── fallback-assets.ts ✅
│   ├── storage/
│   │   └── profile.ts         ✅
│   ├── actions/
│   │   ├── portfolio.ts       ✅
│   │   └── assets.ts          ✅
│   ├── tests/
│   │   ├── wallbit-client.test.ts  ✅ (3 tests)
│   │   ├── profile.test.ts         ✅ (5 tests)
│   │   └── assets.test.ts          ✅ (3 tests)
│   ├── display/   (empty)
│   ├── cli/       (empty)
│   └── lucius/    (empty)
├── docs/
│   ├── specs/2026-05-23-lucius-design.md
│   └── superpowers/plans/2026-05-24-lucius-implementation.md
├── package.json, tsconfig.json, vitest.config.ts
├── .env.example, .gitignore
└── node_modules/
```

---

## How to resume

1. Open new session, `cd ~/Desktop/lucius`
2. Say: **"continue from handoff"**
3. Invoke `superpowers:subagent-driven-development`
4. Skip Tasks 1–8 (done). Start from **Task 9** (`src/actions/trading.ts`)

TodoWrite task IDs: Tasks 9–25 correspond to TodoWrite #18–#34. Task #18 is pending.

**NOTE on subagent dispatch:** The worktree isolation for subagents fails because the primary CWD (`/Users/julianberval`) is not a git repo. Implement directly using Write + Bash tools instead of spawning subagents.

---

## Key architectural reminders

1. **Shared action layer** — `src/actions/` called by both CLI and Lucius tools
2. **Dry-run gate** — `isDryRun()` in `actions/trading.ts`, reads `DRY_RUN` env var
3. **Asset fallback** — `searchAssets()` tries live API, falls back to `FALLBACK_ASSETS` on 403/empty
4. **expectedReturn** — auto-derived from `riskTolerance`, never asked — enforced by `Omit<>` in saveProfile
5. **Fees** — `POST /fees` called by `getSentinelPreview()` before every trade; fallback 0.35% if fails
6. **MARKET orders only** — hardcoded `order_type: "MARKET"` in `executeTrade()`
7. **`Transaction` type** — defined in `wallbit/types.ts`, re-exported from `actions/history.ts`
8. **`FetchResult` interface** — in `cli/recommendations.ts` to avoid TS strict-mode assignment-before-use
9. **WallbitError header fix** — headers spread order: user headers → X-API-Key → Content-Type (POST)
10. **vitest mock pattern** — do NOT use `vi.resetModules()` in tests that check `instanceof WallbitError` (causes class identity mismatch); use static imports + `vi.clearAllMocks()` only

---

## API keys reminder

All old keys expired. Before running:
1. Wallbit Dashboard → Settings → API Keys → create **trade** scope key
2. `cp .env.example .env` → fill `WALLBIT_API_KEY` and `ANTHROPIC_API_KEY`
3. Test: `curl https://api.wallbit.io/api/public/v1/balance/checking -H "X-API-Key: <key>"`

---

## Plan location

```
docs/superpowers/plans/2026-05-24-lucius-implementation.md
```

Tasks 9–25 are all detailed there with complete code and TDD steps.

---

## Task 9 spec (next up)

**Files:** `src/actions/trading.ts` + `src/tests/trading.test.ts`

Test file uses static imports (NOT dynamic imports + resetModules — see lesson learned in Task 8):

```typescript
// src/tests/trading.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { wallbitApi } from "../wallbit/api.js"
import { getAssetDetail } from "../actions/assets.js"
import { getCheckingBalance } from "../actions/portfolio.js"
import { isDryRun, executeTrade } from "../actions/trading.js"

vi.mock("../wallbit/api.js", () => ({
  wallbitApi: {
    getFees: vi.fn(),
    createTrade: vi.fn(),
    moveOperation: vi.fn(),
  },
}))

vi.mock("../actions/assets.js", () => ({
  getAssetDetail: vi.fn(),
}))

vi.mock("../actions/portfolio.js", () => ({
  getCheckingBalance: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
  delete process.env.DRY_RUN
})

afterEach(() => {
  delete process.env.DRY_RUN
})

describe("isDryRun", () => {
  it("returns false by default", () => {
    expect(isDryRun()).toBe(false)
  })

  it("returns true when DRY_RUN=true", () => {
    process.env.DRY_RUN = "true"
    expect(isDryRun()).toBe(true)
  })
})

describe("executeTrade — dry-run mode", () => {
  it("returns simulated result without calling API when DRY_RUN=true", async () => {
    process.env.DRY_RUN = "true"
    vi.mocked(getAssetDetail).mockResolvedValueOnce({
      symbol: "AAPL",
      name: "Apple",
      price: 213.32,
      sector: "Technology",
    })

    const result = await executeTrade("AAPL", "BUY", 200)
    expect(result.simulated).toBe(true)
    expect(wallbitApi.createTrade).not.toHaveBeenCalled()
    if (result.simulated) {
      expect(result.symbol).toBe("AAPL")
      expect(result.amount).toBe(200)
    }
  })
})
```

The `trading.ts` implementation is fully specified in the plan at lines ~1170–1336 (Task 9, Step 3). Commit message: `"feat(actions): trading — isDryRun gate, getSentinelPreview, executeTrade, moveFunds"`.

---

## Execution approach (for next session)

- Use Write tool + Bash directly (subagent worktree isolation doesn't work here)
- Run tests after each task that has a test file
- `DRY_RUN=true` for all testing until account is funded
- Remaining tasks 10–24 are mostly mechanical (write file → commit); Task 25 is smoke test
