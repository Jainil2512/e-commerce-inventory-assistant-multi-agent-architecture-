import { z } from "zod";
import { SystemMessage, HumanMessage, AIMessage } from "@langchain/core/messages";
import { getModel } from "../config/model.js";
import { SUPERVISOR_SYSTEM_PROMPT } from "../prompts/Supervisor.prompt.js";
import type { AppStateType, AgentName } from "../types/state.js";

// Structured output schema — forces the model to return one of the exact
// agent names plus a short reason, instead of free-form text we'd have
// to parse ourselves.
const routingDecisionSchema = z.object({
  next: z
    .enum(["demand_forecasting", "inventory", "sales_insight", "FINISH"])
    .describe("Which agent should handle this request next"),
  reasoning: z
    .string()
    .describe("One short sentence explaining the routing choice"),
});

/**
 * Supervisor node.
 * Reads the user's query (and any messages accumulated so far, e.g. from
 * sub-agents that already ran), decides the next agent to invoke, and
 * records the decision in state.
 */
export async function supervisorNode(
  state: AppStateType
): Promise<Partial<AppStateType>> {
  const model = getModel().withStructuredOutput(routingDecisionSchema, {
    name: "route",
  });

  const decision = await model.invoke([
    new SystemMessage(SUPERVISOR_SYSTEM_PROMPT),
    new HumanMessage(state.userQuery),
    ...state.messages,
  ]);

  const nextAgent: AgentName = decision.next;

  if (nextAgent === "FINISH") {
    console.log("[Supervisor] Composing final response...");
    // Call LLM to compose a rich, polished final response incorporating all agent results.
    const composePrompt = `You are a professional E-commerce Order & Inventory Assistant. 
Your task is to write a final, comprehensive, user-friendly business report/response to the user's query, based on the structured reports gathered from specialist agents.

User Query: "${state.userQuery}"
Vendor ID: "${state.vendorId}"

Here is the data collected:
${state.salesInsight ? `Sales Insights:\n${JSON.stringify(state.salesInsight, null, 2)}\n` : ""}
${state.demandForecast ? `Demand Forecast:\n${JSON.stringify(state.demandForecast, null, 2)}\n` : ""}
${state.inventoryStatus ? `Inventory Status & Reorder Recommendations:\n${JSON.stringify(state.inventoryStatus, null, 2)}\n` : ""}

Instructions:
1. Synthesize the data into a beautifully formatted business response. Use markdown tables, bold headings, alerts, and bullet points.
2. Address the user's query directly and outline specific actions (e.g. "We recommend ordering X units of Y").
3. Make sure the response is professional and easy to read. Do not output raw JSON or mention agent nodes.
`;

    const rawResponse = await getModel().invoke([
      new SystemMessage("You are an expert business report writer and assistant."),
      new HumanMessage(composePrompt),
    ]);

    const finalResponse = typeof rawResponse.content === "string" 
      ? rawResponse.content 
      : JSON.stringify(rawResponse.content);

    return {
      nextAgent,
      finalResponse,
      messages: [
        new AIMessage(
          `[Supervisor] Routing to "FINISH". Reason: ${decision.reasoning}`
        ),
        new AIMessage(finalResponse),
      ],
    };
  }

  return {
    nextAgent,
    messages: [
      new AIMessage(
        `[Supervisor] Routing to "${nextAgent}". Reason: ${decision.reasoning}`
      ),
    ],
  };
}