---
trigger: manual
---

# Project Brief: E-commerce Order & Inventory Assistant

dont access .env 
access.env.example 

## 1. Goal

A multi-agent system that predicts inventory needs and surfaces sales
insights for an e-commerce store. Built as a learning project for
**supervisor-led multi-agent architecture**: one Supervisor Agent routes
each request to the right specialist sub-agent, sub-agents do their work,
and the Supervisor composes a final answer.

This is a learning/demo project, not production infra — deliberately
**no Redis, no BullMQ, no message queues**. PostgreSQL is allowed and
expected once agents need real data instead of mocked data.

## 2. Tech Stack

- **Language**: TypeScript (strict mode), Node.js, ESM modules (`"type": "module"`)
- **Agent framework**: `@langchain/langgraph` (StateGraph + Annotation API)
- **LLM orchestration**: `@langchain/core`, `@langchain/openai`
- **LLM provider**: OpenRouter (OpenAI-compatible API), using free-tier models
  (model ID is env-configurable since OpenRouter's free lineup rotates)
- **Database**: PostgreSQL via `pg` (added once agents need real order/inventory data)
- **Validation / structured output**: `zod` — used to force LLM routing and
  agent outputs into exact typed shapes via `.withStructuredOutput()`
- **Dev tooling**: `tsx` (run TS directly without a build step), `dotenv`

## 3. Architecture Pattern

**Supervisor pattern**: a single Supervisor node reads the user's query
(and any accumulated results from sub-agents), decides which ONE sub-agent
should run next via structured output (zod enum), and sets a `nextAgent`
field in shared state. A conditional edge in the graph reads `nextAgent`
and routes accordingly. Sub-agents write their results into their own
dedicated state field (never into each other's). Once enough sub-agents
have run, the Supervisor sets `nextAgent: "FINISH"` and composes the final
answer from whatever result fields are populated.

## 4. Agents

| Agent | Responsibility | Status |
|---|---|---|
| **Supervisor** | Routes each request to the correct sub-agent using structured output; composes final answer | Built (`src/agents/supervisor.ts`) |
| **Demand Forecasting Agent** | Predicts near-term demand per product/SKU from historical sales data, seasonality, promotions | Not built yet |
| **Inventory Agent** | Compares forecasted demand to current stock; flags shortages/overstock; suggests reorder quantities | Not built yet |
| **Sales Insight Agent** | Explains past sales trends in plain language (why sales rose/fell, product performance summaries) | Not built yet |

Routing rule already encoded in the Supervisor's prompt: if a request
touches both demand and inventory (e.g. "what should I reorder"), route to
`demand_forecasting` first — inventory logic depends on having a forecast.

## 5. Shared State Schema (`src/types/state.ts`)

Built with LangGraph's `Annotation.Root()` API. Key fields:

- `messages: BaseMessage[]` — reducer **appends** (conversation accumulates)
- `userQuery: string` — reducer **overwrites** (always latest raw request)
- `nextAgent: AgentName` — reducer **overwrites**; union type:
  `"demand_forecasting" | "inventory" | "sales_insight" | "FINISH"`
- `demandForecast`, `inventoryStatus`, `salesInsight` — one output slot per
  sub-agent, currently typed `unknown`, to be tightened with zod schemas as
  each agent is built
- `finalResponse: string` — the answer shown to the user

Every node function signature follows this shape:
```ts
async function someAgentNode(state: AppStateType): Promise<Partial<AppStateType>>
```
Nodes return **partial** updates; LangGraph merges them via each field's reducer.

## 6. Folder Structure

```
ecommerce-inventory-assistant/
├── package.json
├── tsconfig.json
├── .env.example
├── README.md
├── SKILLS.md          (this file)
└── src/
    ├── app.ts          # entry point (currently: isolated node testing, not full graph yet)
    ├── config/
    │   └── model.ts    # getModel() -- shared OpenRouter-backed ChatOpenAI client builder
    ├── agents/
    │   └── supervisor.ts   # built -- routing logic
    │   # demand-forecasting.ts, inventory.ts, sales-insight.ts -- to build
    ├── prompts/
    │   └── supervisor.prompt.ts   # built
    │   # one prompt file per sub-agent -- to build
    ├── tools/          # empty -- tool() functions agents call (DB queries, calculations)
    ├── graphs/         # empty -- StateGraph wiring, nodes + conditional edges -- to build
    ├── db/             # empty -- Postgres connection + queries -- to build
    └── types/
        └── state.ts    # built -- shared Annotation state schema
```

## 7. Environment Variables (`.env`)

```
OPENROUTER_API_KEY=...
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_MODEL=<a :free model ID from openrouter.ai/models, e.g. qwen/qwen3-coder:free>
DATABASE_URL=postgresql://user:password@localhost:5432/ecommerce_assistant   # not wired in yet
```

## 8. Conventions to Follow

- All imports use explicit `.js` extensions (e.g. `from "../types/state.js"`)
  -- required by `NodeNext` module resolution even though the source files
  are `.ts`.
- LLM structured output (routing decisions, agent results) uses zod schemas
  passed to `.withStructuredOutput()` -- never parse free-text LLM output
  with regex/string matching.
- One agent = one file in `src/agents/`, one matching prompt in `src/prompts/`.
- Every agent reuses `getModel()` from `src/config/model.ts` rather than
  constructing its own LLM client.
- Keep it simple: no queues, no caching layer, no microservices. A single
  Node process running one LangGraph `StateGraph` is the whole system.

## 9. Remaining Work (Roadmap)

1. Build **Demand Forecasting Agent** -- needs a tool to read sales history
   (start with mocked/in-memory data, move to Postgres once schema exists)
   and a zod schema for its output shape (e.g. `{ sku, predictedUnits, confidence }`).
2. Build **Inventory Agent** -- needs a tool to read current stock levels and
   compare against `demandForecast` from state.
3. Build **Sales Insight Agent** -- explains trends from historical data.
4. Design and create Postgres schema: `orders`, `inventory` tables (at minimum).
5. Wire everything into an actual `StateGraph` in `src/graphs/` -- supervisor
   node + 3 sub-agent nodes + conditional edges based on `nextAgent`.
6. Replace the temporary test harness in `app.ts` with real graph invocation
   (`graph.invoke({ userQuery: "..." })`).
7. (Optional, later) Wrap the graph in a small Express API if an HTTP
   interface is wanted -- not needed for the core learning goal.