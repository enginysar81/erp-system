import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, decimal, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const products = pgTable("products", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  buyPrice: decimal("buy_price", { precision: 10, scale: 2 }).notNull(),
  sellPrice: decimal("sell_price", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).notNull().default("USD"),
  buyCurrency: varchar("buy_currency", { length: 3 }).notNull().default("USD"),
  sellCurrency: varchar("sell_currency", { length: 3 }).notNull().default("USD"),
  stock: integer("stock").notNull().default(0),
  unit: varchar("unit", { length: 10 }).notNull().default("adet"),
  status: varchar("status", { length: 20 }).notNull().default("Aktif"),
  description: text("description"),
  coverImage: text("cover_image"),
  images: text("images").array().default([]),
  attributes: text("attributes").array().default([]),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

export const insertProductSchema = createInsertSchema(products).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof products.$inferSelect;

// Stock Movements Table
export const stockMovements = pgTable("stock_movements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  productId: varchar("product_id").notNull(),
  warehouseId: varchar("warehouse_id").notNull(),
  shelfId: varchar("shelf_id"),
  type: varchar("type", { length: 20 }).notNull().default("Giriş"), // "Giriş" or "Çıkış"
  quantity: decimal("quantity", { precision: 10, scale: 2 }).notNull(),
  unit: varchar("unit", { length: 10 }).notNull().default("adet"), // "adet" or "metre"
  date: timestamp("date").notNull().default(sql`now()`),
  note: text("note"),
  barcodes: text("barcodes").array().default([]),
});

export const insertStockMovementSchema = createInsertSchema(stockMovements).omit({
  id: true,
  date: true,
});

export type InsertStockMovement = z.infer<typeof insertStockMovementSchema>;
export type StockMovement = typeof stockMovements.$inferSelect;

