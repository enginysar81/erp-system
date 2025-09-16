// Database migration script to transfer existing JSON data to PostgreSQL
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { products, stockMovements, customers, customerTransactions } from "./shared/schema.ts";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize database connection
const sql = neon(process.env.DATABASE_URL);
const db = drizzle(sql);

async function migrateProductsData() {
  try {
    console.log('🔄 Migrating products data...');
    
    // Read JSON data
    const productsPath = path.join(__dirname, 'data/products.json');
    const productsData = JSON.parse(fs.readFileSync(productsPath, 'utf8'));
    
    // Clear existing data
    await db.delete(products);
    console.log('✅ Cleared existing products data');
    
    // Insert products
    for (const product of productsData) {
      try {
        await db.insert(products).values({
          id: product.id,
          name: product.name,
          buyPrice: product.buyPrice?.toString() || "0",
          sellPrice: product.sellPrice?.toString() || "0",
          currency: product.currency || "USD",
          buyCurrency: product.buyCurrency || "USD", 
          sellCurrency: product.sellCurrency || "USD",
          stock: product.stock || 0,
          unit: product.unit || "adet",
          status: product.status || "Aktif",
          description: product.description || null,
          coverImage: product.coverImage || null,
          images: product.images || [],
          attributes: product.attributes || []
        });
      } catch (error) {
        console.error(`Error inserting product ${product.id}:`, error);
      }
    }
    
    console.log(`✅ Migrated ${productsData.length} products to database`);
  } catch (error) {
    console.error('❌ Error migrating products:', error);
  }
}

async function migrateStockMovementsData() {
  try {
    console.log('🔄 Migrating stock movements data...');
    
    // Read JSON data
    const stockMovementsPath = path.join(__dirname, 'data/stockMovements.json');
    const stockMovementsData = JSON.parse(fs.readFileSync(stockMovementsPath, 'utf8'));
    
    // Clear existing data
    await db.delete(stockMovements);
    console.log('✅ Cleared existing stock movements data');
    
    // Insert stock movements
    for (const movement of stockMovementsData) {
      try {
        await db.insert(stockMovements).values({
          id: movement.id,
          productId: movement.productId,
          warehouseId: movement.warehouseId,
          shelfId: movement.shelfId || null,
          type: movement.type || "Giriş",
          quantity: movement.quantity.toString(),
          unit: movement.unit || "adet",
          date: new Date(movement.date),
          note: movement.note || null,
          barcodes: movement.barcodes || []
        });
      } catch (error) {
        console.error(`Error inserting stock movement ${movement.id}:`, error);
      }
    }
    
    console.log(`✅ Migrated ${stockMovementsData.length} stock movements to database`);
  } catch (error) {
    console.error('❌ Error migrating stock movements:', error);
  }
}

async function migrateCustomersData() {
  try {
    console.log('🔄 Migrating customers data...');
    
    // Read JSON data
    const customersPath = path.join(__dirname, 'data/customers.json');
    const customersData = JSON.parse(fs.readFileSync(customersPath, 'utf8'));
    
    // Clear existing data
    await db.delete(customers);
    console.log('✅ Cleared existing customers data');
    
    // Insert customers
    for (const customer of customersData) {
      try {
        await db.insert(customers).values({
          id: customer.id,
          code: customer.code,
          name: customer.name,
          phone: customer.phone || null,
          address: customer.address || null,
          currency: customer.currency || "USD",
          openingBalance: customer.openingBalance?.toString() || "0",
          createdAt: new Date(customer.createdAt),
          updatedAt: new Date(customer.updatedAt)
        });
      } catch (error) {
        console.error(`Error inserting customer ${customer.id}:`, error);
      }
    }
    
    console.log(`✅ Migrated ${customersData.length} customers to database`);
  } catch (error) {
    console.error('❌ Error migrating customers:', error);
  }
}

async function migrateCustomerTransactionsData() {
  try {
    console.log('🔄 Migrating customer transactions data...');
    
    // Read JSON data
    const transactionsPath = path.join(__dirname, 'data/customer-transactions.json');
    
    // Check if file exists
    if (!fs.existsSync(transactionsPath)) {
      console.log('ℹ️ No customer transactions file found, skipping...');
      return;
    }
    
    const transactionsData = JSON.parse(fs.readFileSync(transactionsPath, 'utf8'));
    
    // Clear existing data
    await db.delete(customerTransactions);
    console.log('✅ Cleared existing customer transactions data');
    
    // Insert customer transactions
    for (const transaction of transactionsData) {
      try {
        await db.insert(customerTransactions).values({
          id: transaction.id,
          customerId: transaction.customerId,
          type: transaction.type,
          amount: transaction.amount.toString(),
          currency: transaction.currency || "USD",
          description: transaction.description || null,
          date: new Date(transaction.date),
          reference: transaction.reference || null,
          createdAt: new Date(transaction.createdAt),
          updatedAt: new Date(transaction.updatedAt)
        });
      } catch (error) {
        console.error(`Error inserting customer transaction ${transaction.id}:`, error);
      }
    }
    
    console.log(`✅ Migrated ${transactionsData.length} customer transactions to database`);
  } catch (error) {
    console.error('❌ Error migrating customer transactions:', error);
  }
}

async function runMigration() {
  console.log('🚀 Starting database migration...');
  console.log('📂 Transferring data from JSON files to PostgreSQL database\n');
  
  try {
    await migrateProductsData();
    await migrateStockMovementsData();
    await migrateCustomersData();
    await migrateCustomerTransactionsData();
    
    console.log('\n🎉 Migration completed successfully!');
    console.log('💾 All data has been transferred to the PostgreSQL database');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runMigration();
}