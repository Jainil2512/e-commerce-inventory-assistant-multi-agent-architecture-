import { Annotation } from "@langchain/langgraph";
import type { BaseMessage } from "@langchain/core/messages";

/**
 * The set of sub-agents the Supervisor can route to.
 * "FINISH" tells the graph the Supervisor has enough info to answer directly.
 */
export type AgentName =
  | "demand_forecasting"
  | "inventory"
  | "sales_insight"
  | "FINISH";

/**
 * Shared graph state.
 *
 * Every node (Supervisor + each sub-agent) receives this full object as
 * input and returns a *partial* update. LangGraph merges partial updates
 * back into state using each field's reducer below.
 */
export const AppState = Annotation.Root({
  // Full conversation history. Reducer appends new messages instead of
  // overwriting, so context builds up turn by turn.
  messages: Annotation<BaseMessage[]>({
    reducer: (current, update) => current.concat(update),
    default: () => [],
  }),

  // The original user request, kept separate from `messages` so agents
  // can always see exactly what was asked without re-parsing history.
  userQuery: Annotation<string>({
    reducer: (_current, update) => update,
    default: () => "",
  }),

  // The vendor/tenant context for the request, ensuring strict data isolation.
  vendorId: Annotation<string>({
    reducer: (_current, update) => update,
    default: () => "",
  }),

  // Set by the Supervisor each turn: which sub-agent should run next,
  // or "FINISH" once the Supervisor is ready to respond to the user.
  nextAgent: Annotation<AgentName>({
    reducer: (_current, update) => update,
    default: () => "FINISH",
  }),

  // Structured output slots each sub-agent writes into.
  demandForecast: Annotation<DemandForecastItem[] | null>({
    reducer: (_current, update) => update,
    default: () => null,
  }),
  inventoryStatus: Annotation<InventoryStatusItem[] | null>({
    reducer: (_current, update) => update,
    default: () => null,
  }),
  salesInsight: Annotation<SalesInsightData | null>({
    reducer: (_current, update) => update,
    default: () => null,
  }),

  // The final answer the Supervisor composes for the user.
  finalResponse: Annotation<string>({
    reducer: (_current, update) => update,
    default: () => "",
  }),
});

export interface DemandForecastItem {
  sku: string;
  predictedUnits: number;
  confidence: number;
  explanation: string;
}

export interface InventoryStatusItem {
  sku: string;
  currentStock: number;
  forecastedDemand: number;
  status: "low_stock" | "adequate" | "overstock";
  reorderQuantity: number;
  recommendation: string;
}

export interface SalesInsightData {
  period: string;
  summary: string;
  topSKUs: string[];
  insights: string[];
}

// Convenient type alias for use in node function signatures, e.g.:
//   async function supervisorNode(state: AppStateType) { ... }
export type AppStateType = typeof AppState.State;