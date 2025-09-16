import type { Express } from "express";
import { storage } from "./storage";
import { insertProductSchema, stockMovementJsonSchema, insertCustomerJsonSchema, updateCustomerJsonSchema } from "@shared/schema";
import { z } from "zod";
import { generateBarcodesForStockMovement, generateBarcodeImage, generateUniqueBarcode } from "./barcodeUtils";
import multer from "multer";
import XLSX from "xlsx";
import { parse } from "csv-parse/sync";
import { stringify } from "csv-stringify/sync";
import { getUncachableGitHubClient } from "./github-client.js";
import fs from "fs";

// Configure multer for file uploads
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

export function registerRoutes(app: Express): void {
  // Get all products
  app.get("/api/products", async (req, res) => {
    try {
      const products = await storage.getAllProducts();
      res.json(products);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch products" });
    }
  });

  // Get product names for autocomplete (MUST be before /:id route)
  app.get("/api/products/names", async (req, res) => {
    try {
      const products = await storage.getAllProducts();
      const searchQuery = (req.query.q as string || "").toLowerCase().trim();
      
      let filteredProducts;
      if (searchQuery) {
        // Case-insensitive search by name
        filteredProducts = products.filter(product => 
          product.name.toLowerCase().includes(searchQuery)
        );
      } else {
        // No search query, return first 10 products
        filteredProducts = products.slice(0, 10);
      }
      
      // Return id, name, attributes, and prices for autocomplete
      const result = filteredProducts.map(product => {
        let parsedAttributes = [];
        if (product.attributes && Array.isArray(product.attributes)) {
          parsedAttributes = product.attributes.map(attr => {
            if (typeof attr === 'string') {
              try {
                return JSON.parse(attr);
              } catch (e) {
                console.error('Failed to parse attribute:', attr, e);
                return { name: 'Unknown', value: attr };
              }
            }
            return attr;
          }).filter(attr => attr && attr.name && attr.value);
        }
        
        return {
          id: product.id,
          name: product.name,
          attributes: parsedAttributes,
          buyPrice: product.buyPrice,
          sellPrice: product.sellPrice,
          buyCurrency: product.buyCurrency,
          sellCurrency: product.sellCurrency,
          unit: product.unit,
          status: product.status
        };
      });
      
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch product names" });
    }
  });

  // Get popular products for autocomplete (MUST be before /:id route)
  app.get("/api/products/popular", async (req, res) => {
    try {
      const products = await storage.getAllProducts();
      
      // Get top 5 products by stock level (most popular/used)
      const popularProducts = products
        .filter(product => product.status === 'Aktif') // Only active products
        .sort((a, b) => (b.stock || 0) - (a.stock || 0)) // Sort by stock descending
        .slice(0, 5) // Take top 5
        .map(product => {
          let parsedAttributes = [];
          if (product.attributes && Array.isArray(product.attributes)) {
            parsedAttributes = product.attributes.map(attr => {
              if (typeof attr === 'string') {
                try {
                  return JSON.parse(attr);
                } catch (e) {
                  console.error('Failed to parse attribute:', attr, e);
                  return { name: 'Unknown', value: attr };
                }
              }
              return attr;
            }).filter(attr => attr && attr.name && attr.value);
          }
          
          return {
            name: product.name,
            variants: [{
              id: product.id,
              attributes: parsedAttributes,
              status: product.status,
              sellPrice: product.sellPrice,
              sellCurrency: product.sellCurrency
            }],
            firstId: product.id
          };
        });
      
      res.json(popularProducts);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch popular products" });
    }
  });

  // Get single product (MUST be after specific routes like /names and /popular)
  app.get("/api/products/:id", async (req, res) => {
    try {
      const product = await storage.getProduct(req.params.id);
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }
      res.json(product);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch product" });
    }
  });

  // Helper function to check for duplicate products
  async function checkForDuplicateProduct(productData: any, excludeId?: string) {
    const allProducts = await storage.getAllProducts();
    
    // Check for exact name matches
    const nameMatches = allProducts.filter(p => 
      p.id !== excludeId && 
      p.name.toLowerCase() === productData.name.toLowerCase()
    );
    
    if (nameMatches.length > 0) {
      return {
        isDuplicate: true,
        type: 'name' as const,
        existingProduct: nameMatches[0],
        message: `Bu isimde bir ürün zaten mevcut: ${nameMatches[0].name}`
      };
    }
    
    // Check for identical attributes if product has attributes
    if (productData.attributes && Array.isArray(productData.attributes) && productData.attributes.length > 0) {
      const attributeMatches = allProducts.filter(product => {
        if (product.id === excludeId || !product.attributes || !Array.isArray(product.attributes) || product.attributes.length === 0) {
          return false;
        }
        
        // Compare attributes
        if (product.attributes.length !== productData.attributes.length) {
          return false;
        }
        
        // Sort both arrays by attributeId for comparison - ensure they're objects
        const sortedExisting = [...product.attributes]
          .filter(attr => attr && typeof attr === 'object' && 'attributeId' in attr)
          .sort((a: any, b: any) => a.attributeId.localeCompare(b.attributeId));
        const sortedNew = [...productData.attributes]
          .filter(attr => attr && typeof attr === 'object' && 'attributeId' in attr)
          .sort((a: any, b: any) => a.attributeId.localeCompare(b.attributeId));
        
        if (sortedExisting.length !== sortedNew.length) {
          return false;
        }
        
        return sortedExisting.every((attr: any, index: number) => {
          const newAttr = sortedNew[index];
          return attr.attributeId === newAttr.attributeId && 
                 attr.value?.toLowerCase() === newAttr.value?.toLowerCase();
        });
      });
      
      if (attributeMatches.length > 0) {
        const product = attributeMatches[0];
        const attributesText = product.attributes && Array.isArray(product.attributes) 
          ? product.attributes
              .filter(attr => attr && typeof attr === 'object' && 'name' in attr && 'value' in attr)
              .map((attr: any) => `${attr.name}: ${attr.value}`)
              .join(', ')
          : '';
        return {
          isDuplicate: true,
          type: 'attributes' as const,
          existingProduct: product,
          message: `Aynı özelliklere sahip bir ürün zaten mevcut: ${product.name} (${attributesText})`
        };
      }
    }
    
    return { isDuplicate: false, existingProduct: undefined };
  }

  // Create product
  app.post("/api/products", async (req, res) => {
    try {
      const validatedData = insertProductSchema.parse(req.body);
      
      // Check for duplicates
      const duplicateCheck = await checkForDuplicateProduct(validatedData);
      if (duplicateCheck.isDuplicate && duplicateCheck.existingProduct) {
        return res.status(409).json({ 
          message: duplicateCheck.message,
          type: 'duplicate_product',
          duplicateType: duplicateCheck.type,
          existingProduct: {
            id: duplicateCheck.existingProduct.id,
            name: duplicateCheck.existingProduct.name,
            attributes: duplicateCheck.existingProduct.attributes || []
          }
        });
      }
      
      const product = await storage.createProduct(validatedData);
      res.status(201).json(product);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid product data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create product" });
    }
  });

  // Update product
  app.patch("/api/products/:id", async (req, res) => {
    try {
      const validatedData = insertProductSchema.partial().parse(req.body);
      
      // Check for duplicates, excluding current product ID
      if (validatedData.name || validatedData.attributes) {
        // Get current product to merge data for duplicate checking
        const currentProduct = await storage.getProduct(req.params.id);
        if (!currentProduct) {
          return res.status(404).json({ message: "Product not found" });
        }
        
        // Merge current product data with updates for duplicate check
        const updatedProductData = {
          ...currentProduct,
          ...validatedData
        };
        
        const duplicateCheck = await checkForDuplicateProduct(updatedProductData, req.params.id);
        if (duplicateCheck.isDuplicate && duplicateCheck.existingProduct) {
          return res.status(409).json({ 
            message: duplicateCheck.message,
            type: 'duplicate_product',
            duplicateType: duplicateCheck.type,
            existingProduct: {
              id: duplicateCheck.existingProduct.id,
              name: duplicateCheck.existingProduct.name,
              attributes: duplicateCheck.existingProduct.attributes || []
            }
          });
        }
      }
      
      const product = await storage.updateProduct(req.params.id, validatedData);
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }
      res.json(product);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid product data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update product" });
    }
  });

  // Delete product
  app.delete("/api/products/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteProduct(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Product not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete product" });
    }
  });

  // Moved above to fix routing order

  // Get product statistics
  app.get("/api/products/stats/overview", async (req, res) => {
    try {
      const products = await storage.getAllProducts();
      const totalProducts = products.length;
      const activeProducts = products.filter(p => p.status === "Aktif").length;
      const lowStockProducts = products.filter(p => p.stock <= 5).length;
      const totalValue = products.reduce((sum, p) => sum + parseFloat(p.sellPrice) * p.stock, 0);

      res.json({
        totalProducts,
        activeProducts,
        lowStockProducts,
        totalValue: totalValue.toFixed(2)
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch statistics" });
    }
  });

  // Get all warehouses
  app.get("/api/warehouses", async (req, res) => {
    try {
      const warehouses = await storage.getWarehouses();
      res.json(warehouses);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch warehouses" });
    }
  });

  // Stock Entry with proper Zod validation
  app.post("/api/stock/entry", async (req, res) => {
    try {
      // Define stock entry input schema with proper validation
      const stockEntryInputSchema = z.object({
        productId: z.string().min(1, "Product ID is required"),
        warehouseId: z.string().min(1, "Warehouse ID is required"), 
        shelfId: z.string().optional().nullable(),
        unit: z.enum(["adet", "metre"], { errorMap: () => ({ message: "Unit must be 'adet' or 'metre'" }) }),
        quantity: z.number().positive().optional(),
        meters: z.string().optional(),
        note: z.string().optional()
      });
      
      // Validate request body with Zod
      const validationResult = stockEntryInputSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Validation error", 
          errors: validationResult.error.errors,
          errorCode: "VALIDATION_FAILED"
        });
      }
      
      const { productId, warehouseId, shelfId, quantity, meters, unit, note } = validationResult.data;
      
      // Get and validate product exists
      const product = await storage.getProduct(productId);
      if (!product) {
        return res.status(404).json({ 
          message: "Product not found",
          errorCode: "PRODUCT_NOT_FOUND" 
        });
      }
      
      // Get and validate warehouse exists
      const warehouses = await storage.getWarehouses();
      const warehouse = warehouses.find(w => w.id.toString() === warehouseId);
      if (!warehouse) {
        return res.status(404).json({ 
          message: "Warehouse not found",
          errorCode: "WAREHOUSE_NOT_FOUND" 
        });
      }
      
      // Strengthen shelf requirement validation
      const hasShelfSystem = warehouse.hasShelfSystem === true;
      const hasShelves = warehouse.shelves && Array.isArray(warehouse.shelves) && warehouse.shelves.length > 0;
      const shelfRequired = hasShelfSystem && hasShelves;
      
      if (shelfRequired && (!shelfId || shelfId.trim() === '')) {
        return res.status(400).json({ 
          message: "Shelf selection is required for this warehouse",
          errorCode: "SHELF_REQUIRED" 
        });
      }
      
      // Validate shelf exists if provided
      if (shelfId && hasShelves) {
        const shelfExists = warehouse.shelves.some((shelf: any) => 
          typeof shelf === 'string' ? shelf === shelfId : shelf.id?.toString() === shelfId
        );
        if (!shelfExists) {
          return res.status(400).json({ 
            message: "Selected shelf not found in warehouse",
            errorCode: "SHELF_NOT_FOUND" 
          });
        }
      }
      
      // Prepare quantities for barcode generation with safe JSON parsing
      let quantities: number[] = [];
      let totalQuantity = 0;
      
      if (unit === 'adet') {
        const qty = quantity || 0;
        if (qty <= 0) {
          return res.status(400).json({ 
            message: "Valid quantity is required for unit 'adet'",
            errorCode: "INVALID_QUANTITY" 
          });
        }
        // For 'adet' units, create individual barcodes with quantity 1 each
        // If user enters 10, create 10 barcodes with quantities [1,1,1,1,1,1,1,1,1,1]
        quantities = Array(qty).fill(1);
        totalQuantity = qty;
      } else if (unit === 'metre') {
        let meterLengths: any[] = [];
        
        // Safe JSON parsing with try/catch
        try {
          meterLengths = JSON.parse(meters || '[]');
        } catch (parseError) {
          return res.status(400).json({ 
            message: "Invalid meter lengths format. Must be valid JSON array",
            errorCode: "INVALID_METERS_FORMAT" 
          });
        }
        
        if (!Array.isArray(meterLengths) || meterLengths.length === 0) {
          return res.status(400).json({ 
            message: "At least one meter length is required for unit 'metre'",
            errorCode: "METERS_REQUIRED" 
          });
        }
        
        // Filter and validate meter lengths
        quantities = meterLengths
          .map(length => parseFloat(length))
          .filter(num => !isNaN(num) && num > 0);
        
        if (quantities.length === 0) {
          return res.status(400).json({ 
            message: "Valid meter lengths are required. All values must be positive numbers",
            errorCode: "INVALID_METER_LENGTHS" 
          });
        }
        
        totalQuantity = quantities.reduce((sum, qty) => sum + qty, 0);
      } else {
        return res.status(400).json({ 
          message: "Invalid unit. Must be 'adet' or 'metre'",
          errorCode: "INVALID_UNIT" 
        });
      }
      
      // Create stock movement
      const stockMovement = await storage.createStockMovement({
        productId,
        warehouseId,
        shelfId: shelfId || null,
        type: "Giriş",
        quantity: totalQuantity,
        unit: unit as 'adet' | 'metre',
        note: note || undefined,
        barcodes: [] // Will be filled after barcode generation
      });
      
      // Generate barcodes
      const barcodes = generateBarcodesForStockMovement(
        productId,
        stockMovement.id,
        warehouseId,
        shelfId || null,
        unit as 'adet' | 'metre',
        quantities
      );
      
      // Update stock movement with barcode codes and persist to storage
      const barcodeCodes = barcodes.map(b => b.code);
      const updatedStockMovement = await storage.updateStockMovementBarcodes(stockMovement.id, barcodeCodes);
      if (!updatedStockMovement) {
        return res.status(500).json({ 
          message: "Failed to update stock movement with barcodes",
          errorCode: "BARCODE_UPDATE_FAILED" 
        });
      }
      
      // Update product stock using dedicated method for better consistency
      const updatedProduct = await storage.updateProductStock(productId, totalQuantity);
      if (!updatedProduct) {
        return res.status(500).json({ 
          message: "Failed to update product stock",
          errorCode: "STOCK_UPDATE_FAILED" 
        });
      }
      
      res.status(201).json({
        success: true,
        stockMovement: updatedStockMovement,
        barcodes,
        message: "Stock entry completed successfully"
      });
      
    } catch (error) {
      console.error('Stock entry error:', error);
      res.status(500).json({ message: "Failed to create stock entry" });
    }
  });
  
  // Get barcode image
  app.get("/api/barcode/:code/image", async (req, res) => {
    try {
      const { code } = req.params;
      
      if (!code || code.length !== 6) {
        return res.status(400).json({ message: "Invalid barcode code" });
      }
      
      const imageDataUrl = await generateBarcodeImage(code);
      
      // Extract base64 data and send as PNG
      const base64Data = imageDataUrl.split(',')[1];
      const buffer = Buffer.from(base64Data, 'base64');
      
      res.set({
        'Content-Type': 'image/png',
        'Content-Length': buffer.length,
        'Cache-Control': 'public, max-age=86400' // Cache for 24 hours
      });
      
      res.send(buffer);
      
    } catch (error) {
      console.error('Barcode image generation error:', error);
      res.status(500).json({ message: "Failed to generate barcode image" });
    }
  });
  
  // Generate unique barcode code (for testing/preview)
  app.get("/api/barcode/generate", async (req, res) => {
    try {
      const code = generateUniqueBarcode();
      res.json({ code });
    } catch (error) {
      console.error('Barcode generation error:', error);
      res.status(500).json({ message: "Failed to generate barcode" });
    }
  });

  // Generate barcode labels using templates
  app.post("/api/barcode/print-labels", async (req, res) => {
    try {
      const { barcodes, templateId, productData } = req.body;
      
      // Validate input
      if (!barcodes || !Array.isArray(barcodes) || barcodes.length === 0) {
        return res.status(400).json({ message: "Barcodes array is required" });
      }
      
      if (!templateId) {
        return res.status(400).json({ message: "Template ID is required" });
      }
      
      // Get template
      const template = await storage.getLabelTemplate(templateId);
      if (!template) {
        return res.status(404).json({ message: "Label template not found" });
      }
      
      // Generate labels for each barcode
      const labels = [];
      for (const barcodeCode of barcodes) {
        try {
          // Generate barcode image
          const barcodeImage = await generateBarcodeImage(barcodeCode);
          
          // Create label data
          const labelData = {
            barcode: barcodeCode,
            barcodeImage,
            productName: productData?.name || 'Product',
            features: productData?.attributes?.join(', ') || '',
            price: productData?.sellPrice || '0.00',
            date: new Date().toLocaleDateString('tr-TR'),
            logo: '/img/placeholder-product.svg'
          };
          
          labels.push({
            barcodeCode,
            template,
            data: labelData
          });
        } catch (error) {
          console.error(`Error generating label for barcode ${barcodeCode}:`, error);
        }
      }
      
      res.json({
        success: true,
        labels,
        template,
        count: labels.length
      });
      
    } catch (error) {
      console.error('Label generation error:', error);
      res.status(500).json({ message: "Failed to generate labels" });
    }
  });
  
  // Get stock movements
  app.get("/api/stock/movements", async (req, res) => {
    try {
      const movements = await storage.getStockMovements();
      res.json(movements);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch stock movements" });
    }
  });

  // Get single stock movement
  app.get("/api/stock/movements/:id", async (req, res) => {
    try {
      const movements = await storage.getStockMovements();
      const movement = movements.find(m => m.id === req.params.id);
      
      if (!movement) {
        return res.status(404).json({ message: "Stock movement not found" });
      }
      
      // Enrich with product and warehouse data
      const products = await storage.getAllProducts();
      const warehouses = await storage.getWarehouses();
      
      const product = products.find(p => p.id === movement.productId);
      const warehouse = warehouses.find(w => w.id.toString() === movement.warehouseId);
      
      const enrichedMovement = {
        ...movement,
        productName: product?.name || `Ürün ${movement.productId}`,
        productAttributes: product?.attributes || [],
        warehouseName: warehouse?.name || `Depo ${movement.warehouseId}`
      };
      
      res.json(enrichedMovement);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch stock movement" });
    }
  });

  // Update stock movement
  app.put("/api/stock/movements/:id", async (req, res) => {
    try {
      const { quantity, note } = req.body;
      const movementId = req.params.id;
      
      // Get current stock movements
      const movements = await storage.getStockMovements();
      const movementIndex = movements.findIndex(m => m.id === movementId);
      
      if (movementIndex === -1) {
        return res.status(404).json({ message: "Stock movement not found" });
      }
      
      const currentMovement = movements[movementIndex];
      
      // Validate quantity
      if (quantity <= 0) {
        return res.status(400).json({ message: "Quantity must be positive" });
      }
      
      // Calculate quantity difference for stock update
      const quantityDiff = quantity - currentMovement.quantity;
      
      // Update movement
      movements[movementIndex] = {
        ...currentMovement,
        quantity,
        note: note || currentMovement.note
      };
      
      // Generate new barcodes based on new quantity
      let newBarcodes: string[] = [];
      if (currentMovement.unit === 'adet') {
        // For pieces, generate individual barcodes
        newBarcodes = Array(Math.floor(quantity)).fill(0).map(() => generateUniqueBarcode());
      } else {
        // For meters, generate one barcode per meter (rounded up)
        const barcodeCount = Math.ceil(quantity);
        newBarcodes = Array(barcodeCount).fill(0).map(() => generateUniqueBarcode());
      }
      
      movements[movementIndex].barcodes = newBarcodes;
      
      // Save updated movements
      await storage.saveStockMovements(movements);
      
      // Update product stock if quantity changed
      if (quantityDiff !== 0) {
        await storage.updateProductStock(currentMovement.productId, quantityDiff);
      }
      
      res.json({
        success: true,
        movement: movements[movementIndex],
        barcodes: newBarcodes,
        message: "Stock movement updated successfully"
      });
      
    } catch (error) {
      console.error('Stock movement update error:', error);
      res.status(500).json({ message: "Failed to update stock movement" });
    }
  });

  // Delete stock movement
  app.delete("/api/stock/movements/:id", async (req, res) => {
    try {
      const movementId = req.params.id;
      
      // Get current stock movements
      const movements = await storage.getStockMovements();
      const movementIndex = movements.findIndex(m => m.id === movementId);
      
      if (movementIndex === -1) {
        return res.status(404).json({ message: "Stock movement not found" });
      }
      
      const movement = movements[movementIndex];
      
      // Remove movement from array
      movements.splice(movementIndex, 1);
      
      // Save updated movements
      await storage.saveStockMovements(movements);
      
      // Decrease product stock
      await storage.updateProductStock(movement.productId, -movement.quantity);
      
      res.json({
        success: true,
        message: "Stock movement deleted successfully"
      });
      
    } catch (error) {
      console.error('Stock movement deletion error:', error);
      res.status(500).json({ message: "Failed to delete stock movement" });
    }
  });

  // Export stock movements
  app.get("/api/stock/movements/export", async (req, res) => {
    try {
      const format = req.query.format as string || 'csv';
      const movements = await storage.getStockMovements();
      const products = await storage.getAllProducts();
      const warehouses = await storage.getWarehouses();
      
      // Enrich movements with product and warehouse data
      const enrichedMovements = movements.map(movement => {
        const product = products.find(p => p.id === movement.productId);
        const warehouse = warehouses.find(w => w.id.toString() === movement.warehouseId);
        
        return {
          Date: new Date(movement.date).toLocaleDateString('tr-TR'),
          Time: new Date(movement.date).toLocaleTimeString('tr-TR'),
          'Product Name': product?.name || `Ürün ${movement.productId}`,
          'Product Attributes': product?.attributes?.map((attr: any) => `${attr.name}: ${attr.value}`).join(', ') || '',
          Warehouse: warehouse?.name || `Depo ${movement.warehouseId}`,
          Shelf: movement.shelfId || '-',
          Type: movement.type,
          Quantity: movement.quantity,
          Unit: movement.unit,
          'Barcode Count': movement.barcodes?.length || 0,
          Barcodes: movement.barcodes?.join(', ') || '',
          Note: movement.note || ''
        };
      });
      
      if (format === 'csv') {
        const csvData = stringify(enrichedMovements, { header: true });
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="stock-movements.csv"');
        res.send(csvData);
      } else if (format === 'pdf') {
        // For PDF export, you would need a PDF generation library
        // For now, return JSON with a message
        res.json({
          message: "PDF export not implemented yet",
          data: enrichedMovements
        });
      } else {
        res.status(400).json({ message: "Unsupported format. Use 'csv' or 'pdf'" });
      }
      
    } catch (error) {
      console.error('Export error:', error);
      res.status(500).json({ message: "Failed to export stock movements" });
    }
  });

  // ========== LABEL DESIGNER ROUTES ==========
  
  // Get all label templates
  app.get("/api/labels", async (req, res) => {
    try {
      const templates = await storage.getAllLabelTemplates();
      res.json(templates);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch label templates" });
    }
  });

  // Get single label template
  app.get("/api/labels/:id", async (req, res) => {
    try {
      const template = await storage.getLabelTemplate(req.params.id);
      if (!template) {
        return res.status(404).json({ message: "Label template not found" });
      }
      res.json(template);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch label template" });
    }
  });

  // Create new label template
  app.post("/api/labels", async (req, res) => {
    try {
      const templateData = req.body;
      
      // Basic validation
      if (!templateData.name || !templateData.width || !templateData.height) {
        return res.status(400).json({ message: "Name, width and height are required" });
      }
      
      const template = await storage.createLabelTemplate(templateData);
      res.status(201).json(template);
    } catch (error) {
      console.error('Label template creation error:', error);
      res.status(500).json({ message: "Failed to create label template" });
    }
  });

  // Update label template
  app.put("/api/labels/:id", async (req, res) => {
    try {
      const templateData = req.body;
      const updated = await storage.updateLabelTemplate(req.params.id, templateData);
      
      if (!updated) {
        return res.status(404).json({ message: "Label template not found" });
      }
      
      res.json(updated);
    } catch (error) {
      console.error('Label template update error:', error);
      res.status(500).json({ message: "Failed to update label template" });
    }
  });

  // Delete label template
  app.delete("/api/labels/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteLabelTemplate(req.params.id);
      
      if (!deleted) {
        return res.status(404).json({ message: "Label template not found" });
      }
      
      res.json({ message: "Label template deleted successfully" });
    } catch (error) {
      console.error('Label template deletion error:', error);
      res.status(500).json({ message: "Failed to delete label template" });
    }
  });

  // Set default label template
  app.post("/api/labels/:id/default", async (req, res) => {
    try {
      const result = await storage.setDefaultLabelTemplate(req.params.id);
      
      if (!result) {
        return res.status(404).json({ message: "Label template not found" });
      }
      
      res.json({ message: "Default template set successfully", template: result });
    } catch (error) {
      console.error('Set default template error:', error);
      res.status(500).json({ message: "Failed to set default template" });
    }
  });

  // Get default label template
  app.get("/api/labels/default/template", async (req, res) => {
    try {
      const template = await storage.getDefaultLabelTemplate();
      
      if (!template) {
        return res.status(404).json({ message: "No default template found" });
      }
      
      res.json(template);
    } catch (error) {
      console.error('Get default template error:', error);
      res.status(500).json({ message: "Failed to get default template" });
    }
  });

  // ===========================
  // IMPORT/EXPORT ENDPOINTS
  // ===========================
  
  // Helper function to validate product data
  const validateProductRow = (row: any, rowIndex: number, allProducts: any[]) => {
    const errors: string[] = [];
    
    // Convert and clean product name (handle numeric values from Excel)
    const productName = row['Ürün Adı'] ? row['Ürün Adı'].toString().trim() : '';
    
    // Required fields
    if (!productName) {
      errors.push('Ürün Adı zorunludur');
    }
    
    if (!row['Birim']?.toString().trim()) {
      errors.push('Birim zorunludur');
    } else if (!['adet', 'metre'].includes(row['Birim'].toString().toLowerCase())) {
      errors.push('Birim sadece "adet" veya "metre" olabilir');
    }
    
    // Currency validation
    const validCurrencies = ['USD', 'PLN', 'UAH'];
    if (row['Alış Para Birimi'] && !validCurrencies.includes(row['Alış Para Birimi'])) {
      errors.push('Alış Para Birimi sadece USD/PLN/UAH olabilir');
    }
    if (row['Satış Para Birimi'] && !validCurrencies.includes(row['Satış Para Birimi'])) {
      errors.push('Satış Para Birimi sadece USD/PLN/UAH olabilir');
    }
    
    // Status validation
    if (row['Durum'] && !['Aktif', 'Pasif'].includes(row['Durum'])) {
      errors.push('Durum sadece "Aktif" veya "Pasif" olabilir');
    }
    
    // Price validation
    if (row['Alış Fiyatı'] && (isNaN(parseFloat(row['Alış Fiyatı'])) || parseFloat(row['Alış Fiyatı']) < 0)) {
      errors.push('Alış Fiyatı geçerli bir pozitif sayı olmalıdır');
    }
    if (row['Satış Fiyatı'] && (isNaN(parseFloat(row['Satış Fiyatı'])) || parseFloat(row['Satış Fiyatı']) < 0)) {
      errors.push('Satış Fiyatı geçerli bir pozitif sayı olmalıdır');
    }
    
    // Duplicate check (same name + same attributes)
    if (productName) {
      const existingProduct = allProducts.find(p => 
        p.name.toLowerCase() === productName.toLowerCase()
      );
      if (existingProduct) {
        errors.push('Bu ürün adı zaten mevcut');
      }
    }
    
    return {
      row,
      rowIndex: rowIndex + 2, // +2 for Excel row numbering (1-based + header)
      isValid: errors.length === 0,
      errors
    };
  };
  
  // Download intelligent template file with system options
  app.get("/api/import-export/template", async (req, res) => {
    try {
      const format = req.query.format as string || 'xlsx';
      
      // Get existing products to extract unique system options
      const products = await storage.getAllProducts();
      
      // Extract unique values from existing products
      const colorSet = new Set<string>();
      const groundSet = new Set<string>();
      const yarnSet = new Set<string>();
      const currencySet = new Set<string>();
      const unitSet = new Set<string>();
      const statusSet = new Set<string>();
      
      products.forEach(p => {
        if (p.attributes && Array.isArray(p.attributes)) {
          p.attributes.forEach((attr: any) => {
            if (attr.name === 'Renk' && attr.value) colorSet.add(attr.value);
            if (attr.name === 'Zemin' && attr.value) groundSet.add(attr.value);
            if (attr.name === 'İPLİK' && attr.value) yarnSet.add(attr.value);
          });
        }
        if (p.buyCurrency) currencySet.add(p.buyCurrency);
        if (p.sellCurrency) currencySet.add(p.sellCurrency);
        if (p.unit) unitSet.add(p.unit);
        if (p.status) statusSet.add(p.status);
      });
      
      const uniqueColors = Array.from(colorSet);
      const uniqueGrounds = Array.from(groundSet);
      const uniqueYarns = Array.from(yarnSet);
      const uniqueCurrencies = Array.from(currencySet);
      const uniqueUnits = Array.from(unitSet);
      const uniqueStatuses = Array.from(statusSet);

      const headers = [
        'Ürün Adı',
        'Açıklama',
        'Birim',
        'Alış Fiyatı',
        'Satış Fiyatı',
        'Alış Para Birimi',
        'Satış Para Birimi',
        'Durum',
        'Renk',
        'Zemin', 
        'İPLİK'
      ];
      
      if (format === 'csv') {
        let csvContent = headers.join(',') + '\n';
        csvContent += '# ========== SİSTEMDEKİ MEVCUT SEÇENEKLER ==========\n';
        csvContent += '# RENKLER: ' + uniqueColors.join(' | ') + '\n';
        csvContent += '# ZEMİN: ' + uniqueGrounds.join(' | ') + '\n';
        csvContent += '# İPLİK: ' + uniqueYarns.join(' | ') + '\n';
        csvContent += '# PARA BİRİMİ: ' + uniqueCurrencies.join(' | ') + '\n';
        csvContent += '# BİRİM: ' + uniqueUnits.join(' | ') + '\n';
        csvContent += '# DURUM: ' + uniqueStatuses.join(' | ') + '\n';
        csvContent += '# ================================================\n';
        csvContent += '# Örnek satır (silebilirsiniz):\n';
        csvContent += `Örnek Ürün,Ürün açıklaması,${uniqueUnits[0] || 'adet'},10.50,15.75,${uniqueCurrencies[0] || 'USD'},${uniqueCurrencies[0] || 'USD'},${uniqueStatuses[0] || 'Aktif'},${uniqueColors[0] || ''},${uniqueGrounds[0] || ''},${uniqueYarns[0] || ''}\n`;
        
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="akilli_urun_sablonu_${new Date().toISOString().split('T')[0]}.csv"`);
        res.send('\uFEFF' + csvContent); // BOM for Turkish characters
      } else {
        // Excel format with multiple sheets
        const workbook = XLSX.utils.book_new();
        
        // Main products sheet
        const mainData = [
          headers,
          [
            'Örnek Ürün (bu satırı silebilirsiniz)',
            'Ürün açıklaması',
            uniqueUnits[0] || 'adet',
            '10.50',
            '15.75',
            uniqueCurrencies[0] || 'USD',
            uniqueCurrencies[0] || 'USD',
            uniqueStatuses[0] || 'Aktif',
            uniqueColors[0] || '',
            uniqueGrounds[0] || '',
            uniqueYarns[0] || ''
          ]
        ];
        
        const worksheet = XLSX.utils.aoa_to_sheet(mainData);
        
        // Style headers
        const headerStyle = {
          font: { bold: true, color: { rgb: "FFFFFF" } },
          fill: { fgColor: { rgb: "366092" } },
          alignment: { horizontal: "center" }
        };
        
        // Apply header styles
        for (let i = 0; i < headers.length; i++) {
          const cellRef = XLSX.utils.encode_cell({ r: 0, c: i });
          if (!worksheet[cellRef]) worksheet[cellRef] = {};
          worksheet[cellRef].s = headerStyle;
        }
        
        // Set column widths
        worksheet['!cols'] = [
          { width: 25 }, { width: 30 }, { width: 12 }, { width: 15 },
          { width: 15 }, { width: 18 }, { width: 18 }, { width: 12 },
          { width: 15 }, { width: 15 }, { width: 20 }
        ];
        
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Ürünler');
        
        // Options sheet with system data
        const optionsData = [
          ['SİSTEMDEKİ MEVCUT SEÇENEKLER'],
          [''],
          ['RENKLER:', ...uniqueColors],
          ['ZEMİN:', ...uniqueGrounds],
          ['İPLİK:', ...uniqueYarns],
          ['PARA BİRİMİ:', ...uniqueCurrencies],
          ['BİRİM:', ...uniqueUnits],
          ['DURUM:', ...uniqueStatuses],
          [''],
          ['NOT: Yeni değerler eklemek istiyorsanız doğrudan yazabilirsiniz.'],
          ['Sistem otomatik olarak yeni seçenekleri tanıyacaktır.']
        ];
        
        const optionsSheet = XLSX.utils.aoa_to_sheet(optionsData);
        XLSX.utils.book_append_sheet(workbook, optionsSheet, 'Sistem Seçenekleri');
        
        // Instructions sheet
        const instructionsData = [
          ['KULLANIM TALİMATLARI'],
          [''],
          ['1. "Ürünler" sekmesinde ürünlerinizi listeleyin'],
          ['2. "Sistem Seçenekleri" sekmesinde mevcut seçenekleri görün'],
          ['3. Yeni renk/zemin/iplik değerleri ekleyebilirsiniz'],
          ['4. Örnek satırı silebilirsiniz'],
          ['5. Dosyayı kaydedip import sayfasından yükleyin'],
          [''],
          ['ZORUNLU ALANLAR:'],
          ['- Ürün Adı'],
          ['- Alış Fiyatı'],
          ['- Satış Fiyatı'],
          ['- Birim'],
          [''],
          ['İSTEĞE BAĞLI ALANLAR:'],
          ['- Açıklama'],
          ['- Renk, Zemin, İplik (özellikler)'],
          [''],
          ['DİKKAT: Aynı isimde ürün varsa güncelleme modu seçilmelidir!']
        ];
        
        const instructionsSheet = XLSX.utils.aoa_to_sheet(instructionsData);
        XLSX.utils.book_append_sheet(workbook, instructionsSheet, 'Talimatlar');
        
        const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
        
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="akilli_urun_sablonu_${new Date().toISOString().split('T')[0]}.xlsx"`);
        res.send(buffer);
      }
    } catch (error) {
      console.error('Smart template download error:', error);
      res.status(500).json({ message: "Akıllı şablon indirme hatası" });
    }
  });
  
  // Get system options for smart previews
  app.get("/api/import-export/system-options", async (req, res) => {
    try {
      const products = await storage.getAllProducts();
      
      // Extract unique values from existing products
      const colorSet = new Set<string>();
      const groundSet = new Set<string>();
      const yarnSet = new Set<string>();
      const currencySet = new Set<string>();
      const unitSet = new Set<string>();
      const statusSet = new Set<string>();
      
      products.forEach(p => {
        if (p.attributes && Array.isArray(p.attributes)) {
          p.attributes.forEach((attr: any) => {
            if (attr.name === 'Renk' && attr.value) colorSet.add(attr.value);
            if (attr.name === 'Zemin' && attr.value) groundSet.add(attr.value);
            if (attr.name === 'İPLİK' && attr.value) yarnSet.add(attr.value);
          });
        }
        if (p.buyCurrency) currencySet.add(p.buyCurrency);
        if (p.sellCurrency) currencySet.add(p.sellCurrency);
        if (p.unit) unitSet.add(p.unit);
        if (p.status) statusSet.add(p.status);
      });
      
      const uniqueColors = Array.from(colorSet);
      const uniqueGrounds = Array.from(groundSet);
      const uniqueYarns = Array.from(yarnSet);
      const uniqueCurrencies = Array.from(currencySet);
      const uniqueUnits = Array.from(unitSet);
      const uniqueStatuses = Array.from(statusSet);
      
      res.json({
        colors: uniqueColors,
        grounds: uniqueGrounds,
        yarns: uniqueYarns,
        currencies: uniqueCurrencies,
        units: uniqueUnits,
        statuses: uniqueStatuses
      });
    } catch (error) {
      console.error('System options fetch error:', error);
      res.status(500).json({ message: "Sistem seçenekleri alınamadı" });
    }
  });
  
  // Export products
  app.post("/api/import-export/export", async (req, res) => {
    try {
      const { format = 'xlsx', filteredProductIds } = req.body;
      let products = await storage.getAllProducts();
      
      // Apply filter if provided
      if (filteredProductIds && Array.isArray(filteredProductIds)) {
        products = products.filter(p => filteredProductIds.includes(p.id));
      }
      
      // Prepare export data
      const exportData = [
        [
          'Ürün Adı',
          'Açıklama',
          'Birim',
          'Alış Fiyatı',
          'Satış Fiyatı',
          'Alış Para Birimi',
          'Satış Para Birimi',
          'Durum',
          'Özellik1',
          'Özellik2',
          'Özellik3'
        ]
      ];
      
      products.forEach(product => {
        const attributes = (product as any).attributes || [];
        const attributesArray = Array.isArray(attributes) ? attributes : [];
        exportData.push([
          product.name,
          product.description || '',
          product.unit,
          product.buyPrice?.toString() || '',
          product.sellPrice?.toString() || '',
          product.buyCurrency || '',
          product.sellCurrency || '',
          product.status || 'Aktif',
          attributesArray[0]?.value || '',
          attributesArray[1]?.value || '',
          attributesArray[2]?.value || ''
        ]);
      });
      
      const timestamp = new Date().toISOString().split('T')[0];
      
      if (format === 'csv') {
        const csv = stringify(exportData);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="urunler_${timestamp}.csv"`);
        res.send(csv);
      } else {
        const workbook = XLSX.utils.book_new();
        const worksheet = XLSX.utils.aoa_to_sheet(exportData);
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Ürünler');
        
        const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
        
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="urunler_${timestamp}.xlsx"`);
        res.send(buffer);
      }
    } catch (error) {
      console.error('Export error:', error);
      res.status(500).json({ message: "Dışarı aktarma hatası" });
    }
  });
  
  // Preview imported file
  app.post("/api/import-export/preview", upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "Dosya bulunamadı" });
      }
      
      const allProducts = await storage.getAllProducts();
      let data: any[] = [];
      
      // Parse file based on type
      if (req.file.mimetype.includes('csv')) {
        // Handle UTF-8 BOM and encoding properly
        let csvText = req.file.buffer.toString('utf-8');
        // Remove BOM if present
        if (csvText.charCodeAt(0) === 0xFEFF) {
          csvText = csvText.slice(1);
        }
        data = parse(csvText, { 
          columns: true, 
          skip_empty_lines: true,
          trim: true,
          bom: true // Handle BOM automatically
        });
      } else {
        const workbook = XLSX.read(req.file.buffer);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        data = XLSX.utils.sheet_to_json(worksheet);
      }
      
      // Validate each row
      const validatedRows = data.map((row, index) => 
        validateProductRow(row, index, allProducts)
      );
      
      const validRows = validatedRows.filter(r => r.isValid);
      const invalidRows = validatedRows.filter(r => !r.isValid);
      
      // Prepare Excel-like preview data for frontend
      const previewData = data.map(row => ({
        'Ürün Adı': row['Ürün Adı'] || '',
        'Açıklama': row['Açıklama'] || '',
        'Birim': row['Birim'] || '',
        'Alış Fiyatı': row['Alış Fiyatı'] || '',
        'Satış Fiyatı': row['Satış Fiyatı'] || '',
        'Alış Para Birimi': row['Alış Para Birimi'] || '',
        'Satış Para Birimi': row['Satış Para Birimi'] || '',
        'Durum': row['Durum'] || '',
        'Renk': row['Renk'] || '',
        'Zemin': row['Zemin'] || '',
        'İPLİK': row['İPLİK'] || ''
      }));

      res.json({
        totalRows: data.length,
        validRows: validRows.length,
        invalidRows: invalidRows.length,
        previewData: previewData, // Excel-like data for smart preview
        preview: validatedRows.slice(0, 10), // Legacy preview for backward compatibility
        errors: invalidRows.map(r => ({
          rowNumber: r.rowIndex,
          errors: r.errors,
          data: r.row
        }))
      });
      
    } catch (error) {
      console.error('Preview error:', error);
      res.status(500).json({ message: "Dosya işleme hatası" });
    }
  });
  
  // Import validated data
  app.post("/api/import-export/import", upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "Dosya bulunamadı" });
      }
      
      const { updateExisting = false } = req.body;
      const allProducts = await storage.getAllProducts();
      let data: any[] = [];
      
      // Parse file  
      if (req.file.mimetype.includes('csv')) {
        // Handle UTF-8 BOM and encoding properly
        let csvText = req.file.buffer.toString('utf-8');
        // Remove BOM if present
        if (csvText.charCodeAt(0) === 0xFEFF) {
          csvText = csvText.slice(1);
        }
        data = parse(csvText, { 
          columns: true, 
          skip_empty_lines: true,
          trim: true,
          bom: true // Handle BOM automatically
        });
      } else {
        const workbook = XLSX.read(req.file.buffer);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        data = XLSX.utils.sheet_to_json(worksheet);
      }
      
      // Validate and process only valid rows
      const validatedRows = data.map((row, index) => 
        validateProductRow(row, index, allProducts)
      );
      
      const validRows = validatedRows.filter(r => r.isValid);
      const invalidRows = validatedRows.filter(r => !r.isValid);
      
      let successCount = 0;
      
      // Process valid rows
      for (const validRow of validRows) {
        try {
          const row = validRow.row;
          
          // Find existing product for update
          const productName = row['Ürün Adı'] ? row['Ürün Adı'].toString().trim() : '';
          const existingProduct = productName ? allProducts.find(p => 
            p.name.toLowerCase() === productName.toLowerCase()
          ) : null;
          
          if (existingProduct && updateExisting) {
            // Update existing product
            const updateData = {
              description: row['Açıklama']?.toString() || existingProduct.description,
              buyPrice: row['Alış Fiyatı'] ? parseFloat(row['Alış Fiyatı']).toString() : existingProduct.buyPrice,
              sellPrice: row['Satış Fiyatı'] ? parseFloat(row['Satış Fiyatı']).toString() : existingProduct.sellPrice,
              buyCurrency: row['Alış Para Birimi'] || existingProduct.buyCurrency,
              sellCurrency: row['Satış Para Birimi'] || existingProduct.sellCurrency,
              status: row['Durum'] || existingProduct.status,
              unit: row['Birim'] || existingProduct.unit
            };
            
            await storage.updateProduct(existingProduct.id, updateData);
            successCount++;
          } else if (!existingProduct) {
            // Create new product
            const productData = {
              name: productName,
              description: row['Açıklama'] ? row['Açıklama'].toString().trim() : null,
              unit: (row['Birim'] || 'adet').toString().toLowerCase(),
              buyPrice: row['Alış Fiyatı'] ? parseFloat(row['Alış Fiyatı']).toString() : '0',
              sellPrice: row['Satış Fiyatı'] ? parseFloat(row['Satış Fiyatı']).toString() : '0',
              buyCurrency: row['Alış Para Birimi'] || 'USD',
              sellCurrency: row['Satış Para Birimi'] || 'USD',
              status: row['Durum'] || 'Aktif',
              stock: 0,
              attributes: [] // TODO: Handle attributes if needed
            };
            
            await storage.createProduct(productData);
            successCount++;
          }
        } catch (error) {
          console.error('Product creation/update error:', error);
        }
      }
      
      res.json({
        success: true,
        totalProcessed: data.length,
        successCount,
        failedCount: invalidRows.length,
        errors: invalidRows.map(r => ({
          rowNumber: r.rowIndex,
          errors: r.errors,
          data: r.row
        }))
      });
      
    } catch (error) {
      console.error('🚨 IMPORT ERROR DETAILS:', error);
      console.error('🚨 Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      console.error('🚨 Error message:', error instanceof Error ? error.message : 'Unknown error');
      res.status(500).json({ 
        message: "İçeri aktarma hatası", 
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
        details: process.env.NODE_ENV === 'development' ? error : undefined
      });
    }
  });

  // Import from grid data
  app.post("/api/import-export/import-from-grid", async (req, res) => {
    try {
      const { products = [], updateExisting = false } = req.body;
      
      if (!Array.isArray(products) || products.length === 0) {
        return res.status(400).json({ message: "Geçerli ürün listesi bulunamadı" });
      }
      
      const allProducts = await storage.getAllProducts();
      let successCount = 0;
      const errors: Array<{ rowNumber: number; errors: string[]; data: any }> = [];
      
      // Process each product from grid
      for (let index = 0; index < products.length; index++) {
        try {
          const product = products[index];
          
          // Validate required fields
          if (!product.name || product.name.trim() === '') {
            errors.push({
              rowNumber: index + 1,
              errors: ['Ürün adı gerekli'],
              data: product
            });
            continue;
          }
          
          // Find existing product for update
          const existingProduct = allProducts.find(p => 
            p.name.toLowerCase() === product.name.toString().toLowerCase().trim()
          );
          
          if (existingProduct && updateExisting) {
            // Update existing product
            const updateData = {
              description: product.description || existingProduct.description,
              buyPrice: product.buyPrice || existingProduct.buyPrice,
              sellPrice: product.sellPrice || existingProduct.sellPrice,
              buyCurrency: product.buyCurrency || existingProduct.buyCurrency,
              sellCurrency: product.sellCurrency || existingProduct.sellCurrency,
              status: product.status || existingProduct.status,
              unit: product.unit || existingProduct.unit,
              stock: product.stock !== undefined ? parseInt(product.stock) : existingProduct.stock
            };
            
            await storage.updateProduct(existingProduct.id, updateData);
            successCount++;
          } else if (!existingProduct) {
            // Create new product
            const productData = {
              name: product.name.toString().trim(),
              description: product.description || null,
              unit: product.unit || 'adet',
              buyPrice: product.buyPrice || '0',
              sellPrice: product.sellPrice || '0',
              buyCurrency: product.buyCurrency || 'USD',
              sellCurrency: product.sellCurrency || 'USD',
              currency: product.currency || 'USD',
              status: product.status || 'Aktif',
              stock: product.stock ? parseInt(product.stock) : 0,
              images: product.images || [],
              attributes: product.attributes || []
            };
            
            await storage.createProduct(productData);
            successCount++;
          } else {
            // Product exists but update not allowed
            errors.push({
              rowNumber: index + 1,
              errors: ['Ürün zaten mevcut ve güncelleme izni verilmemiş'],
              data: product
            });
          }
        } catch (error) {
          console.error('Grid product creation/update error:', error);
          errors.push({
            rowNumber: index + 1,
            errors: ['İşlem sırasında hata oluştu'],
            data: products[index]
          });
        }
      }
      
      res.json({
        success: true,
        totalProcessed: products.length,
        successCount,
        failedCount: errors.length,
        errors
      });
      
    } catch (error) {
      console.error('Grid import error:', error);
      res.status(500).json({ message: "Grid içeri aktarma hatası" });
    }
  });

  // GitHub backup endpoint
  app.post("/api/github/backup", async (req, res) => {
    try {
      console.log('🔄 GitHub backup started...');
      
      const octokit = await getUncachableGitHubClient();
      const repoName = 'erp-system';
      
      // Get user info
      const { data: user } = await octokit.rest.users.getAuthenticated();
      console.log(`🔗 Connected to GitHub: ${user.login}`);
      
      // Files to sync - TÜM PROJE DOSYALARI
      const filesToSync = [
        // Root level dosyaları
        'package.json',
        'package-lock.json',
        'vite.config.ts',
        'tsconfig.json',
        'tailwind.config.ts',
        'postcss.config.js',
        'drizzle.config.ts',
        'components.json',
        'replit.md',
        'migrate-json-to-db.ts',
        'update_products.js',
        'generated-icon.png',
        
        // Server klasörü - TÜM DOSYALAR
        'server/index.ts',
        'server/routes.ts',
        'server/storage.ts',
        'server/github-client.js',
        'server/barcodeUtils.ts',
        
        // Shared klasörü
        'shared/schema.ts',
        
        // Views klasörü - TÜM EJS DOSYALARI
        'views/dashboard.ejs',
        'views/layout.ejs',
        'views/products.ejs',
        'views/customers.ejs',
        'views/warehouses.ejs',
        'views/stock_movements.ejs',
        'views/import_export.ejs',
        'views/product_form.ejs',
        'views/customer-form.ejs',
        'views/warehouse_form.ejs',
        'views/warehouse_detail.ejs',
        'views/stock_in.ejs',
        'views/stock_by_warehouse.ejs',
        'views/attributes.ejs',
        'views/attribute_edit.ejs',
        'views/labelDesigner.ejs',
        
        // Client klasörü - TÜM FRONTEND DOSYALARI
        'client/index.html',
        'client/src/App.tsx',
        'client/src/main.tsx',
        'client/src/index.css',
        'client/src/pages/home.tsx',
        'client/src/pages/not-found.tsx',
        'client/src/pages/import-export.tsx',
        'client/src/pages/products-grid.tsx',
        'client/src/lib/queryClient.ts',
        'client/src/lib/utils.ts',
        'client/src/hooks/use-toast.ts',
        'client/src/hooks/use-mobile.tsx',
        'client/src/components/GridEditor.tsx',
        
        // Client UI Components - TÜM ShadCN COMPONENTS
        'client/src/components/ui/accordion.tsx',
        'client/src/components/ui/alert-dialog.tsx',
        'client/src/components/ui/alert.tsx',
        'client/src/components/ui/aspect-ratio.tsx',
        'client/src/components/ui/avatar.tsx',
        'client/src/components/ui/badge.tsx',
        'client/src/components/ui/breadcrumb.tsx',
        'client/src/components/ui/button.tsx',
        'client/src/components/ui/calendar.tsx',
        'client/src/components/ui/card.tsx',
        'client/src/components/ui/carousel.tsx',
        'client/src/components/ui/chart.tsx',
        'client/src/components/ui/checkbox.tsx',
        'client/src/components/ui/collapsible.tsx',
        'client/src/components/ui/command.tsx',
        'client/src/components/ui/context-menu.tsx',
        'client/src/components/ui/dialog.tsx',
        'client/src/components/ui/drawer.tsx',
        'client/src/components/ui/dropdown-menu.tsx',
        'client/src/components/ui/form.tsx',
        'client/src/components/ui/hover-card.tsx',
        'client/src/components/ui/input-otp.tsx',
        'client/src/components/ui/input.tsx',
        'client/src/components/ui/label.tsx',
        'client/src/components/ui/menubar.tsx',
        'client/src/components/ui/navigation-menu.tsx',
        'client/src/components/ui/pagination.tsx',
        'client/src/components/ui/popover.tsx',
        'client/src/components/ui/progress.tsx',
        'client/src/components/ui/radio-group.tsx',
        'client/src/components/ui/resizable.tsx',
        'client/src/components/ui/scroll-area.tsx',
        'client/src/components/ui/select.tsx',
        'client/src/components/ui/separator.tsx',
        'client/src/components/ui/sheet.tsx',
        'client/src/components/ui/sidebar.tsx',
        'client/src/components/ui/skeleton.tsx',
        'client/src/components/ui/slider.tsx',
        'client/src/components/ui/switch.tsx',
        'client/src/components/ui/table.tsx',
        'client/src/components/ui/tabs.tsx',
        'client/src/components/ui/textarea.tsx',
        'client/src/components/ui/toast.tsx',
        'client/src/components/ui/toaster.tsx',
        'client/src/components/ui/toggle-group.tsx',
        'client/src/components/ui/toggle.tsx',
        'client/src/components/ui/tooltip.tsx',
        
        // Data klasörü - TÜM JSON DOSYALARI
        'data/attributes.json',
        'data/barcodes.json',
        'data/customer-transactions.json',
        'data/customers.json',
        'data/labels.json',
        'data/products.json',
        'data/stockMovements.json',
        'data/warehouses.json',
        
        // Locales klasörü - TÜM DİL DOSYALARI
        'locales/tr.json',
        'locales/pl.json',
        'locales/ua.json',
        
        // Public klasörü - TÜM STATIC DOSYALAR
        'public/css/style.css',
        'public/js/main.js',
        'public/js/labelDesigner.js',
        'public/js/stockByWarehouse.js',
        'public/img/placeholder-product.svg'
      ];
      
      let syncCount = 0;
      let errorCount = 0;
      const errors: string[] = [];
      
      for (const filePath of filesToSync) {
        try {
          if (fs.existsSync(filePath)) {
            const content = fs.readFileSync(filePath, 'utf8');
            
            // Check if file exists on GitHub
            let sha = null;
            try {
              const { data: existingFile } = await octokit.rest.repos.getContent({
                owner: user.login,
                repo: repoName,
                path: filePath,
              });
              sha = (existingFile as any).sha;
            } catch (e) {
              // File doesn't exist, will create new
            }
            
            const requestData: any = {
              owner: user.login,
              repo: repoName,
              path: filePath,
              message: sha ? `Update ${filePath}` : `Add ${filePath}`,
              content: Buffer.from(content).toString('base64'),
            };
            
            if (sha) {
              requestData.sha = sha;
            }
            
            await octokit.rest.repos.createOrUpdateFileContents(requestData);
            console.log(`✅ ${filePath}`);
            syncCount++;
            
          } else {
            console.log(`⚠️ ${filePath} not found`);
          }
        } catch (error: any) {
          console.log(`❌ ${filePath} - Error: ${error.message}`);
          errors.push(`${filePath}: ${error.message}`);
          errorCount++;
        }
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      console.log(`📊 Backup Summary:`);
      console.log(`✅ Success: ${syncCount} files`);
      console.log(`❌ Errors: ${errorCount} files`);
      console.log(`🚀 GitHub Repository: https://github.com/${user.login}/${repoName}`);
      
      res.json({
        success: true,
        syncCount,
        errorCount,
        errors,
        repository: `https://github.com/${user.login}/${repoName}`,
        message: 'Backup completed successfully'
      });
      
    } catch (error: any) {
      console.error('❌ GitHub backup error:', error);
      res.status(500).json({ 
        success: false,
        message: error.message || 'GitHub backup failed' 
      });
    }
  });

  // === CUSTOMER ROUTES MOVED TO server/index.ts ===

  // Routes registered successfully
}
