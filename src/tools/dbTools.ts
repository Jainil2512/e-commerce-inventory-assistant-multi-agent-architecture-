import { query } from "../db/connection.js";

export interface SalesRecord {
  sku: string;
  name: string;
  date: Date;
  quantity: number;
  price: number;
}

export interface PromotionRecord {
  sku: string;
  productName: string;
  discountPercent: number;
  startDate: Date;
  endDate: Date;
}

export interface ProductStockRecord {
  id: string;
  sku: string;
  name: string;
  price: number;
  currentStock: number;
  minStockLevel: number;
}

export interface SalesSummaryRecord {
  sku: string;
  name: string;
  totalUnitsSold: number;
  totalRevenue: number;
}

/**
 * Fetches sales history for a vendor, limited to the past N days.
 * Strictly scopes query by vendor_id to enforce multi-tenant isolation.
 */
export async function getSalesHistory(vendorId: string, limitDays: number = 90): Promise<SalesRecord[]> {
  const sql = `
    SELECT p.sku, p.name, o.order_date as date, o.quantity, o.unit_price as price
    FROM orders o
    JOIN products p ON o.product_id = p.id
    WHERE o.vendor_id = $1 AND o.order_date >= NOW() - CAST($2 || ' days' AS INTERVAL)
    ORDER BY o.order_date DESC
  `;
  const res = await query(sql, [vendorId, limitDays.toString()]);
  return res.rows.map(row => ({
    sku: row.sku,
    name: row.name,
    date: new Date(row.date),
    quantity: Number(row.quantity),
    price: Number(row.price)
  }));
}

/**
 * Fetches active or upcoming promotions for a vendor's products.
 * Scoped strictly by vendor_id.
 */
export async function getPromotions(vendorId: string): Promise<PromotionRecord[]> {
  const sql = `
    SELECT p.sku, p.name as product_name, prom.discount_percent, prom.start_date, prom.end_date
    FROM promotions prom
    JOIN products p ON prom.product_id = p.id
    WHERE prom.vendor_id = $1
  `;
  const res = await query(sql, [vendorId]);
  return res.rows.map(row => ({
    sku: row.sku,
    productName: row.product_name,
    discountPercent: Number(row.discount_percent),
    startDate: new Date(row.start_date),
    endDate: new Date(row.end_date)
  }));
}

/**
 * Fetches stock levels and reorder thresholds for all products of a vendor.
 * Scoped strictly by vendor_id.
 */
export async function getStockLevels(vendorId: string): Promise<ProductStockRecord[]> {
  const sql = `
    SELECT id, sku, name, price, current_stock as "currentStock", min_stock_level as "minStockLevel"
    FROM products
    WHERE vendor_id = $1
  `;
  const res = await query(sql, [vendorId]);
  return res.rows.map(row => ({
    id: row.id,
    sku: row.sku,
    name: row.name,
    price: Number(row.price),
    currentStock: Number(row.currentStock),
    minStockLevel: Number(row.minStockLevel)
  }));
}

/**
 * Fetches sales performance summaries per product over the last N days.
 * Scoped strictly by vendor_id.
 */
export async function getSalesSummary(vendorId: string, limitDays: number = 30): Promise<SalesSummaryRecord[]> {
  const sql = `
    SELECT p.sku, p.name, SUM(o.quantity)::INT as "totalUnitsSold", SUM(o.quantity * o.unit_price)::DECIMAL as "totalRevenue"
    FROM orders o
    JOIN products p ON o.product_id = p.id
    WHERE o.vendor_id = $1 AND o.order_date >= NOW() - CAST($2 || ' days' AS INTERVAL)
    GROUP BY p.sku, p.name
    ORDER BY "totalUnitsSold" DESC
  `;
  const res = await query(sql, [vendorId, limitDays.toString()]);
  return res.rows.map(row => ({
    sku: row.sku,
    name: row.name,
    totalUnitsSold: Number(row.totalUnitsSold),
    totalRevenue: Number(row.totalRevenue)
  }));
}
