import { z } from "zod";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { getModel } from "../config/model.js";
import { getSalesHistory, getSalesSummary, getPromotions } from "../tools/dbTools.js";
import type { AppStateType, SalesInsightData } from "../types/state.js";

// Zod schema for structured output
const salesInsightResponseSchema = z.object({
  period: z.string().describe("The period of data analyzed, e.g. 'Past 30/90 Days'"),
  summary: z.string().describe("A professional text summary of the sales performance and trends"),
  topSKUs: z.array(z.string()).describe("SKUs of the top-selling products in order"),
  insights: z.array(z.string()).describe("Specific bullet-point insights about performance drivers, promotions, or weekly changes")
}).describe("Sales performance insights");

/**
 * Sales Insight Agent.
 * Analyzes historical sales and promotions to summarize trends and explain spikes/dips.
 */
export async function salesInsightNode(
  state: AppStateType
): Promise<Partial<AppStateType>> {
  const vendorId = state.vendorId;
  console.log(`[Sales Insight Agent] Running for Vendor: ${vendorId}...`);

  // 1. Fetch sales summary and history
  const summary = await getSalesSummary(vendorId, 30); // past 30 days summary
  const history = await getSalesHistory(vendorId, 90); // past 90 days detailed logs
  const promotions = await getPromotions(vendorId);

  // 2. Format context for LLM
  const summaryContext = summary.length > 0
    ? summary.map(s => `- Product: ${s.name} (${s.sku}), Total Units Sold: ${s.totalUnitsSold}, Total Revenue: $${s.totalRevenue}`).join("\n")
    : "No sales summary data.";

  // Group history by week to check weekly trends
  const weeklyTrendsMap = new Map<string, number>();
  for (const s of history) {
    // Basic week identifier
    const date = s.date;
    const weekNum = Math.floor(date.getDate() / 7) + 1;
    const month = date.toLocaleString('default', { month: 'short' });
    const key = `${month} Week ${weekNum}`;
    weeklyTrendsMap.set(key, (weeklyTrendsMap.get(key) || 0) + s.quantity);
  }
  const weeklyTrends = Array.from(weeklyTrendsMap.entries())
    .map(([week, qty]) => `- ${week}: Sold ${qty} units total`)
    .slice(0, 10)
    .join("\n");

  const promoContext = promotions.length > 0
    ? promotions.map(p => `- SKU: ${p.sku}, Discount: ${p.discountPercent}%, Start: ${p.startDate.toISOString().split('T')[0]}, End: ${p.endDate.toISOString().split('T')[0]}`).join("\n")
    : "No promotions.";

  const prompt = `You are a Sales Analyst. Your job is to explain past sales performance trends in plain language, highlight top-performing products, and analyze promotional impact.

Vendor ID: ${vendorId}

Product Sales Summary (Last 30 Days):
${summaryContext}

Weekly Order Volume Trends (Past 90 Days):
${weeklyTrends}

Active/Upcoming Promotions:
${promoContext}

Analyze this information. Summarize the general direction of sales. Call out which products did best, and highlight if any promotion or event drove sales spikes or dips.
`;

  // 3. Call LLM with structured output
  const model = getModel().withStructuredOutput(salesInsightResponseSchema, {
    name: "sales_insight"
  });

  const response = await model.invoke([
    new SystemMessage("You are an expert e-commerce sales insight and business analyst agent."),
    new HumanMessage(prompt)
  ]);

  const salesInsight: SalesInsightData = response;

  console.log(`[Sales Insight Agent] Generated sales insights.`);

  return {
    salesInsight,
    messages: [
      new HumanMessage(
        `[Sales Insight Agent] Analyzed trends for Vendor: ${vendorId}.\n` +
        `Summary: ${salesInsight.summary}\n` +
        `Top SKUs: ${salesInsight.topSKUs.join(", ")}`
      )
    ]
  };
}
