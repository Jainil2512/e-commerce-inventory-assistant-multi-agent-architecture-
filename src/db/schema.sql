-- Database Schema for E-commerce Multi-Vendor Order & Inventory Assistant

-- 1. Vendors Table
CREATE TABLE IF NOT EXISTS vendors (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Products Table
CREATE TABLE IF NOT EXISTS products (
  id VARCHAR(50) PRIMARY KEY,
  vendor_id VARCHAR(50) NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  sku VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  current_stock INT NOT NULL DEFAULT 0,
  min_stock_level INT NOT NULL DEFAULT 10,
  UNIQUE(vendor_id, sku)
);

-- 3. Orders Table (Sales history)
CREATE TABLE IF NOT EXISTS orders (
  id VARCHAR(50) PRIMARY KEY,
  vendor_id VARCHAR(50) NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  product_id VARCHAR(50) NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity INT NOT NULL,
  order_date TIMESTAMP NOT NULL,
  unit_price DECIMAL(10, 2) NOT NULL
);

-- 4. Promotions Table
CREATE TABLE IF NOT EXISTS promotions (
  id VARCHAR(50) PRIMARY KEY,
  vendor_id VARCHAR(50) NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  product_id VARCHAR(50) NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  discount_percent DECIMAL(5, 2) NOT NULL,
  start_date TIMESTAMP NOT NULL,
  end_date TIMESTAMP NOT NULL
);
