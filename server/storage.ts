import { type Product, type InsertProduct, type StockMovement, type InsertStockMovement, type Barcode, type InsertBarcode, type LabelTemplate, type InsertLabelTemplate, type Customer, type InsertCustomer, type UpdateCustomer, type CustomerTransaction, type InsertCustomerTransaction, products, stockMovements, barcodes, customers, customerTransactions } from "@shared/schema";
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { eq, desc, max } from "drizzle-orm";
import { sql as drizzleSql } from "drizzle-orm";
import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

export interface IStorage {
  getUser(id: string): Promise<any | undefined>;
  getUserByUsername(username: string): Promise<any | undefined>;
  createUser(user: any): Promise<any>;
  
  // Product methods
  getAllProducts(): Promise<Product[]>;
  getProduct(id: string): Promise<Product | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: string, product: Partial<InsertProduct>): Promise<Product | undefined>;
  deleteProduct(id: string): Promise<boolean>;
  updateProductStock(id: string, stockChange: number): Promise<Product | undefined>;
  
  // Stock movement methods
  createStockMovement(movement: Omit<InsertStockMovement, 'id'>): Promise<StockMovement>;
  getStockMovements(): Promise<StockMovement[]>;
  updateStockMovementBarcodes(id: string, barcodes: string[]): Promise<StockMovement | undefined>;
  
  // Warehouse methods
  getWarehouses(): Promise<any[]>;
  
  // Label template methods
  getAllLabelTemplates(): Promise<LabelTemplate[]>;
  getLabelTemplate(id: string): Promise<LabelTemplate | undefined>;
  createLabelTemplate(template: InsertLabelTemplate): Promise<LabelTemplate>;
  updateLabelTemplate(id: string, template: Partial<InsertLabelTemplate>): Promise<LabelTemplate | undefined>;
  deleteLabelTemplate(id: string): Promise<boolean>;
  setDefaultLabelTemplate(id: string): Promise<LabelTemplate | undefined>;
  getDefaultLabelTemplate(): Promise<LabelTemplate | undefined>;
  
  // Customer methods
  getAllCustomers(): Promise<Customer[]>;
  getCustomer(id: string): Promise<Customer | undefined>;
  getCustomerByCode(code: string): Promise<Customer | undefined>;
  createCustomer(customer: InsertCustomer): Promise<Customer>;
  updateCustomer(id: string, customer: UpdateCustomer): Promise<Customer | undefined>;
  deleteCustomer(id: string): Promise<boolean>;
  generateCustomerCode(): Promise<string>;
  getNextCustomerCode(): Promise<string>;
  
  // Barcode methods
  createBarcode(barcode: InsertBarcode): Promise<Barcode>;
  getBarcodesByStockMovement(stockMovementId: string): Promise<Barcode[]>;
  
  // Customer Transaction methods
  createCustomerTransaction(transaction: InsertCustomerTransaction): Promise<CustomerTransaction>;
  getCustomerTransactionsByCustomerId(customerId: string): Promise<CustomerTransaction[]>;
  getCustomerBalance(customerId: string): Promise<{ balance: number; totalDebt: number; totalCredit: number }>;
  getCustomerStats(): Promise<{
    totalCustomers: number;
    totalDebt: number;
    totalCredit: number;
    topBuyers: Array<{ customer: Customer; totalSales: number }>;
  }>;
}

// Storage type flag
type StorageType = 'database' | 'json';

// Utility functions for file operations
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '../data');

function ensureDataDirectory() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    console.log('📁 Created data directory');
  }
}

function ensureDataFile(filename: string, defaultData: any[]) {
  const filepath = path.join(dataDir, filename);
  if (!fs.existsSync(filepath)) {
    fs.writeFileSync(filepath, JSON.stringify(defaultData, null, 2));
    console.log(`📄 Created default ${filename}`);
  }
}

