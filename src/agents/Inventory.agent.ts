import { z } from "zod";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { getModel } from "../config/model.js";
import { getStockLevels } from "../tools/dbTools.js";
import type { AppStateType, InventoryStatusItem, DemandForecastItem } from "../types/state.js";

// Zod schema for structured output
const inventoryResponseSchema = z.object({
  statusList: z.array(
    z.object({
      sku: z.string().describe("Product SKU identifier"),
      currentStock: z.number().describe("Current stock count"),
      forecastedDemand: z.number().describe("Forecasted demand for next 30 days (use 0 if none provided)"),
      status: z.enum(["low_stock", "adequate", "overstock"]).describe("Stock status relative to demand and safe thresholds"),
      reorderQuantity: z.number().describe("Units to reorder. 0 if stock is sufficient"),
      recommendation: z.string().describe("Actionable advice (e.g. reorder urgency, clearance sale for overstock, etc.)")
    })
  ).describe("Inventory health evaluation list")
});

/**
 * Inventory Agent.
 * Compares actual stock levels with forecasted demand to determine stock levels and reorder suggestions.
 */
export async function inventoryNode(
  state: AppStateType
): Promise<Partial<AppStateType>> {
  const vendorId = state.vendorId;
  console.log(`[Inventory Agent] Running for Vendor: ${vendorId}...`);

  // 1. Fetch current stock levels from database
  const stockLevels = await getStockLevels(vendorId);

  // 2. Fetch forecasted demand from state (if available)
  const demandForecast: DemandForecastItem[] = (state.demandForecast as DemandForecastItem[]) || [];

  // 3. Construct input context for LLM
  const stockContext = stockLevels.map(p => {
    // Find matching forecast
    const fc = demandForecast.find(f => f.sku === p.sku);
    const predictedUnits = fc ? fc.predictedUnits : 0;
    return `- Product: ${p.name} (${p.sku}), Current Stock: ${p.currentStock}, Safety Threshold (Min): ${p.minStockLevel}, 30-Day Forecasted Demand: ${predictedUnits}`;
  }).join("\n");

  const prompt = `You are an Inventory Specialist. Your job is to check actual stock levels against safety thresholds and 30-day forecasted demand, and make reorder recommendations.

Vendor ID: ${vendorId}

Product Stock Levels & Forecast Context:
${stockContext}

Rules:
- Identify if a product is "low_stock" (current stock is below the safety threshold, or below forecasted demand).
- Identify if a product is "overstock" (current stock is significantly higher than forecasted demand + safe margin).
- Suggest a "reorderQuantity" to bring stock to a safe level (e.g., target stock = forecasted demand * 1.5, reorder quantity = target stock - current stock). Recommend 0 if no order is needed.
- Return a structured response.
`;

  // 4. Call LLM with structured output
  const model = getModel().withStructuredOutput(inventoryResponseSchema, {
    name: "inventory_status"
  });

  const response = await model.invoke([
    new SystemMessage("You are an expert e-commerce inventory specialist."),
    new HumanMessage(prompt)
  ]);

  const inventoryStatus: InventoryStatusItem[] = response.statusList;

  console.log(`[Inventory Agent] Processed ${inventoryStatus.length} inventory records.`);

  return {
    inventoryStatus,
    messages: [
      new HumanMessage(
        `[Inventory Agent] Checked inventory levels for Vendor: ${vendorId}.\nRecommendations:\n` +
        inventoryStatus.map(i => `- ${i.sku}: Stock = ${i.currentStock}, Status = ${i.status}, Reorder Qty = ${i.reorderQuantity}`).join("\n")
      )
    ]
  };
}
