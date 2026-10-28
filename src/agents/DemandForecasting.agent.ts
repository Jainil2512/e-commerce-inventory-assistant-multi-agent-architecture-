import { z } from "zod";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { getModel } from "../config/model.js";
import { getSalesHistory, getPromotions } from "../tools/dbTools.js";
import type { AppStateType, DemandForecastItem } from "../types/state.js";

// Zod schema for structured output to ensure strict types
const forecastResponseSchema = z.object({
  forecasts: z.array(
    z.object({
      sku: z.string().describe("Product SKU identifier"),
      predictedUnits: z.number().describe("Predicted sales units for the next 30 days"),
      confidence: z.number().min(0.0).max(1.0).describe("Confidence level from 0.0 to 1.0"),
      explanation: z.string().describe("Brief analysis explaining the forecast, using sales velocity or promotions")
    })
  ).describe("Array of product forecasts")
});

/**
 * Demand Forecasting Agent.
 * Fetches historical orders and active promotions for the vendor, runs a forecast
 * analysis using the LLM, and saves the structured prediction back to the state.
 */
export async function demandForecastingNode(
  state: AppStateType
): Promise<Partial<AppStateType>> {
  const vendorId = state.vendorId;
  console.log(`[Demand Forecasting Agent] Running for Vendor: ${vendorId}...`);

  // 1. Fetch DB data (isolated by vendorId)
  const salesHistory = await getSalesHistory(vendorId, 90); // 90 days
  const promotions = await getPromotions(vendorId);

  // 2. Format context for the LLM
  const salesContext = salesHistory.length > 0 
    ? salesHistory.map(s => `- Date: ${s.date.toISOString().split('T')[0]}, SKU: ${s.sku}, Qty: ${s.quantity}, Price: $${s.price}`).join("\n")
    : "No recent sales history.";

  const promoContext = promotions.length > 0
    ? promotions.map(p => `- SKU: ${p.sku}, Discount: ${p.discountPercent}%, Start: ${p.startDate.toISOString().split('T')[0]}, End: ${p.endDate.toISOString().split('T')[0]}`).join("\n")
    : "No active or upcoming promotions.";

  const prompt = `You are a Demand Forecasting Specialist. Your job is to predict the inventory demand (units to be sold) for each product/SKU over the NEXT 30 DAYS based on:
1. Historical sales data over the past 90 days.
2. Active or upcoming promotions.

Vendor ID: ${vendorId}

Historical Sales Data:
${salesContext}

Promotions:
${promoContext}

Analyze the sales velocity, seasonality, and the impact of promotions to predict future sales units.
Return a structured list of forecasts for all products mentioned.
`;

  // 3. Call LLM with structured output
  const model = getModel().withStructuredOutput(forecastResponseSchema, {
    name: "demand_forecast"
  });

  const response = await model.invoke([
    new SystemMessage("You are an expert e-commerce inventory forecasting agent."),
    new HumanMessage(prompt)
  ]);

  const demandForecast: DemandForecastItem[] = response.forecasts;

  console.log(`[Demand Forecasting Agent] Forecasted ${demandForecast.length} items.`);

  return {
    demandForecast,
    // Append message to log sub-agent work
    messages: [
      new HumanMessage(
        `[Demand Forecasting Agent] Completed demand forecasting for Vendor: ${vendorId}.\nPredictions:\n` +
        demandForecast.map(f => `- ${f.sku}: Predicted Units = ${f.predictedUnits} (Confidence: ${f.confidence * 100}%)`).join("\n")
      )
    ]
  };
}
