import { StateGraph, END, START } from "@langchain/langgraph";
import { AppState, type AppStateType } from "../types/state.js";
import { supervisorNode } from "../agents/Supervisor.agent.js";
import { demandForecastingNode } from "../agents/DemandForecasting.agent.js";
import { inventoryNode } from "../agents/Inventory.agent.js";
import { salesInsightNode } from "../agents/SalesInsight.agent.js";

// Initialize graph
const workflow = new StateGraph(AppState)
  .addNode("supervisor", supervisorNode)
  .addNode("demand_forecasting", demandForecastingNode)
  .addNode("inventory", inventoryNode)
  .addNode("sales_insight", salesInsightNode);

// Start node
workflow.addEdge(START, "supervisor");

// Loop sub-agents back to the supervisor
workflow.addEdge("demand_forecasting", "supervisor");
workflow.addEdge("inventory", "supervisor");
workflow.addEdge("sales_insight", "supervisor");

/**
 * Conditional routing logic.
 * Reads nextAgent from state and determines the next node to execute.
 */
function routeNode(state: AppStateType): string {
  const next = state.nextAgent;
  if (next === "FINISH") {
    return END; // Special LangGraph string for ending execution
  }
  return next;
}

// Add conditional edge from supervisor
workflow.addConditionalEdges("supervisor", routeNode);

// Compile the workflow into a runnable graph
export const graph = workflow.compile();