// Barcodes Table
export const barcodes = pgTable("barcodes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: varchar("code", { length: 20 }).notNull().unique(),
  productId: varchar("product_id").notNull(),
  stockMovementId: varchar("stock_movement_id").notNull(),
  warehouseId: varchar("warehouse_id").notNull(),
  shelfId: varchar("shelf_id"),
  quantity: decimal("quantity", { precision: 10, scale: 2 }).notNull().default("1"),
  unit: varchar("unit", { length: 10 }).notNull().default("adet"),
  isUsed: integer("is_used").notNull().default(0), // 0 = not used, 1 = used
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertBarcodeSchema = createInsertSchema(barcodes).omit({
  id: true,
  createdAt: true,
});

export type InsertBarcode = z.infer<typeof insertBarcodeSchema>;
export type Barcode = typeof barcodes.$inferSelect;

// JSON Schema Types for File-based Storage
export const stockMovementJsonSchema = z.object({
  id: z.string(),
  productId: z.string(),
  warehouseId: z.string(),
  shelfId: z.string().nullable(),
  type: z.enum(["Giriş", "Çıkış"]).default("Giriş"),
  quantity: z.number().positive(),
  unit: z.enum(["adet", "metre"]).default("adet"),
  date: z.string(),
  note: z.string().optional(),
  barcodes: z.array(z.string()).default([]),
});

export const barcodeJsonSchema = z.object({
  id: z.string(),
  code: z.string().length(6),
  productId: z.string(),
  stockMovementId: z.string(),
  warehouseId: z.string(),
  shelfId: z.string().nullable(),
  quantity: z.number().positive().default(1),
  unit: z.enum(["adet", "metre"]).default("adet"),
  isUsed: z.boolean().default(false),
  createdAt: z.string(),
});

export type StockMovementJson = z.infer<typeof stockMovementJsonSchema>;
export type BarcodeJson = z.infer<typeof barcodeJsonSchema>;

// Label Template Element Schemas
const labelElementBaseSchema = z.object({
  x: z.number().min(0),
  y: z.number().min(0),
  width: z.number().min(1),
  height: z.number().min(1)
});

const labelTextElementSchema = labelElementBaseSchema.extend({
  type: z.literal("text"),
  field: z.enum(["productName", "features", "price", "date"]),
  fontSize: z.number().min(4).max(72).default(12),
  bold: z.boolean().default(false),
  italic: z.boolean().default(false),
  align: z.enum(["left", "center", "right"]).default("left")
});

const labelBarcodeElementSchema = labelElementBaseSchema.extend({
  type: z.literal("barcode"),
  field: z.literal("barcode")
});

const labelImageElementSchema = labelElementBaseSchema.extend({
  type: z.literal("image"),
  field: z.literal("logo")
});

const labelElementSchema = z.discriminatedUnion("type", [
  labelTextElementSchema,
  labelBarcodeElementSchema,
  labelImageElementSchema
]);

// Label Template Schema (JSON-based, not DB table)
const labelTemplateSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(100),
  width: z.number().min(10).max(500),
  height: z.number().min(10).max(500),
  elements: z.array(labelElementSchema),
  isDefault: z.boolean().default(false),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export const insertLabelTemplateSchema = labelTemplateSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export type LabelTemplate = z.infer<typeof labelTemplateSchema>;
export type InsertLabelTemplate = z.infer<typeof insertLabelTemplateSchema>;
export type LabelElement = z.infer<typeof labelElementSchema>;

// Customers Table
export const customers = pgTable("customers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: varchar("code", { length: 50 }).notNull().unique(),
  name: text("name").notNull(),
  phone: varchar("phone", { length: 20 }),
  address: text("address"),
  currency: varchar("currency", { length: 3 }).notNull().default("USD"),
  openingBalance: decimal("opening_balance", { precision: 10, scale: 2 }).notNull().default("0"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

export const insertCustomerSchema = createInsertSchema(customers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateCustomerSchema = insertCustomerSchema.partial();

export type Customer = typeof customers.$inferSelect;
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type UpdateCustomer = z.infer<typeof updateCustomerSchema>;

// Customer JSON Schema for File-based Storage
export const customerJsonSchema = z.object({
  id: z.string(),
  code: z.string().min(1, "Customer code is required"),
  name: z.string().min(1, "Customer name is required"),
  phone: z.string().optional(),
  address: z.string().optional(),
  currency: z.enum(["USD", "PLN", "UAH", "TRY"]).default("USD"),
  openingBalance: z.number().default(0),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const insertCustomerJsonSchema = customerJsonSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateCustomerJsonSchema = insertCustomerJsonSchema.partial();

export type CustomerJson = z.infer<typeof customerJsonSchema>;
export type InsertCustomerJson = z.infer<typeof insertCustomerJsonSchema>;
export type UpdateCustomerJson = z.infer<typeof updateCustomerJsonSchema>;

// Customer Transactions Table for Current Account Management
export const customerTransactions = pgTable("customer_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  customerId: varchar("customer_id").notNull().references(() => customers.id),
  type: varchar("type", { length: 20 }).notNull(), // 'sale', 'payment', 'return', 'adjustment'
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).notNull().default("USD"),
  description: text("description"),
  date: timestamp("date").notNull().default(sql`now()`),
  reference: varchar("reference", { length: 100 }), // For linking to invoices, receipts etc
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

export const insertCustomerTransactionSchema = createInsertSchema(customerTransactions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateCustomerTransactionSchema = insertCustomerTransactionSchema.partial();

export type CustomerTransaction = typeof customerTransactions.$inferSelect;
export type InsertCustomerTransaction = z.infer<typeof insertCustomerTransactionSchema>;
export type UpdateCustomerTransaction = z.infer<typeof updateCustomerTransactionSchema>;

// Customer Transaction JSON Schema for File-based Storage
export const customerTransactionJsonSchema = z.object({
  id: z.string(),
  customerId: z.string(),
  type: z.enum(["sale", "payment", "return", "adjustment"]),
  amount: z.number(),
  currency: z.enum(["USD", "PLN", "UAH", "TRY"]).default("USD"),
  description: z.string().optional(),
  date: z.string(),
  reference: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const insertCustomerTransactionJsonSchema = customerTransactionJsonSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type CustomerTransactionJson = z.infer<typeof customerTransactionJsonSchema>;
export type InsertCustomerTransactionJson = z.infer<typeof insertCustomerTransactionJsonSchema>;
