import "dotenv/config";
import { graph } from "./graphs/assistant.graph.js";
import { pool } from "./db/connection.js";

/**
 * Runs a query through the multi-agent graph with vendor context.
 */
async function testAgentSystem(vendorId: string, vendorName: string, queryText: string) {
  console.log(`\n==================================================`);
  console.log(`Vendor: ${vendorName} (${vendorId})`);
  console.log(`Query : "${queryText}"`);
  console.log(`==================================================`);

  try {
    const result = await graph.invoke({
      userQuery: queryText,
      vendorId: vendorId,
      messages: [],
      nextAgent: "FINISH",
      demandForecast: null,
      inventoryStatus: null,
      salesInsight: null,
      finalResponse: "",
    });

    console.log("\n--- [Execution Log] ---");
    for (const msg of result.messages) {
      if (typeof msg.content === "string" && msg.content.startsWith("[Supervisor]")) {
        console.log(msg.content);
      }
    }

    console.log("\n--- [Final Assistant Response] ---");
    console.log(result.finalResponse);
    console.log(`==================================================\n`);
  } catch (err: any) {
    console.error(`Execution failed for ${vendorId}:`, err.message ?? err);
  }
}

async function main() {
  console.log("Starting Production-Grade Multi-Vendor E-commerce Assistant Demo...\n");

  // Query 1: Sales trends for TechGadgets (vendor_1) -> routes to sales_insight
  await testAgentSystem(
    "vendor_1",
    "TechGadgets Inc.",
    "Can you give me a summary of our sales performance and key trends over the last month?"
  );

  // Query 2: Reorder suggestion for TechGadgets (vendor_1) -> routes to demand_forecasting then inventory
  await testAgentSystem(
    "vendor_1",
    "TechGadgets Inc.",
    "What products are we low on and what should we restock for next month based on predicted demand?"
  );

  // Query 3: Reorder suggestion for WinterApparel (vendor_2) -> routes to demand_forecasting then inventory (with different data!)
  await testAgentSystem(
    "vendor_2",
    "WinterApparel Ltd.",
    "Based on predicted demand, what products do we need to reorder and how much stock do we currently have?"
  );

  console.log("All demonstrations finished.");
}

main()
  .catch((err) => {
    console.error("Demo failed:", err);
  })
  .finally(async () => {
    // Close the DB connection pool so the Node process exits clean
    console.log("Closing database connections...");
    await pool.end();
  });