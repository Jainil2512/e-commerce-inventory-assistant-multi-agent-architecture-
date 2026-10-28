import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { query, pool } from "./connection.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function setupDatabase() {
  console.log("Starting database schema migration & seeding...");

  try {
    // 1. Read and run schema.sql
    const schemaPath = path.join(__dirname, "schema.sql");
    const schemaSql = await fs.readFile(schemaPath, "utf-8");
    
    console.log("Executing DDL schema...");
    await query(schemaSql);
    console.log("DDL executed successfully.");

    // 2. Clear existing tables to ensure a clean run
    console.log("Clearing existing tables for a clean seed...");
    await query("TRUNCATE TABLE promotions, orders, products, vendors CASCADE;");

    // 3. Seed Vendors
    console.log("Seeding vendors...");
    await query(`
      INSERT INTO vendors (id, name) VALUES 
      ('vendor_1', 'TechGadgets Inc.'),
      ('vendor_2', 'WinterApparel Ltd.');
    `);

    // 4. Seed Products
    console.log("Seeding products...");
    await query(`
      INSERT INTO products (id, vendor_id, sku, name, price, current_stock, min_stock_level) VALUES
      -- TechGadgets products
      ('p_tg_laptop', 'vendor_1', 'SKU-1001', 'Alpha Laptop', 999.99, 15, 10),
      ('p_tg_earbuds', 'vendor_1', 'SKU-1002', 'Beta Wireless Earbuds', 89.99, 5, 20),
      ('p_tg_smartwatch', 'vendor_1', 'SKU-1003', 'Gamma Smartwatch', 199.99, 50, 15),

      -- WinterApparel products
      ('p_wa_parka', 'vendor_2', 'SKU-2001', 'Polar Parka', 150.00, 4, 15),
      ('p_wa_gloves', 'vendor_2', 'SKU-2002', 'Thermal Gloves', 25.00, 100, 50),
      ('p_wa_beanie', 'vendor_2', 'SKU-2003', 'Woolen Beanie', 18.00, 60, 30);
    `);

    // 5. Seed Orders (Sales history - past 90 days)
    console.log("Seeding orders...");
    const now = new Date();
    const ordersList: any[] = [];
    
    // TechGadgets Sales (past 90 days)
    // SKU-1001 (Alpha Laptop) - steady sales, ~2 units every 5 days
    // SKU-1002 (Beta Earbuds) - high sales, ~5 units every 3 days
    // SKU-1003 (Gamma Smartwatch) - steady sales, ~3 units every 4 days
    
    // WinterApparel Sales (past 90 days)
    // SKU-2001 (Polar Parka) - winter seasonal sales, high in first 60 days of the winter, declining now
    // SKU-2002 (Thermal Gloves) - steady high winter sales
    // SKU-2003 (Woolen Beanie) - steady medium sales

    let orderCounter = 1;

    // Helper to add order to array
    const addOrder = (vendorId: string, productId: string, qty: number, daysAgo: number, price: number) => {
      const orderDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
      ordersList.push([
        `ord_${vendorId}_${orderCounter++}`,
        vendorId,
        productId,
        qty,
        orderDate.toISOString(),
        price
      ]);
    };

    // TechGadgets Orders over 90 days
    for (let day = 90; day >= 1; day--) {
      // Laptop: every 5 days, buy 1-2
      if (day % 5 === 0) {
        addOrder('vendor_1', 'p_tg_laptop', Math.floor(Math.random() * 2) + 1, day, 999.99);
      }
      // Earbuds: every 2 days, buy 2-5
      if (day % 2 === 0) {
        addOrder('vendor_1', 'p_tg_earbuds', Math.floor(Math.random() * 4) + 2, day, 89.99);
      }
      // Smartwatch: every 4 days, buy 1-3
      if (day % 4 === 0) {
        addOrder('vendor_1', 'p_tg_smartwatch', Math.floor(Math.random() * 3) + 1, day, 199.99);
      }
    }

    // WinterApparel Orders over 90 days (high volume, winter season)
    for (let day = 90; day >= 1; day--) {
      // Parka: every 3 days, buy 1-3
      if (day % 3 === 0) {
        addOrder('vendor_2', 'p_wa_parka', Math.floor(Math.random() * 3) + 1, day, 150.00);
      }
      // Gloves: every day, buy 2-6
      addOrder('vendor_2', 'p_wa_gloves', Math.floor(Math.random() * 5) + 2, day, 25.00);
      // Beanie: every 2 days, buy 1-4
      if (day % 2 === 0) {
        addOrder('vendor_2', 'p_wa_beanie', Math.floor(Math.random() * 4) + 1, day, 18.00);
      }
    }

    // Batch insert orders
    for (const ord of ordersList) {
      await query(
        `INSERT INTO orders (id, vendor_id, product_id, quantity, order_date, unit_price) 
         VALUES ($1, $2, $3, $4, $5, $6)`,
        ord
      );
    }
    console.log(`Successfully seeded ${ordersList.length} orders.`);

    // 6. Seed Promotions
    console.log("Seeding promotions...");
    // TechGadgets: active promo on earbuds (20% off)
    const startEarbuds = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
    const endEarbuds = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);
    
    // WinterApparel: upcoming promo on beanies next week
    const startBeanie = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const endBeanie = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000);

    await query(`
      INSERT INTO promotions (id, vendor_id, product_id, discount_percent, start_date, end_date) VALUES
      ('promo_tg_earbuds', 'vendor_1', 'p_tg_earbuds', 20.00, $1, $2),
      ('promo_wa_beanie', 'vendor_2', 'p_wa_beanie', 15.00, $3, $4);
    `, [startEarbuds.toISOString(), endEarbuds.toISOString(), startBeanie.toISOString(), endBeanie.toISOString()]);

    console.log("Promotions seeded successfully.");
    console.log("Database setup and seeding completed successfully!");
  } catch (error: any) {
    console.error("Database setup failed:", error.message ?? error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Check if run directly
if (process.argv[1] && process.argv[1].endsWith("setup.ts")) {
  setupDatabase().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
