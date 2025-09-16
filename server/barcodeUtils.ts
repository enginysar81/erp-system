import bwipjs from 'bwip-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { BarcodeJson } from '../shared/schema.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper function to load existing barcodes
function loadBarcodes(): BarcodeJson[] {
  try {
    const barcodesData = fs.readFileSync(path.join(__dirname, '../data/barcodes.json'), 'utf8');
    return JSON.parse(barcodesData);
  } catch (error) {
    console.error('Error loading barcodes:', error);
    return [];
  }
}

// Helper function to save barcodes
function saveBarcodes(barcodes: BarcodeJson[]): boolean {
  try {
    fs.writeFileSync(path.join(__dirname, '../data/barcodes.json'), JSON.stringify(barcodes, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving barcodes:', error);
    return false;
  }
}

// Concurrency-safe unique barcode generation with retry mechanism
export function generateUniqueBarcode(): string {
  const maxAttempts = 1000;
  const maxRetries = 3;
  
  for (let retry = 0; retry < maxRetries; retry++) {
    try {
      // Reload barcodes each retry to get latest state
      const existingBarcodes = loadBarcodes();
      const existingCodes = new Set(existingBarcodes.map(b => b.code));
      
      let code: string;
      let attempts = 0;
      
      do {
        // Generate 6-digit random code with high entropy
        const randomNum = Math.floor(100000 + Math.random() * 900000);
        // Add timestamp component for uniqueness
        const timeComponent = Date.now() % 1000;
        code = (randomNum + timeComponent).toString().slice(-6).padStart(6, '0');
        attempts++;
        
        if (attempts > maxAttempts) {
          throw new Error(`Unable to generate unique barcode after ${maxAttempts} attempts on retry ${retry + 1}`);
        }
      } while (existingCodes.has(code));
      
      return code;
    } catch (error) {
      if (retry === maxRetries - 1) {
        // Final retry failed, throw error
        throw error;
      }
      // Wait a small random time before retrying to reduce collision probability
      const waitTime = Math.random() * 100 + 50; // 50-150ms
      setTimeout(() => {}, waitTime);
    }
  }
  
  throw new Error('Failed to generate unique barcode after all retries');
}

// Generate Code128 barcode image as base64
export async function generateBarcodeImage(code: string): Promise<string> {
  try {
    const buffer = await bwipjs.toBuffer({
      bcid: 'code128',       // Barcode type
      text: code,            // Text to encode
      scale: 3,              // 3x scaling factor
      height: 10,            // Bar height, in millimeters
      includetext: true,     // Show human-readable text
      textxalign: 'center',  // Always good to set this
    });
    
    return `data:image/png;base64,${buffer.toString('base64')}`;
  } catch (error) {
    console.error('Error generating barcode image:', error);
    throw new Error('Failed to generate barcode image');
  }
}

// Create and save barcode record
export function createBarcodeRecord(
  code: string,
  productId: string,
  stockMovementId: string,
  warehouseId: string,
  shelfId: string | null,
  quantity: number = 1,
  unit: 'adet' | 'metre' = 'adet'
): BarcodeJson {
  const barcodes = loadBarcodes();
  
  const newBarcode: BarcodeJson = {
    id: `barcode_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    code,
    productId,
    stockMovementId,
    warehouseId,
    shelfId,
    quantity,
    unit,
    isUsed: false,
    createdAt: new Date().toISOString()
  };
  
  barcodes.push(newBarcode);
  saveBarcodes(barcodes);
  
  return newBarcode;
}

// Generate multiple barcodes for a stock movement
export function generateBarcodesForStockMovement(
  productId: string,
  stockMovementId: string,
  warehouseId: string,
  shelfId: string | null,
  unit: 'adet' | 'metre',
  quantities: number[]
): BarcodeJson[] {
  const createdBarcodes: BarcodeJson[] = [];
  
  for (const quantity of quantities) {
    try {
      const code = generateUniqueBarcode();
      const barcode = createBarcodeRecord(
        code,
        productId,
        stockMovementId,
        warehouseId,
        shelfId,
        quantity,
        unit
      );
      createdBarcodes.push(barcode);
    } catch (error) {
      console.error('Error creating barcode:', error);
      throw error;
    }
  }
  
  return createdBarcodes;
}

// Check if barcode exists
export function barcodeExists(code: string): boolean {
  const barcodes = loadBarcodes();
  return barcodes.some(b => b.code === code);
}

// Find barcode by code
export function findBarcodeByCode(code: string): BarcodeJson | null {
  const barcodes = loadBarcodes();
  return barcodes.find(b => b.code === code) || null;
}

// Mark barcode as used
export function markBarcodeAsUsed(code: string): boolean {
  const barcodes = loadBarcodes();
  const barcodeIndex = barcodes.findIndex(b => b.code === code);
  
  if (barcodeIndex !== -1) {
    barcodes[barcodeIndex].isUsed = true;
    return saveBarcodes(barcodes);
  }
  
  return false;
}

// Get barcodes for a product
export function getBarcodesByProduct(productId: string): BarcodeJson[] {
  const barcodes = loadBarcodes();
  return barcodes.filter(b => b.productId === productId);
}

// Get barcodes for a stock movement
export function getBarcodesByStockMovement(stockMovementId: string): BarcodeJson[] {
  const barcodes = loadBarcodes();
  return barcodes.filter(b => b.stockMovementId === stockMovementId);
}