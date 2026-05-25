// src/lucius/tools.ts
import type Anthropic from "@anthropic-ai/sdk"

export const luciusTools: Anthropic.Tool[] = [
  {
    name: "get_checking_balance",
    description: "Get the user's current checking account balance in USD.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "get_stock_portfolio",
    description:
      "Get the user's current stock holdings with current prices and portfolio values.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "get_portfolio_projection",
    description:
      "Get a long-term projection of the user's portfolio value based on their monthly budget, time horizon, and expected return. Use this for Meridian context — when user asks about goals or being on track.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "search_assets",
    description:
      "Search for available assets to invest in, optionally filtered by sector category.",
    input_schema: {
      type: "object" as const,
      properties: {
        category: {
          type: "string" as const,
          description:
            "Sector: Technology, Health, Consumer Goods, Energy & Water, Finance, Real Estate, ETFs, Dividends, Argentinian ADRs, Most Popular",
        },
        limit: {
          type: "number" as const,
          description: "Max assets to return (default: 10)",
        },
      },
      required: [],
    },
  },
  {
    name: "get_recommendations",
    description:
      "Get Vantage's investment recommendations based on the user's profile, portfolio, and available assets. Call this first when the user asks what to invest in.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "get_sentinel_preview",
    description:
      "Get Sentinel's pre-trade review: simulated trade result, fee calculation, post-trade balance, and warnings. ALWAYS call this before execute_trade.",
    input_schema: {
      type: "object" as const,
      properties: {
        symbol: {
          type: "string" as const,
          description: "Asset ticker symbol e.g. AAPL, VOO",
        },
        direction: {
          type: "string" as const,
          enum: ["BUY", "SELL"],
          description: "Trade direction",
        },
        amount: {
          type: "number" as const,
          description: "Trade amount in USD",
        },
      },
      required: ["symbol", "direction", "amount"],
    },
  },
  {
    name: "execute_trade",
    description:
      "Execute a BUY or SELL trade. ONLY call this after showing Sentinel preview AND receiving explicit user confirmation.",
    input_schema: {
      type: "object" as const,
      properties: {
        symbol: {
          type: "string" as const,
          description: "Asset ticker symbol",
        },
        direction: {
          type: "string" as const,
          enum: ["BUY", "SELL"],
        },
        amount: {
          type: "number" as const,
          description: "Trade amount in USD",
        },
      },
      required: ["symbol", "direction", "amount"],
    },
  },
  {
    name: "move_funds",
    description:
      "Deposit or withdraw funds from the checking account. ONLY call after explicit user confirmation.",
    input_schema: {
      type: "object" as const,
      properties: {
        type: {
          type: "string" as const,
          enum: ["DEPOSIT", "WITHDRAWAL"],
        },
        amount: {
          type: "number" as const,
          description: "Amount in USD",
        },
      },
      required: ["type", "amount"],
    },
  },
  {
    name: "get_transaction_history",
    description: "Get the user's recent transaction history.",
    input_schema: {
      type: "object" as const,
      properties: {
        from_date: {
          type: "string" as const,
          description: "ISO date string e.g. 2025-01-01",
        },
        to_date: {
          type: "string" as const,
          description: "ISO date string e.g. 2025-12-31",
        },
        type: {
          type: "string" as const,
          description: "Filter by type e.g. TRADE",
        },
      },
      required: [],
    },
  },
]