function loadJsonData<T>(filename: string, defaultData: T[] = []): T[] {
  try {
    const filepath = path.join(dataDir, filename);
    const data = fs.readFileSync(filepath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.warn(`⚠️ Failed to load ${filename}, using defaults:`, error);
    return defaultData;
  }
}

function saveJsonData<T>(filename: string, data: T[]): boolean {
  try {
    const filepath = path.join(dataDir, filename);
    fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error(`❌ Failed to save ${filename}:`, error);
    return false;
  }
}

// JSON-based storage implementation (zero-config fallback)
export class JsonStorage implements IStorage {
  private users: Map<string, any>;
  private warehouses: any[] = [];
  private labelTemplates: LabelTemplate[] = [];
  private products: Product[] = [];
  private customers: Customer[] = [];
  private stockMovements: StockMovement[] = [];
  private barcodes: Barcode[] = [];
  private customerTransactions: CustomerTransaction[] = [];

  constructor() {
    ensureDataDirectory();
    this.users = new Map();
    
    // Initialize with default empty arrays, then load from files
    this.initializeAllData();
    console.log('🗂️ JSON Storage initialized successfully');
  }

  private initializeAllData() {
    // Ensure all data files exist with defaults
    ensureDataFile('products.json', []);
    ensureDataFile('customers.json', []);
    ensureDataFile('stockMovements.json', []);
    ensureDataFile('barcodes.json', []);
    ensureDataFile('customer-transactions.json', []);
    ensureDataFile('warehouses.json', []);
    ensureDataFile('labels.json', []);

    // Load all data
    this.products = loadJsonData<Product>('products.json');
    this.customers = loadJsonData<Customer>('customers.json');
    this.stockMovements = loadJsonData<StockMovement>('stockMovements.json');
    this.barcodes = loadJsonData<Barcode>('barcodes.json');
    this.customerTransactions = loadJsonData<CustomerTransaction>('customer-transactions.json');
    this.warehouses = loadJsonData<any>('warehouses.json');
    this.labelTemplates = loadJsonData<LabelTemplate>('labels.json');

    console.log(`✅ Loaded JSON data: ${this.products.length} products, ${this.customers.length} customers, ${this.stockMovements.length} stock movements, ${this.barcodes.length} barcodes, ${this.customerTransactions.length} transactions, ${this.warehouses.length} warehouses, ${this.labelTemplates.length} labels`);
  }

  // User methods (in-memory)
  async getUser(id: string): Promise<any | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<any | undefined> {
    return Array.from(this.users.values()).find(user => user.username === username);
  }

  async createUser(insertUser: any): Promise<any> {
    const id = randomUUID();
    const user: any = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  // Product methods
  async getAllProducts(): Promise<Product[]> {
    return this.products;
  }

  async getProduct(id: string): Promise<Product | undefined> {
    return this.products.find(product => product.id === id);
  }

  async createProduct(insertProduct: InsertProduct): Promise<Product> {
    const id = `prod_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const now = new Date();
    const newProduct: Product = {
      currency: "USD",
      buyCurrency: "USD", 
      sellCurrency: "USD",
      stock: 0,
      unit: "adet",
      status: "Aktif",
      description: null,
      coverImage: null,
      images: [],
      attributes: [],
      ...insertProduct,
      id,
      createdAt: now,
      updatedAt: now
    };
    
    this.products.push(newProduct);
    saveJsonData('products.json', this.products);
    return newProduct;
  }

  async updateProduct(id: string, updateData: Partial<InsertProduct>): Promise<Product | undefined> {
    const productIndex = this.products.findIndex(product => product.id === id);
    if (productIndex === -1) return undefined;
    
    const updatedProduct: Product = {
      ...this.products[productIndex],
      ...updateData,
      updatedAt: new Date()
    };
    
    this.products[productIndex] = updatedProduct;
    saveJsonData('products.json', this.products);
    return updatedProduct;
  }

  async deleteProduct(id: string): Promise<boolean> {
    const productIndex = this.products.findIndex(product => product.id === id);
    if (productIndex === -1) return false;
    
    this.products.splice(productIndex, 1);
    saveJsonData('products.json', this.products);
    return true;
  }

  async updateProductStock(id: string, stockChange: number): Promise<Product | undefined> {
    const product = await this.getProduct(id);
    if (!product) return undefined;
    
    const newStock = Math.max(0, product.stock + stockChange);
    return await this.updateProduct(id, { stock: newStock });
  }

  // Customer methods
  async getAllCustomers(): Promise<Customer[]> {
    return this.customers;
  }

  async getCustomer(id: string): Promise<Customer | undefined> {
    return this.customers.find(customer => customer.id === id);
  }

  async getCustomerByCode(code: string): Promise<Customer | undefined> {
    return this.customers.find(customer => customer.code === code);
  }

  async createCustomer(insertCustomer: InsertCustomer): Promise<Customer> {
    let customerCode = insertCustomer.code;
    if (!customerCode || customerCode.trim() === '' || customerCode === 'AUTO_GENERATE') {
      customerCode = await this.generateCustomerCode();
    }
    
    const id = randomUUID();
    const now = new Date();
    const newCustomer: Customer = {
      currency: "USD",
      openingBalance: "0",
      ...insertCustomer,
      phone: insertCustomer.phone || null,
      address: insertCustomer.address || null,
      id,
      code: customerCode,
      createdAt: now,
      updatedAt: now
    };
    
    this.customers.push(newCustomer);
    saveJsonData('customers.json', this.customers);
    return newCustomer;
  }

  async updateCustomer(id: string, updateData: UpdateCustomer): Promise<Customer | undefined> {
    const customerIndex = this.customers.findIndex(customer => customer.id === id);
    if (customerIndex === -1) return undefined;
    
    const updatedCustomer: Customer = {
      ...this.customers[customerIndex],
      ...updateData,
      updatedAt: new Date()
    };
    
    this.customers[customerIndex] = updatedCustomer;
    saveJsonData('customers.json', this.customers);
    return updatedCustomer;
  }

  async deleteCustomer(id: string): Promise<boolean> {
    const customerIndex = this.customers.findIndex(customer => customer.id === id);
    if (customerIndex === -1) return false;
    
    this.customers.splice(customerIndex, 1);
    saveJsonData('customers.json', this.customers);
    return true;
  }

  async generateCustomerCode(): Promise<string> {
    let code: string;
    let attempts = 0;
    const maxAttempts = 1000;
    
    do {
      const nextCode = await this.getNextCustomerCode();
      code = nextCode;
      attempts++;
      
      if (attempts > maxAttempts) {
        throw new Error('Unable to generate unique customer code after maximum attempts');
      }
    } while (await this.getCustomerByCode(code));
    
    return code;
  }

  async getNextCustomerCode(): Promise<string> {
    const maxCode = this.customers
      .map(c => c.code)
      .filter(code => /^\d{6}$/.test(code))
      .map(code => parseInt(code, 10))
      .reduce((max, current) => Math.max(max, current), 99999);
    
    const nextCode = Math.max(maxCode + 1, 100000);
    return nextCode.toString().padStart(6, '0');
  }

  // Stock movement methods
  async createStockMovement(movement: Omit<InsertStockMovement, 'id'>): Promise<StockMovement> {
    const id = randomUUID();
    const newMovement: StockMovement = {
      type: "Giriş",
      unit: "adet",
      barcodes: [],
      shelfId: null,
      note: null,
      ...movement,
      id,
      date: new Date()
    };
    
    this.stockMovements.push(newMovement);
    saveJsonData('stockMovements.json', this.stockMovements);
    return newMovement;
  }

  async getStockMovements(): Promise<StockMovement[]> {
    return this.stockMovements.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  async updateStockMovementBarcodes(id: string, barcodes: string[]): Promise<StockMovement | undefined> {
    const movementIndex = this.stockMovements.findIndex(movement => movement.id === id);
    if (movementIndex === -1) return undefined;
    
    this.stockMovements[movementIndex].barcodes = barcodes;
    saveJsonData('stockMovements.json', this.stockMovements);
    return this.stockMovements[movementIndex];
  }

  // Barcode methods
  async createBarcode(barcode: InsertBarcode): Promise<Barcode> {
    const id = randomUUID();
    const newBarcode: Barcode = {
      quantity: "1",
      unit: "adet",
      isUsed: 0,
      shelfId: null,
      ...barcode,
      id,
      createdAt: new Date()
    };
    
    this.barcodes.push(newBarcode);
    saveJsonData('barcodes.json', this.barcodes);
    return newBarcode;
  }

  async getBarcodesByStockMovement(stockMovementId: string): Promise<Barcode[]> {
    return this.barcodes.filter(barcode => barcode.stockMovementId === stockMovementId);
  }

  // Customer Transaction methods
  async createCustomerTransaction(insertTransaction: InsertCustomerTransaction): Promise<CustomerTransaction> {
    const id = randomUUID();
    const newTransaction: CustomerTransaction = {
      currency: "USD",
      description: null,
      reference: null,
      ...insertTransaction,
      id,
      date: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    this.customerTransactions.push(newTransaction);
    saveJsonData('customer-transactions.json', this.customerTransactions);
    return newTransaction;
  }

  async getCustomerTransactionsByCustomerId(customerId: string): Promise<CustomerTransaction[]> {
    return this.customerTransactions
      .filter(transaction => transaction.customerId === customerId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  async getCustomerBalance(customerId: string): Promise<{ balance: number; totalDebt: number; totalCredit: number }> {
    const customer = await this.getCustomer(customerId);
    if (!customer) {
      return { balance: 0, totalDebt: 0, totalCredit: 0 };
    }
    
    const transactions = await this.getCustomerTransactionsByCustomerId(customerId);
    
    const openingBalance = parseFloat(customer.openingBalance);
    let totalDebt = openingBalance > 0 ? openingBalance : 0;
    let totalCredit = openingBalance < 0 ? Math.abs(openingBalance) : 0;
    
    transactions.forEach(transaction => {
      const amount = parseFloat(transaction.amount);
      if (transaction.type === 'sale') {
        totalDebt += amount;
      } else if (transaction.type === 'payment') {
        totalCredit += amount;
      } else if (transaction.type === 'return') {
        totalCredit += amount;
      }
    });
    
    const balance = totalDebt - totalCredit;
    return { balance, totalDebt, totalCredit };
  }

  async getCustomerStats(): Promise<{
    totalCustomers: number;
    totalDebt: number;
    totalCredit: number;
    topBuyers: Array<{ customer: Customer; totalSales: number }>;
  }> {
    const allCustomers = await this.getAllCustomers();
    let totalSystemDebt = 0;
    let totalSystemCredit = 0;
    
    const customerSales: Array<{ customer: Customer; totalSales: number }> = [];
    
    for (const customer of allCustomers) {
      const balance = await this.getCustomerBalance(customer.id);
      totalSystemDebt += balance.totalDebt;
      totalSystemCredit += balance.totalCredit;
      
      const transactions = await this.getCustomerTransactionsByCustomerId(customer.id);
      const totalSales = transactions
        .filter(t => t.type === 'sale')
        .reduce((sum, t) => sum + parseFloat(t.amount), 0);
      
      customerSales.push({ customer, totalSales });
    }
    
    const topBuyers = customerSales
      .sort((a, b) => b.totalSales - a.totalSales)
      .slice(0, 5);
    
    return {
      totalCustomers: allCustomers.length,
      totalDebt: totalSystemDebt,
      totalCredit: totalSystemCredit,
      topBuyers
    };
  }

  // Warehouse methods
  async getWarehouses(): Promise<any[]> {
    return this.warehouses;
  }

  // Label template methods
  async getAllLabelTemplates(): Promise<LabelTemplate[]> {
    return this.labelTemplates;
  }
  
  async getLabelTemplate(id: string): Promise<LabelTemplate | undefined> {
    return this.labelTemplates.find(template => template.id === id);
  }
  
  async createLabelTemplate(template: InsertLabelTemplate): Promise<LabelTemplate> {
    const id = `tpl_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const now = new Date().toISOString();
    const newTemplate: LabelTemplate = {
      ...template,
      id,
      isDefault: template.isDefault || false,
      createdAt: now,
      updatedAt: now
    };
    
    this.labelTemplates.push(newTemplate);
    saveJsonData('labels.json', this.labelTemplates);
    return newTemplate;
  }
  
  async updateLabelTemplate(id: string, updateData: Partial<InsertLabelTemplate>): Promise<LabelTemplate | undefined> {
    const templateIndex = this.labelTemplates.findIndex(template => template.id === id);
    if (templateIndex === -1) return undefined;
    
    const updatedTemplate: LabelTemplate = {
      ...this.labelTemplates[templateIndex],
      ...updateData,
      updatedAt: new Date().toISOString()
    };
    
    this.labelTemplates[templateIndex] = updatedTemplate;
    saveJsonData('labels.json', this.labelTemplates);
    return updatedTemplate;
  }
  
  async deleteLabelTemplate(id: string): Promise<boolean> {
    const templateIndex = this.labelTemplates.findIndex(template => template.id === id);
    if (templateIndex === -1) return false;
    
    if (this.labelTemplates[templateIndex].isDefault) {
      return false;
    }
    
    this.labelTemplates.splice(templateIndex, 1);
    saveJsonData('labels.json', this.labelTemplates);
    return true;
  }
  
  async setDefaultLabelTemplate(id: string): Promise<LabelTemplate | undefined> {
    const template = this.labelTemplates.find(template => template.id === id);
    if (!template) return undefined;
    
    this.labelTemplates.forEach(template => {
      template.isDefault = false;
    });
    
    template.isDefault = true;
    template.updatedAt = new Date().toISOString();
    
    saveJsonData('labels.json', this.labelTemplates);
    return template;
  }
  
  async getDefaultLabelTemplate(): Promise<LabelTemplate | undefined> {
    return this.labelTemplates.find(template => template.isDefault === true);
  }
}

// Database storage implementation (enhanced functionality when DB available)
export class DatabaseStorage implements IStorage {
  private db: any;
  private users: Map<string, any>;
  private warehouses: any[];
  private labelTemplates: LabelTemplate[];
  private products: Product[];

  constructor() {
    this.users = new Map();
    this.warehouses = [];
    this.labelTemplates = [];
    this.products = [];
    this.initializeWarehouses();
    this.initializeLabelTemplates();
    this.initializeProducts();
    console.log('🗄️ Database Storage initialized');
  }

  private async initializeDatabase() {
    if (!this.db) {
      const sql = neon(process.env.DATABASE_URL!);
      this.db = drizzle(sql);
      console.log('🔗 Database connection established');
    }
    return this.db;
  }

  // User methods (keeping simple in-memory for now since no DB schema defined)
  async getUser(id: string): Promise<any | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<any | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: any): Promise<any> {
    const id = randomUUID();
    const user: any = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  // Product methods - using JSON file storage
  private initializeProducts() {
    try {
      const __dirname = path.dirname(fileURLToPath(import.meta.url));
      const jsonPath = path.join(__dirname, '../data/products.json');
      const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      this.products = data;
      console.log(`✅ Loaded ${data.length} products from JSON file`);
    } catch (error) {
      console.error('Failed to load products from JSON file:', error);
      this.products = [];
    }
  }
  
  private saveProductsToFile(): boolean {
    try {
      const __dirname = path.dirname(fileURLToPath(import.meta.url));
      const jsonPath = path.join(__dirname, '../data/products.json');
      fs.writeFileSync(jsonPath, JSON.stringify(this.products, null, 2));
      return true;
    } catch (error) {
      console.error('Failed to save products to file:', error);
      return false;
    }
  }

  async getAllProducts(): Promise<Product[]> {
    return this.products;
  }

  async getProduct(id: string): Promise<Product | undefined> {
    return this.products.find(product => product.id === id);
  }

  async createProduct(insertProduct: InsertProduct): Promise<Product> {
    const id = `prod_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const now = new Date();
    const newProduct: Product = {
      // Apply database defaults for required fields
      currency: "USD",
      buyCurrency: "USD", 
      sellCurrency: "USD",
      stock: 0,
      unit: "adet",
      status: "Aktif",
      description: null,
      coverImage: null,
      images: [],
      attributes: [],
      // Override with provided values
      ...insertProduct,
      // Set generated fields
      id,
      createdAt: now,
      updatedAt: now
    };
    
    this.products.push(newProduct);
    this.saveProductsToFile();
    
    return newProduct;
  }

  async updateProduct(id: string, updateData: Partial<InsertProduct>): Promise<Product | undefined> {
    const productIndex = this.products.findIndex(product => product.id === id);
    if (productIndex === -1) return undefined;
    
    const updatedProduct: Product = {
      ...this.products[productIndex],
      ...updateData,
      updatedAt: new Date()
    };
    
    this.products[productIndex] = updatedProduct;
    this.saveProductsToFile();
    
    return updatedProduct;
  }

  async deleteProduct(id: string): Promise<boolean> {
    const productIndex = this.products.findIndex(product => product.id === id);
    if (productIndex === -1) return false;
    
    this.products.splice(productIndex, 1);
    this.saveProductsToFile();
    
    return true;
  }

  async updateProductStock(id: string, stockChange: number): Promise<Product | undefined> {
    const product = await this.getProduct(id);
    if (!product) return undefined;
    
    const newStock = Math.max(0, product.stock + stockChange);
    return await this.updateProduct(id, { stock: newStock });
  }

  // Stock movement methods - using database
  async createStockMovement(movement: Omit<InsertStockMovement, 'id'>): Promise<StockMovement> {
    try {
      await this.initializeDatabase();
      const result = await this.db.insert(stockMovements)
        .values(movement)
        .returning();
      return result[0];
    } catch (error) {
      console.error('Error creating stock movement:', error);
      throw error;
    }
  }

  async getStockMovements(): Promise<StockMovement[]> {
    try {
      await this.initializeDatabase();
      const result = await this.db.select().from(stockMovements).orderBy(desc(stockMovements.date));
      return result;
    } catch (error) {
      console.error('Error getting stock movements:', error);
      return [];
    }
  }

  async updateStockMovementBarcodes(id: string, barcodes: string[]): Promise<StockMovement | undefined> {
    try {
      await this.initializeDatabase();
      const result = await this.db.update(stockMovements)
        .set({ barcodes })
        .where(eq(stockMovements.id, id))
        .returning();
      return result[0];
    } catch (error) {
      console.error('Error updating stock movement barcodes:', error);
      return undefined;
    }
  }

  // Barcode methods - using database  
  async createBarcode(barcode: InsertBarcode): Promise<Barcode> {
    try {
      await this.initializeDatabase();
      const result = await this.db.insert(barcodes)
        .values(barcode)
        .returning();
      return result[0];
    } catch (error) {
      console.error('Error creating barcode:', error);
      throw error;
    }
  }

  async getBarcodesByStockMovement(stockMovementId: string): Promise<Barcode[]> {
    try {
      await this.initializeDatabase();
      const result = await this.db.select().from(barcodes)
        .where(eq(barcodes.stockMovementId, stockMovementId));
      return result;
    } catch (error) {
      console.error('Error getting barcodes by stock movement:', error);
      return [];
    }
  }

  // Customer methods - using database
  async getAllCustomers(): Promise<Customer[]> {
    try {
      await this.initializeDatabase();
      const result = await this.db.select().from(customers);
      return result;
    } catch (error) {
      console.error('Error getting all customers:', error);
      return [];
    }
  }

  async getCustomer(id: string): Promise<Customer | undefined> {
    try {
      await this.initializeDatabase();
      const result = await this.db.select().from(customers).where(eq(customers.id, id));
      return result[0];
    } catch (error) {
      console.error('Error getting customer:', error);
      return undefined;
    }
  }

  async getCustomerByCode(code: string): Promise<Customer | undefined> {
    try {
      await this.initializeDatabase();
      const result = await this.db.select().from(customers).where(eq(customers.code, code));
      return result[0];
    } catch (error) {
      console.error('Error getting customer by code:', error);
      return undefined;
    }
  }

  async createCustomer(insertCustomer: InsertCustomer): Promise<Customer> {
    try {
      // If code is empty or auto-generate is requested, generate a new code
      let customerCode = insertCustomer.code;
      if (!customerCode || customerCode.trim() === '' || customerCode === 'AUTO_GENERATE') {
        customerCode = await this.generateCustomerCode();
      }
      
      const customerData = {
        ...insertCustomer,
        code: customerCode
      };

      await this.initializeDatabase();
      const result = await this.db.insert(customers)
        .values(customerData)
        .returning();
      return result[0];
    } catch (error) {
      console.error('Error creating customer:', error);
      throw error;
    }
  }

  async updateCustomer(id: string, updateData: UpdateCustomer): Promise<Customer | undefined> {
    try {
      await this.initializeDatabase();
      const result = await this.db.update(customers)
        .set({
          ...updateData,
          updatedAt: new Date()
        })
        .where(eq(customers.id, id))
        .returning();
      return result[0];
    } catch (error) {
      console.error('Error updating customer:', error);
      return undefined;
    }
  }

  async deleteCustomer(id: string): Promise<boolean> {
    try {
      await this.initializeDatabase();
      const result = await this.db.delete(customers).where(eq(customers.id, id)).returning();
      return result.length > 0;
    } catch (error) {
      console.error('Error deleting customer:', error);
      return false;
    }
  }

  async generateCustomerCode(): Promise<string> {
    // Generate unique 6-digit customer code starting from 100000
    let code: string;
    let attempts = 0;
    const maxAttempts = 1000;
    
    do {
      const nextCode = await this.getNextCustomerCode();
      code = nextCode;
      attempts++;
      
      if (attempts > maxAttempts) {
        throw new Error('Unable to generate unique customer code after maximum attempts');
      }
    } while (await this.getCustomerByCode(code));
    
    return code;
  }

  async getNextCustomerCode(): Promise<string> {
    try {
      await this.initializeDatabase();
      // Find the highest existing numeric customer code and return the next one
      const result = await this.db.select({ maxCode: max(customers.code) }).from(customers);
      const maxCode = result[0]?.maxCode;
      
      let highestCode = 99999; // Start just below 100000
      
      if (maxCode && /^\d{6}$/.test(maxCode)) {
        const numericCode = parseInt(maxCode, 10);
        if (!isNaN(numericCode) && numericCode > highestCode) {
          highestCode = numericCode;
        }
      }
      
      // Return next code, ensuring it's always 6 digits and >= 100000
      const nextCode = Math.max(highestCode + 1, 100000);
      return nextCode.toString().padStart(6, '0');
    } catch (error) {
      console.error('Error getting next customer code:', error);
      return '100000';
    }
  }

  // Customer Transaction methods - using database
  async createCustomerTransaction(insertTransaction: InsertCustomerTransaction): Promise<CustomerTransaction> {
    try {
      await this.initializeDatabase();
      const result = await this.db.insert(customerTransactions)
        .values(insertTransaction)
        .returning();
      return result[0];
    } catch (error) {
      console.error('Error creating customer transaction:', error);
      throw error;
    }
  }

  async getCustomerTransactionsByCustomerId(customerId: string): Promise<CustomerTransaction[]> {
    try {
      await this.initializeDatabase();
      const result = await this.db.select().from(customerTransactions)
        .where(eq(customerTransactions.customerId, customerId))
        .orderBy(desc(customerTransactions.date));
      return result;
    } catch (error) {
      console.error('Error getting customer transactions:', error);
      return [];
    }
  }

  async getCustomerBalance(customerId: string): Promise<{ balance: number; totalDebt: number; totalCredit: number }> {
    try {
      const customer = await this.getCustomer(customerId);
      if (!customer) {
        return { balance: 0, totalDebt: 0, totalCredit: 0 };
      }
      
      const transactions = await this.getCustomerTransactionsByCustomerId(customerId);
      
      // Convert decimal strings to numbers for calculation
      const openingBalance = parseFloat(customer.openingBalance);
      let totalDebt = openingBalance > 0 ? openingBalance : 0;
      let totalCredit = openingBalance < 0 ? Math.abs(openingBalance) : 0;
      
      transactions.forEach(transaction => {
        const amount = parseFloat(transaction.amount);
        if (transaction.type === 'sale') {
          totalDebt += amount;
        } else if (transaction.type === 'payment') {
          totalCredit += amount;
        } else if (transaction.type === 'return') {
          totalCredit += amount;
        }
      });
      
      const balance = totalDebt - totalCredit;
      
      return { balance, totalDebt, totalCredit };
    } catch (error) {
      console.error('Error getting customer balance:', error);
      return { balance: 0, totalDebt: 0, totalCredit: 0 };
    }
  }

  async getCustomerStats(): Promise<{
    totalCustomers: number;
    totalDebt: number;
    totalCredit: number;
    topBuyers: Array<{ customer: Customer; totalSales: number }>;
  }> {
    try {
      const allCustomers = await this.getAllCustomers();
      let totalSystemDebt = 0;
      let totalSystemCredit = 0;
      
      const customerSales: Array<{ customer: Customer; totalSales: number }> = [];
      
      for (const customer of allCustomers) {
        const balance = await this.getCustomerBalance(customer.id);
        totalSystemDebt += balance.totalDebt;
        totalSystemCredit += balance.totalCredit;
        
        // Calculate total sales for this customer
        const transactions = await this.getCustomerTransactionsByCustomerId(customer.id);
        const totalSales = transactions
          .filter(t => t.type === 'sale')
          .reduce((sum, t) => sum + parseFloat(t.amount), 0);
        
        customerSales.push({ customer, totalSales });
      }
      
      // Sort by total sales and get top 5
      const topBuyers = customerSales
        .sort((a, b) => b.totalSales - a.totalSales)
        .slice(0, 5);
      
      return {
        totalCustomers: allCustomers.length,
        totalDebt: totalSystemDebt,
        totalCredit: totalSystemCredit,
        topBuyers
      };
    } catch (error) {
      console.error('Error getting customer stats:', error);
      return {
        totalCustomers: 0,
        totalDebt: 0,
        totalCredit: 0,
        topBuyers: []
      };
    }
  }

  // Warehouse methods - keeping JSON file based for now (no DB schema defined)
  private initializeWarehouses() {
    try {
      const __dirname = path.dirname(fileURLToPath(import.meta.url));
      const jsonPath = path.join(__dirname, '../data/warehouses.json');
      const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      this.warehouses = data;
      console.log(`✅ Loaded ${data.length} warehouses from JSON file`);
    } catch (error) {
      console.error('Failed to load warehouses from JSON file:', error);
      this.warehouses = [];
    }
  }
  
  async getWarehouses(): Promise<any[]> {
    return this.warehouses;
  }

  // Label template methods - keeping JSON file based for now (no DB schema defined)
  private initializeLabelTemplates() {
    try {
      const __dirname = path.dirname(fileURLToPath(import.meta.url));
      const jsonPath = path.join(__dirname, '../data/labels.json');
      const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      this.labelTemplates = data;
      console.log(`✅ Loaded ${data.length} label templates from JSON file`);
    } catch (error) {
      console.error('Failed to load label templates from JSON file:', error);
      this.labelTemplates = [];
    }
  }
  
  private saveLabelTemplatesToFile(): boolean {
    try {
      const __dirname = path.dirname(fileURLToPath(import.meta.url));
      const jsonPath = path.join(__dirname, '../data/labels.json');
      fs.writeFileSync(jsonPath, JSON.stringify(this.labelTemplates, null, 2));
      return true;
    } catch (error) {
      console.error('Failed to save label templates to file:', error);
      return false;
    }
  }
  
  async getAllLabelTemplates(): Promise<LabelTemplate[]> {
    return this.labelTemplates;
  }
  
  async getLabelTemplate(id: string): Promise<LabelTemplate | undefined> {
    return this.labelTemplates.find(template => template.id === id);
  }
  
  async createLabelTemplate(template: InsertLabelTemplate): Promise<LabelTemplate> {
    const id = `tpl_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const now = new Date().toISOString();
    const newTemplate: LabelTemplate = {
      ...template,
      id,
      isDefault: template.isDefault || false,
      createdAt: now,
      updatedAt: now
    };
    
    this.labelTemplates.push(newTemplate);
    this.saveLabelTemplatesToFile();
    
    return newTemplate;
  }
  
  async updateLabelTemplate(id: string, updateData: Partial<InsertLabelTemplate>): Promise<LabelTemplate | undefined> {
    const templateIndex = this.labelTemplates.findIndex(template => template.id === id);
    if (templateIndex === -1) return undefined;
    
    const updatedTemplate: LabelTemplate = {
      ...this.labelTemplates[templateIndex],
      ...updateData,
      updatedAt: new Date().toISOString()
    };
    
    this.labelTemplates[templateIndex] = updatedTemplate;
    this.saveLabelTemplatesToFile();
    
    return updatedTemplate;
  }
  
  async deleteLabelTemplate(id: string): Promise<boolean> {
    const templateIndex = this.labelTemplates.findIndex(template => template.id === id);
    if (templateIndex === -1) return false;
    
    // Don't allow deletion of default template
    if (this.labelTemplates[templateIndex].isDefault) {
      return false;
    }
    
    this.labelTemplates.splice(templateIndex, 1);
    this.saveLabelTemplatesToFile();
    
    return true;
  }
  
  async setDefaultLabelTemplate(id: string): Promise<LabelTemplate | undefined> {
    const template = this.labelTemplates.find(template => template.id === id);
    if (!template) return undefined;
    
    // Remove default flag from all templates
    this.labelTemplates.forEach(template => {
      template.isDefault = false;
    });
    
    // Set the specified template as default
    template.isDefault = true;
    template.updatedAt = new Date().toISOString();
    
    this.saveLabelTemplatesToFile();
    
    return template;
  }
  
  async getDefaultLabelTemplate(): Promise<LabelTemplate | undefined> {
    return this.labelTemplates.find(template => template.isDefault === true);
  }
}

// Create and export the storage instance
export const storage = new DatabaseStorage();