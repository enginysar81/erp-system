import express, { type Request, Response, NextFunction } from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from 'url';
import i18n from 'i18n';
import multer from 'multer';
import crypto from 'crypto';
import helmet from 'helmet';
import compression from 'compression';
import methodOverride from 'method-override';
import { registerRoutes } from './routes.js';
import { storage } from './storage.js';

// Extend Request type to include i18n methods
declare global {
  namespace Express {
    interface Request {
      __: (phrase: string, ...args: any[]) => string;
      getLocale: () => string;
    }
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// CSS version for cache busting (regenerates on server restart)
const CSS_VERSION = Date.now();

// Make CSS version available to all templates
app.locals.cssVersion = CSS_VERSION;

// Configure i18n
i18n.configure({
  locales: ['tr', 'pl', 'ua'],
  defaultLocale: 'tr',
  directory: path.join(__dirname, '../locales'),
  queryParameter: 'lang',
  autoReload: true,
  updateFiles: false,
  api: {
    '__': '__',
    '__n': '__n'
  }
});

// Production security middleware
if (process.env.NODE_ENV === 'production') {
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
        imgSrc: ["'self'", "data:", "https:"],
        fontSrc: ["'self'", "https://cdnjs.cloudflare.com"]
      }
    }
  }));
  app.use(compression());
}

// Middleware setup
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride('_method'));
app.use(i18n.init);

// Set view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));

// Static files with cache control
app.use('/css', express.static(path.join(__dirname, '../public/css'), {
  setHeaders: (res: Response, path: string) => {
    if (path.endsWith('.css')) {
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
    }
  }
}));

// Other static files (images, js, etc.) with normal caching
app.use(express.static(path.join(__dirname, '../public')));

// Redirect SPA routes to EJS products page
app.get('/app', (req: Request, res: Response) => {
  res.redirect(301, '/products');
});

app.get('/app/*', (req: Request, res: Response) => {
  res.redirect(301, '/products');
});

// Multer configuration for image uploads
const multerStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(__dirname, '../public/uploads');
    // Ensure upload directory exists
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = crypto.randomBytes(8).toString('hex');
    const extension = path.extname(file.originalname);
    cb(null, `img_${Date.now()}_${uniqueSuffix}${extension}`);
  }
});

const upload = multer({ 
  storage: multerStorage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: function (req, file, cb) {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Sadece JPEG, PNG ve WEBP formatları desteklenir.'));
    }
  }
});

// Helper function to load products
function loadProducts() {
  try {
    const productsData = fs.readFileSync(path.join(__dirname, '../data/products.json'), 'utf8');
    return JSON.parse(productsData);
  } catch (error) {
    console.error('Error loading products:', error);
    return [];
  }
}

// Helper function to save products
function saveProducts(products: any[]) {
  try {
    fs.writeFileSync(path.join(__dirname, '../data/products.json'), JSON.stringify(products, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving products:', error);
    return false;
  }
}

// Helper function to load attributes
function loadAttributes() {
  try {
    const attributesData = fs.readFileSync(path.join(__dirname, '../data/attributes.json'), 'utf8');
    return JSON.parse(attributesData);
  } catch (error) {
    console.error('Error loading attributes:', error);
    return [];
  }
}

// Helper function to save attributes
function saveAttributes(attributes: any[]) {
  try {
    fs.writeFileSync(path.join(__dirname, '../data/attributes.json'), JSON.stringify(attributes, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving attributes:', error);
    return false;
  }
}

// Helper function to load label templates
function loadLabelTemplates() {
  try {
    const templatesData = fs.readFileSync(path.join(__dirname, '../data/labels.json'), 'utf8');
    return JSON.parse(templatesData);
  } catch (error) {
    console.error('Error loading label templates:', error);
    return [];
  }
}

// Helper function to save label templates
function saveLabelTemplates(templates: any[]) {
  try {
    fs.writeFileSync(path.join(__dirname, '../data/labels.json'), JSON.stringify(templates, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving label templates:', error);
    return false;
  }
}

// Helper function to load warehouses
function loadWarehouses() {
  try {
    const warehousesData = fs.readFileSync(path.join(__dirname, '../data/warehouses.json'), 'utf8');
    return JSON.parse(warehousesData);
  } catch (error) {
    console.error('Error loading warehouses:', error);
    return [];
  }
}

// Helper function to save warehouses
function saveWarehouses(warehouses: any[]) {
  try {
    fs.writeFileSync(path.join(__dirname, '../data/warehouses.json'), JSON.stringify(warehouses, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving warehouses:', error);
    return false;
  }
}

// Helper function to generate next warehouse ID
function getNextWarehouseId(warehouses: any[]) {
  if (warehouses.length === 0) return 1;
  return Math.max(...warehouses.map(w => w.id)) + 1;
}

// Helper function to load barcodes
function loadBarcodes() {
  try {
    const barcodesData = fs.readFileSync(path.join(__dirname, '../data/barcodes.json'), 'utf8');
    return JSON.parse(barcodesData);
  } catch (error) {
    console.error('Error loading barcodes:', error);
    return [];
  }
}

// Helper function to load customer transactions
function loadCustomerTransactions() {
  try {
    const transactionsData = fs.readFileSync(path.join(__dirname, '../data/customer-transactions.json'), 'utf8');
    return JSON.parse(transactionsData);
  } catch (error) {
    console.error('Error loading customer transactions:', error);
    return [];
  }
}

// Enhanced helper function to calculate comprehensive statistics
function calculateStats(products: any[]) {
  const totalProducts = products.length;
  const activeProducts = products.filter(p => p.status === 'Aktif').length;
  const lowStock = products.filter(p => p.stock < 5).length;
  const outOfStock = products.filter(p => p.stock === 0).length;
  const totalValue = products.reduce((sum, p) => sum + (p.sellPrice * p.stock), 0).toFixed(2);
  
  // Calculate total stock by unit types
  const pieceProducts = products.filter(p => p.unit === 'adet');
  const meterProducts = products.filter(p => p.unit === 'metre');
  const totalPieces = pieceProducts.reduce((sum, p) => sum + p.stock, 0);
  const totalMeters = meterProducts.reduce((sum, p) => sum + p.stock, 0);
  
  return {
    totalProducts,
    activeProducts,
    lowStock,
    outOfStock,
    totalValue,
    totalPieces,
    totalMeters,
    pieceProducts: pieceProducts.length,
    meterProducts: meterProducts.length
  };
}

// Helper function to get warehouse statistics
function getWarehouseStats(warehouses: any[]) {
  const totalWarehouses = warehouses.length;
  const activeWarehouses = warehouses.filter(w => w.status === 'Aktif').length;
  const warehousesWithShelves = warehouses.filter(w => w.hasShelfSystem && w.shelves?.length > 0).length;
  const totalShelves = warehouses.reduce((sum, w) => sum + (w.shelves?.length || 0), 0);
  
  return {
    totalWarehouses,
    activeWarehouses,
    warehousesWithShelves,
    totalShelves
  };
}

// Helper function to get today's stock movements
function getTodayMovements(stockMovements: any[]) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const todayMovements = stockMovements.filter(m => {
    const movementDate = new Date(m.date);
    return movementDate >= today && movementDate < tomorrow;
  });
  
  const todayEntries = todayMovements.filter(m => m.type === 'Giriş');
  const todayExits = todayMovements.filter(m => m.type === 'Çıkış');
  
  return {
    total: todayMovements.length,
    entries: todayEntries.length,
    exits: todayExits.length,
    totalQuantity: todayMovements.reduce((sum, m) => sum + m.quantity, 0)
  };
}

// Helper function to get monthly movement data for charts
function getMonthlyMovements(stockMovements: any[]) {
  const now = new Date();
  const monthsData = [];
  
  for (let i = 5; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const nextMonth = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    
    const monthMovements = stockMovements.filter(m => {
      const movementDate = new Date(m.date);
      return movementDate >= date && movementDate < nextMonth;
    });
    
    const entries = monthMovements.filter(m => m.type === 'Giriş');
    const exits = monthMovements.filter(m => m.type === 'Çıkış');
    
    monthsData.push({
      month: date.toLocaleDateString('tr-TR', { month: 'short' }),
      entries: entries.length,
      exits: exits.length,
      total: monthMovements.length
    });
  }
  
  return monthsData;
}

// Helper function to get category statistics
function getCategoryStats(products: any[]) {
  const categoryCount: { [key: string]: number } = {};
  products.forEach(product => {
    const category = product.category || 'Diğer';
    categoryCount[category] = (categoryCount[category] || 0) + 1;
  });
  
  return Object.entries(categoryCount).map(([category, count]) => ({
    category,
    count
  }));
}

// Enhanced dashboard route with comprehensive data
app.get('/', async (req: Request, res: Response) => {
  try {
    const products = loadProducts();
    const warehouses = loadWarehouses();
    const stockMovements = await storage.getStockMovements();
    
    const stats = calculateStats(products);
    const warehouseStats = getWarehouseStats(warehouses);
    const todayStats = getTodayMovements(stockMovements);
    const monthlyMovements = getMonthlyMovements(stockMovements);
    const categoryStats = getCategoryStats(products);
    
    // Render dashboard template to string first
    res.render('dashboard', {
      stats,
      warehouseStats,
      todayStats,
      monthlyMovements,
      categoryStats,
      locale: req.getLocale(),
      __: req.__
    }, (err, html) => {
      if (err) {
        console.error('Error rendering dashboard template:', err);
        return res.status(500).send('Internal Server Error');
      }
      
      // Then render layout with the dashboard HTML as body
      res.render('layout', {
        title: req.__('dashboard.title'),
        currentPage: 'dashboard',
        locale: req.getLocale(),
        body: html,
        scripts: '', // Add script tag for Chart.js in layout
        __: req.__
      });
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Dashboard route (same as home)
app.get('/dashboard', (req: Request, res: Response) => {
  res.redirect('/');
});

// Helper function to calculate stock statistics
function calculateStockStatistics(barcodes: any[], warehouses: any[]) {
  // Calculate totals by unit type
  const totalPieces = barcodes.filter(b => b.unit === 'adet').reduce((sum, b) => sum + (b.quantity || 0), 0);
  const totalMeters = barcodes.filter(b => b.unit === 'metre').reduce((sum, b) => sum + (b.quantity || 0), 0);
  const totalBarcodes = barcodes.length;
  
  // Calculate by warehouse
  const warehouseStats = warehouses.map(warehouse => {
    const warehouseBarcodes = barcodes.filter(b => b.warehouseId.toString() === warehouse.id.toString());
    const pieces = warehouseBarcodes.filter(b => b.unit === 'adet').reduce((sum, b) => sum + (b.quantity || 0), 0);
    const meters = warehouseBarcodes.filter(b => b.unit === 'metre').reduce((sum, b) => sum + (b.quantity || 0), 0);
    
    // Shelf statistics for warehouses with shelf system
    const shelfStats = warehouse.hasShelfSystem && warehouse.shelves ? 
      warehouse.shelves.map((shelf: string) => {
        const shelfBarcodes = warehouseBarcodes.filter(b => b.shelfId === shelf);
        const shelfPieces = shelfBarcodes.filter(b => b.unit === 'adet').reduce((sum, b) => sum + (b.quantity || 0), 0);
        const shelfMeters = shelfBarcodes.filter(b => b.unit === 'metre').reduce((sum, b) => sum + (b.quantity || 0), 0);
        
        return {
          shelfId: shelf,
          totalBarcodes: shelfBarcodes.length,
          pieces: shelfPieces,
          meters: shelfMeters,
          totalStock: shelfPieces + shelfMeters
        };
      }).filter((shelf: any) => shelf.totalBarcodes > 0) : [];
    
    return {
      warehouseId: warehouse.id,
      warehouseName: warehouse.name,
      status: warehouse.status,
      totalBarcodes: warehouseBarcodes.length,
      pieces: pieces,
      meters: meters,
      totalStock: pieces + meters,
      hasShelfSystem: warehouse.hasShelfSystem,
      shelfStats: shelfStats
    };
  }).filter(ws => ws.totalBarcodes > 0);
  
  // Get most used warehouses and shelves for quick filters
  const quickFilters = {
    warehouses: warehouseStats
      .sort((a, b) => b.totalBarcodes - a.totalBarcodes)
      .slice(0, 5),
    shelves: warehouseStats
      .flatMap(ws => ws.shelfStats)
      .sort((a, b) => b.totalBarcodes - a.totalBarcodes)
      .slice(0, 8)
  };
  
  return {
    totalStats: {
      totalBarcodes,
      totalPieces,
      totalMeters,
      uniqueProducts: new Set(barcodes.map(b => b.productId)).size,
      activeWarehouses: warehouseStats.length
    },
    warehouseStats,
    quickFilters
  };
}

// Stock by warehouse route
app.get('/stock/by-warehouse', async (req: Request, res: Response) => {
  try {
    // Load data from storage
    const products = loadProducts();
    const warehouses = loadWarehouses();
    const barcodes = loadBarcodes();
    
    // Prepare data for template
    const enrichedBarcodes = barcodes.map((barcode: any) => {
      const product = products.find((p: any) => p.id === barcode.productId);
      const warehouse = warehouses.find((w: any) => w.id.toString() === barcode.warehouseId);
      
      return {
        ...barcode,
        productName: product?.name || `Product ${barcode.productId}`,
        productAttributes: product?.attributes || [],
        warehouseName: warehouse?.name || `Warehouse ${barcode.warehouseId}`,
        warehouseShelves: warehouse?.shelves || [],
        hasShelfSystem: warehouse?.hasShelfSystem || false
      };
    });
    
    // Calculate comprehensive statistics
    const stockStats = calculateStockStatistics(enrichedBarcodes, warehouses);
    
    // Render stock by warehouse template
    res.render('stock_by_warehouse', {
      title: req.__('stockByWarehouse.title'),
      currentPage: 'stock_by_warehouse',
      locale: req.getLocale(),
      barcodes: enrichedBarcodes,
      warehouses,
      products,
      stockStats,
      __: req.__
    }, (err, html) => {
      if (err) {
        console.error('Error rendering stock by warehouse template:', err);
        return res.status(500).send('Internal Server Error');
      }
      
      // Render layout with the stock by warehouse HTML as body
      res.render('layout', {
        title: req.__('stockByWarehouse.title'),
        currentPage: 'stock_by_warehouse',
        locale: req.getLocale(),
        body: html,
        __: req.__
      });
    });
  } catch (error) {
    console.error('Stock by warehouse error:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Products route
app.get('/products', (req: Request, res: Response) => {
  const products = loadProducts();
  const attributes = loadAttributes();
  const stats = calculateStats(products);
  
  // Render products template to string first
  res.render('products', { 
    products, 
    attributes,
    stats, 
    locale: req.getLocale(), 
    __: req.__ 
  }, (err, html) => {
    if (err) {
      console.error('Error rendering products template:', err);
      return res.status(500).send('Internal Server Error');
    }
    
    // Then render layout with the products HTML as body
    res.render('layout', {
      title: req.__('products.title'),
      currentPage: 'products',
      locale: req.getLocale(),
      body: html,
      __: req.__
    });
  });
});

// Toggle product status
app.post('/products/toggle/:id', (req: Request, res: Response) => {
  const productId = req.params.id;
  const products = loadProducts();
  
  const productIndex = products.findIndex((p: any) => p.id === productId);
  if (productIndex !== -1) {
    products[productIndex].status = products[productIndex].status === 'Aktif' ? 'Pasif' : 'Aktif';
    saveProducts(products);
  }
  
  res.redirect(`/products?lang=${req.getLocale()}`);
});

// Product form routes
app.get('/products/new', (req: Request, res: Response) => {
  const attributes = loadAttributes();
  
  res.render('product_form', {
    title: 'Yeni Ürün Ekle',
    currentPage: 'products',
    locale: req.getLocale(),
    product: null,
    attributes,
    __: req.__
  }, (err, html) => {
    if (err) {
      console.error('Error rendering product form template:', err);
      return res.status(500).send('Internal Server Error');
    }
    
    res.render('layout', {
      title: 'Yeni Ürün Ekle',
      currentPage: 'products',
      locale: req.getLocale(),
      body: html,
      __: req.__
    });
  });
});

app.post('/products/new', upload.array('images[]', 10), (req: Request, res: Response) => {
  const { name, description, buyPrice, sellPrice, buyCurrency, sellCurrency, stock, status, images, coverImage, unit } = req.body;
  
  // Handle uploaded files
  const uploadedImages: string[] = [];
  if (req.files && Array.isArray(req.files)) {
    req.files.forEach((file: Express.Multer.File) => {
      uploadedImages.push(`/uploads/${file.filename}`);
    });
  }
  
  // Basic validation
  if (!name || !name.trim()) {
    return res.redirect(`/products/new?lang=${req.getLocale()}&error=nameRequired`);
  }
  
  // Validate required fields
  if (!sellPrice || parseFloat(sellPrice) < 0) {
    return res.redirect(`/products/new?lang=${req.getLocale()}&error=sellPriceRequired`);
  }
  
  if (!sellCurrency || !['USD', 'PLN', 'UAH'].includes(sellCurrency)) {
    return res.redirect(`/products/new?lang=${req.getLocale()}&error=sellCurrencyRequired`);
  }
  
  if (!buyCurrency || !['USD', 'PLN', 'UAH'].includes(buyCurrency)) {
    return res.redirect(`/products/new?lang=${req.getLocale()}&error=buyCurrencyRequired`);
  }

  // Validate unit field
  if (!unit || !['metre', 'adet'].includes(unit)) {
    return res.redirect(`/products/new?lang=${req.getLocale()}&error=unitRequired`);
  }
  
  const products = loadProducts();
  const attributes = loadAttributes();
  const newId = (Math.max(...products.map((p: any) => parseInt(p.id)), 0) + 1).toString();
  
  // Process attributes from form
  const productAttributes: any[] = [];
  attributes.forEach((attr: any) => {
    const value = req.body[`attribute_${attr.id}`];
    if (value && value.trim()) {
      productAttributes.push({
        attributeId: attr.id,
        name: attr.name,
        value: value.trim()
      });
    }
  });

  // Validate attributes (at least 1 required)
  if (productAttributes.length === 0) {
    return res.redirect(`/products/new?lang=${req.getLocale()}&error=attributesRequired`);
  }

  // Duplicate check: same name + same attribute set
  const normalizedName = name.trim().toLowerCase();
  const sortedAttributes = productAttributes
    .map(attr => `${attr.name}:${attr.value}`)
    .sort()
    .join('|');
  
  const existingProduct = products.find((p: any) => {
    const existingNormalizedName = p.name.toLowerCase();
    const existingAttributes = (p.attributes || [])
      .map((attr: any) => `${attr.name}:${attr.value}`)
      .sort()
      .join('|');
    
    return existingNormalizedName === normalizedName && existingAttributes === sortedAttributes;
  });

  if (existingProduct) {
    return res.redirect(`/products/new?lang=${req.getLocale()}&error=duplicateProduct&conflictId=${existingProduct.id}`);
  }
  
  // Process images - combine uploaded files with existing images
  let productImages: string[] = [];
  let productCoverImage = '';
  
  // Add uploaded images first
  productImages = [...uploadedImages];
  
  // Add existing images from hidden input (if any)
  if (images) {
    try {
      const existingImages = typeof images === 'string' ? JSON.parse(images) : images;
      if (Array.isArray(existingImages)) {
        productImages = [...productImages, ...existingImages];
      }
    } catch (e) {
      // Ignore invalid JSON
    }
  }
  
  // Limit to 10 images max
  if (productImages.length > 10) {
    productImages = productImages.slice(0, 10);
  }
  
  // Set cover image
  if (coverImage) {
    productCoverImage = coverImage;
  } else if (productImages.length > 0) {
    productCoverImage = productImages[0];
  }
  
  const newProduct = {
    id: newId,
    name: name.trim(),
    description: description ? description.trim() : '',
    buyPrice: parseFloat(buyPrice) || 0,
    sellPrice: parseFloat(sellPrice) || 0,
    buyCurrency: buyCurrency || 'USD',
    sellCurrency: sellCurrency || 'USD',
    stock: parseInt(stock) || 0,
    unit: unit || 'adet',
    status: status || 'Aktif',
    coverImage: productCoverImage,
    images: productImages,
    attributes: productAttributes
  };
  
  products.push(newProduct);
  saveProducts(products);
  
  res.redirect(`/products?lang=${req.getLocale()}&success=added`);
});

app.get('/products/:id/edit', (req: Request, res: Response) => {
  const productId = req.params.id;
  const products = loadProducts();
  const attributes = loadAttributes();
  const product = products.find((p: any) => p.id === productId);
  
  if (!product) {
    return res.redirect(`/products?lang=${req.getLocale()}&error=notFound`);
  }
  
  res.render('product_form', {
    title: 'Ürün Düzenle',
    currentPage: 'products',
    locale: req.getLocale(),
    product,
    attributes,
    __: req.__
  }, (err, html) => {
    if (err) {
      console.error('Error rendering product form template:', err);
      return res.status(500).send('Internal Server Error');
    }
    
    res.render('layout', {
      title: 'Ürün Düzenle',
      currentPage: 'products',
      locale: req.getLocale(),
      body: html,
      __: req.__
    });
  });
});

app.post('/products/:id/update', upload.array('images[]', 10), (req: Request, res: Response) => {
  const productId = req.params.id;
  const { name, description, buyPrice, sellPrice, buyCurrency, sellCurrency, stock, status, images, coverImage, unit } = req.body;
  
  // Handle uploaded files
  const uploadedImages: string[] = [];
  if (req.files && Array.isArray(req.files)) {
    req.files.forEach((file: Express.Multer.File) => {
      uploadedImages.push(`/uploads/${file.filename}`);
    });
  }
  
  const products = loadProducts();
  const attributes = loadAttributes();
  const productIndex = products.findIndex((p: any) => p.id === productId);
  
  if (productIndex === -1) {
    return res.redirect(`/products?lang=${req.getLocale()}&error=notFound`);
  }
  
  // Basic validation
  if (!name || !name.trim()) {
    return res.redirect(`/products/${productId}/edit?lang=${req.getLocale()}&error=nameRequired`);
  }
  
  // Validate required fields
  if (!sellPrice || parseFloat(sellPrice) < 0) {
    return res.redirect(`/products/${productId}/edit?lang=${req.getLocale()}&error=sellPriceRequired`);
  }
  
  if (!sellCurrency || !['USD', 'PLN', 'UAH'].includes(sellCurrency)) {
    return res.redirect(`/products/${productId}/edit?lang=${req.getLocale()}&error=sellCurrencyRequired`);
  }
  
  if (!buyCurrency || !['USD', 'PLN', 'UAH'].includes(buyCurrency)) {
    return res.redirect(`/products/${productId}/edit?lang=${req.getLocale()}&error=buyCurrencyRequired`);
  }

  // Validate unit field
  if (!unit || !['metre', 'adet'].includes(unit)) {
    return res.redirect(`/products/${productId}/edit?lang=${req.getLocale()}&error=unitRequired`);
  }
  
  // Process attributes from form
  const productAttributes: any[] = [];
  attributes.forEach((attr: any) => {
    const value = req.body[`attribute_${attr.id}`];
    if (value && value.trim()) {
      productAttributes.push({
        attributeId: attr.id,
        name: attr.name,
        value: value.trim()
      });
    }
  });

  // Validate attributes (at least 1 required)
  if (productAttributes.length === 0) {
    return res.redirect(`/products/${productId}/edit?lang=${req.getLocale()}&error=attributesRequired`);
  }

  // Duplicate check: same name + same attribute set (excluding current product)
  const normalizedName = name.trim().toLowerCase();
  const sortedAttributes = productAttributes
    .map(attr => `${attr.name}:${attr.value}`)
    .sort()
    .join('|');
  
  const existingProduct = products.find((p: any) => {
    if (p.id === productId) return false; // Skip current product
    
    const existingNormalizedName = p.name.toLowerCase();
    const existingAttributes = (p.attributes || [])
      .map((attr: any) => `${attr.name}:${attr.value}`)
      .sort()
      .join('|');
    
    return existingNormalizedName === normalizedName && existingAttributes === sortedAttributes;
  });

  if (existingProduct) {
    return res.redirect(`/products/${productId}/edit?lang=${req.getLocale()}&error=duplicateProduct&conflictId=${existingProduct.id}`);
  }
  
  // Process images - append uploaded files to existing images
  let productImages: string[] = [];
  let productCoverImage = '';
  
  // Start with existing images from hidden input
  if (images) {
    try {
      const existingImages = typeof images === 'string' ? JSON.parse(images) : images;
      if (Array.isArray(existingImages)) {
        productImages = [...existingImages];
      }
    } catch (e) {
      // Ignore invalid JSON
    }
  }
  
  // Append new uploaded images
  productImages = [...productImages, ...uploadedImages];
  
  // Limit to 10 images max
  if (productImages.length > 10) {
    productImages = productImages.slice(0, 10);
  }
  
  // Set cover image
  if (coverImage) {
    productCoverImage = coverImage;
  } else if (productImages.length > 0) {
    productCoverImage = productImages[0];
  }
  
  // Update the product
  products[productIndex] = {
    ...products[productIndex],
    name: name.trim(),
    description: description ? description.trim() : '',
    buyPrice: parseFloat(buyPrice) || 0,
    sellPrice: parseFloat(sellPrice) || 0,
    buyCurrency: buyCurrency || products[productIndex].buyCurrency || 'USD',
    sellCurrency: sellCurrency || products[productIndex].sellCurrency || 'USD',
    stock: parseInt(stock) || 0,
    unit: unit || 'adet',
    status: status || 'Aktif',
    coverImage: productCoverImage,
    images: productImages,
    attributes: productAttributes
  };
  
  saveProducts(products);
  
  res.redirect(`/products?lang=${req.getLocale()}&success=updated`);
});

// Attributes management routes
app.get('/settings/attributes', (req: Request, res: Response) => {
  const attributes = loadAttributes();
  
  res.render('attributes', {
    title: req.__('attributes.title'),
    currentPage: 'settings',
    locale: req.getLocale(),
    attributes,
    __: req.__
  }, (err, html) => {
    if (err) {
      console.error('Error rendering attributes template:', err);
      return res.status(500).send('Internal Server Error');
    }
    
    // Render layout with the attributes HTML as body
    res.render('layout', {
      title: req.__('attributes.title'),
      currentPage: 'settings',
      locale: req.getLocale(),
      body: html,
      __: req.__
    });
  });
});

// Label Designer routes
app.get('/settings/labels', (req: Request, res: Response) => {
  try {
    // Load templates from JSON file directly to match other patterns
    const templates = loadLabelTemplates();
    const warehouses = loadWarehouses();
    
    res.render('labelDesigner', {
      title: req.__('labelDesigner.title'),
      currentPage: 'labelDesigner',
      locale: req.getLocale(),
      templates,
      warehouses,
      query: req.query,
      __: req.__
    }, (err, html) => {
      if (err) {
        console.error('Error rendering labelDesigner template:', err);
        return res.status(500).send('Internal Server Error');
      }
      
      // Render layout with the labelDesigner HTML as body
      res.render('layout', {
        title: req.__('labelDesigner.title'),
        currentPage: 'labelDesigner',
        locale: req.getLocale(),
        body: html,
        __: req.__
      });
    });
  } catch (error) {
    console.error('Error loading label designer:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/settings/attributes/new', (req: Request, res: Response) => {
  const { name, type, options } = req.body;
  
  // Validation
  if (!name || name.trim() === '' || name.trim().length < 2) {
    return res.redirect(`/settings/attributes?lang=${req.getLocale()}&error=nameRequired`);
  }
  
  if (!type || !['TEXT', 'OPTIONS'].includes(type)) {
    return res.redirect(`/settings/attributes?lang=${req.getLocale()}&error=typeRequired`);
  }
  
  let processedOptions: string[] = [];
  if (type === 'OPTIONS') {
    if (!options || options.trim() === '') {
      return res.redirect(`/settings/attributes?lang=${req.getLocale()}&error=optionsRequired`);
    }
    
    // Process options - split by comma, trim, remove duplicates and empty values
    processedOptions = options
      .split(',')
      .map((opt: string) => opt.trim())
      .filter((opt: string) => opt.length > 0)
      .filter((opt: string, index: number, arr: string[]) => 
        arr.findIndex(o => o.toLowerCase() === opt.toLowerCase()) === index
      );
      
    if (processedOptions.length === 0) {
      return res.redirect(`/settings/attributes?lang=${req.getLocale()}&error=optionsRequired`);
    }
  }
  
  const attributes = loadAttributes();
  const newId = (Math.max(...attributes.map((a: any) => parseInt(a.id)), 0) + 1).toString();
  
  const newAttribute = {
    id: newId,
    name: name.trim(),
    type,
    options: processedOptions
  };
  
  attributes.push(newAttribute);
  saveAttributes(attributes);
  
  res.redirect(`/settings/attributes?lang=${req.getLocale()}&success=added`);
});

// Edit attribute page
app.get('/settings/attributes/:id', (req: Request, res: Response) => {
  const attributeId = req.params.id;
  const attributes = loadAttributes();
  const attribute = attributes.find((attr: any) => attr.id === attributeId);
  
  if (!attribute) {
    return res.redirect(`/settings/attributes?lang=${req.getLocale()}&error=notFound`);
  }
  
  res.render('attribute_edit', {
    title: req.__('attributes.edit'),
    currentPage: 'settings',
    locale: req.getLocale(),
    attribute,
    __: req.__
  }, (err, html) => {
    if (err) {
      console.error('Error rendering attribute edit template:', err);
      return res.status(500).send('Internal Server Error');
    }
    
    res.render('layout', {
      title: req.__('attributes.edit'),
      currentPage: 'settings',
      locale: req.getLocale(),
      body: html,
      __: req.__
    });
  });
});

// Update attribute
app.post('/settings/attributes/:id/update', (req: Request, res: Response) => {
  const attributeId = req.params.id;
  const { name, type, options } = req.body;
  
  // Validation
  if (!name || name.trim() === '' || name.trim().length < 2) {
    return res.redirect(`/settings/attributes/${attributeId}?lang=${req.getLocale()}&error=nameRequired`);
  }
  
  if (!type || !['TEXT', 'OPTIONS'].includes(type)) {
    return res.redirect(`/settings/attributes/${attributeId}?lang=${req.getLocale()}&error=typeRequired`);
  }
  
  let processedOptions: string[] = [];
  if (type === 'OPTIONS') {
    if (!options || options.trim() === '') {
      return res.redirect(`/settings/attributes/${attributeId}?lang=${req.getLocale()}&error=optionsRequired`);
    }
    
    processedOptions = options
      .split(',')
      .map((opt: string) => opt.trim())
      .filter((opt: string) => opt.length > 0)
      .filter((opt: string, index: number, arr: string[]) => 
        arr.findIndex(o => o.toLowerCase() === opt.toLowerCase()) === index
      );
      
    if (processedOptions.length === 0) {
      return res.redirect(`/settings/attributes/${attributeId}?lang=${req.getLocale()}&error=optionsRequired`);
    }
  }
  
  const attributes = loadAttributes();
  const attributeIndex = attributes.findIndex((attr: any) => attr.id === attributeId);
  
  if (attributeIndex === -1) {
    return res.redirect(`/settings/attributes?lang=${req.getLocale()}&error=notFound`);
  }
  
  // Update the attribute
  attributes[attributeIndex] = {
    id: attributeId,
    name: name.trim(),
    type,
    options: processedOptions
  };
  
  saveAttributes(attributes);
  
  res.redirect(`/settings/attributes?lang=${req.getLocale()}&success=updated`);
});

// Delete attribute
app.post('/settings/attributes/delete/:id', (req: Request, res: Response) => {
  const attributeId = req.params.id;
  let attributes = loadAttributes();
  
  // Check if attribute is used in any products
  const products = loadProducts();
  const usedInProducts = products.some((product: any) => 
    product.attributes && product.attributes.some((attr: any) => attr.attributeId === attributeId)
  );
  
  if (usedInProducts) {
    // Remove attribute from all products that use it
    products.forEach((product: any) => {
      if (product.attributes) {
        product.attributes = product.attributes.filter((attr: any) => attr.attributeId !== attributeId);
      }
    });
    saveProducts(products);
  }
  
  // Remove the attribute
  attributes = attributes.filter((attr: any) => attr.id !== attributeId);
  saveAttributes(attributes);
  
  const message = usedInProducts ? 'deletedWithProducts' : 'deleted';
  res.redirect(`/settings/attributes?lang=${req.getLocale()}&success=${message}`);
});

// Image upload endpoint
app.post('/api/upload-image', upload.single('image'), (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Resim yüklenmedi.' });
  }
  
  const imagePath = `uploads/${req.file.filename}`;
  res.json({ 
    success: true, 
    imagePath: imagePath,
    message: 'Resim başarıyla yüklendi.'
  });
});

// Multiple image upload endpoint
app.post('/api/upload-images', upload.array('images', 10), (req: Request, res: Response) => {
  if (!req.files || (req.files as Express.Multer.File[]).length === 0) {
    return res.status(400).json({ error: 'Resim yüklenmedi.' });
  }
  
  const files = req.files as Express.Multer.File[];
  const imagePaths = files.map(file => `uploads/${file.filename}`);
  
  res.json({ 
    success: true, 
    imagePaths: imagePaths,
    message: `${files.length} resim başarıyla yüklendi.`
  });
});

// Image delete endpoint - new specification route
app.post('/products/:id/images/delete', (req: Request, res: Response) => {
  const productId = req.params.id;
  const { path: imagePath } = req.body;
  
  if (!imagePath) {
    return res.status(400).json({ error: 'Resim yolu belirtilmedi.' });
  }
  
  try {
    const products = loadProducts();
    const productIndex = products.findIndex((p: any) => p.id === productId);
    
    if (productIndex === -1) {
      return res.status(404).json({ error: 'Ürün bulunamadı.' });
    }
    
    const product = products[productIndex];
    
    // Remove from product's images array
    if (product.images) {
      product.images = product.images.filter((img: string) => img !== imagePath);
    }
    
    // If deleted image was cover, set new cover
    if (product.coverImage === imagePath) {
      product.coverImage = product.images && product.images.length > 0 ? product.images[0] : null;
    }
    
    // Update the product
    products[productIndex] = product;
    saveProducts(products);
    
    // Delete physical file (ignore if file doesn't exist)
    try {
      const fullPath = path.join(__dirname, '../public', imagePath);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    } catch (fileError) {
      console.log('File delete warning (ignored):', fileError);
    }
    
    res.json({ 
      success: true, 
      message: req.__('images.deleted')
    });
  } catch (error) {
    console.error('Delete image error:', error);
    res.status(500).json({ error: 'Resim silinemedi.' });
  }
});

// Set cover image endpoint - new specification route
app.post('/products/:id/images/cover', (req: Request, res: Response) => {
  const productId = req.params.id;
  const { path } = req.body;
  
  if (!path) {
    return res.status(400).json({ error: req.__('images.typeError') });
  }
  
  try {
    const products = loadProducts();
    const productIndex = products.findIndex((p: any) => p.id === productId);
    
    if (productIndex === -1) {
      return res.status(404).json({ error: 'Ürün bulunamadı.' });
    }
    
    // Verify the path exists in the product's images
    const product = products[productIndex];
    if (!product.images || !product.images.includes(path)) {
      return res.status(400).json({ error: 'Bu görsel ürüne ait değil.' });
    }
    
    products[productIndex].coverImage = path;
    saveProducts(products);
    
    res.json({ 
      success: true, 
      message: req.__('images.coverUpdated')
    });
  } catch (error) {
    console.error('Set cover error:', error);
    res.status(500).json({ error: 'Kapak resmi ayarlanamadı.' });
  }
});

// Warehouse Management Routes

// Warehouses listing page
app.get('/warehouses', (req: Request, res: Response) => {
  const warehouses = loadWarehouses();
  
  res.render('warehouses', { 
    warehouses, 
    locale: req.getLocale(), 
    __: req.__,
    success: req.query.success,
    error: req.query.error
  }, (err, html) => {
    if (err) {
      console.error('Error rendering warehouses template:', err);
      return res.status(500).send('Internal Server Error');
    }
    
    res.render('layout', {
      title: req.__('warehouses.title'),
      currentPage: 'warehouses',
      locale: req.getLocale(),
      body: html,
      __: req.__
    });
  });
});

// New warehouse form
app.get('/warehouses/new', (req: Request, res: Response) => {
  res.render('warehouse_form', {
    warehouse: null,
    isEdit: false,
    locale: req.getLocale(),
    __: req.__,
    error: req.query.error
  }, (err, html) => {
    if (err) {
      console.error('Error rendering warehouse form template:', err);
      return res.status(500).send('Internal Server Error');
    }
    
    res.render('layout', {
      title: req.__('warehouseForm.title.create'),
      currentPage: 'warehouses',
      locale: req.getLocale(),
      body: html,
      __: req.__
    });
  });
});

// Create new warehouse
app.post('/warehouses/new', (req: Request, res: Response) => {
  const { name, status, hasShelfSystem } = req.body;
  
  // Basic validation
  if (!name || !name.trim()) {
    return res.redirect(`/warehouses/new?lang=${req.getLocale()}&error=nameRequired`);
  }
  
  if (name.trim().length < 2) {
    return res.redirect(`/warehouses/new?lang=${req.getLocale()}&error=nameMinLength`);
  }
  
  if (name.trim().length > 50) {
    return res.redirect(`/warehouses/new?lang=${req.getLocale()}&error=nameMaxLength`);
  }
  
  const warehouses = loadWarehouses();
  
  // Check for duplicate names (case-insensitive)
  const normalizedName = name.trim().toLowerCase();
  const existingWarehouse = warehouses.find((w: any) => 
    w.name.toLowerCase() === normalizedName
  );
  
  if (existingWarehouse) {
    return res.redirect(`/warehouses/new?lang=${req.getLocale()}&error=nameExists`);
  }
  
  // Create new warehouse
  const newWarehouse = {
    id: getNextWarehouseId(warehouses),
    name: name.trim(),
    status: status === 'Pasif' ? 'Pasif' : 'Aktif',
    hasShelfSystem: hasShelfSystem === 'true',
    shelves: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  warehouses.push(newWarehouse);
  saveWarehouses(warehouses);
  
  res.redirect(`/warehouses?lang=${req.getLocale()}&success=created`);
});

// Warehouse detail page
app.get('/warehouses/:id', (req: Request, res: Response) => {
  const warehouseId = parseInt(req.params.id);
  const warehouses = loadWarehouses();
  const warehouse = warehouses.find((w: any) => w.id === warehouseId);
  
  if (!warehouse) {
    return res.redirect(`/warehouses?lang=${req.getLocale()}&error=notFound`);
  }
  
  res.render('warehouse_detail', {
    warehouse,
    locale: req.getLocale(),
    __: req.__,
    success: req.query.success,
    error: req.query.error
  }, (err, html) => {
    if (err) {
      console.error('Error rendering warehouse detail template:', err);
      return res.status(500).send('Internal Server Error');
    }
    
    res.render('layout', {
      title: `${warehouse.name} - ${req.__('warehouseDetail.title')}`,
      currentPage: 'warehouses',
      locale: req.getLocale(),
      body: html,
      __: req.__
    });
  });
});

// Edit warehouse form
app.get('/warehouses/:id/edit', (req: Request, res: Response) => {
  const warehouseId = parseInt(req.params.id);
  const warehouses = loadWarehouses();
  const warehouse = warehouses.find((w: any) => w.id === warehouseId);
  
  if (!warehouse) {
    return res.redirect(`/warehouses?lang=${req.getLocale()}&error=notFound`);
  }
  
  res.render('warehouse_form', {
    warehouse,
    isEdit: true,
    locale: req.getLocale(),
    __: req.__,
    error: req.query.error
  }, (err, html) => {
    if (err) {
      console.error('Error rendering warehouse form template:', err);
      return res.status(500).send('Internal Server Error');
    }
    
    res.render('layout', {
      title: req.__('warehouseForm.title.edit'),
      currentPage: 'warehouses',
      locale: req.getLocale(),
      body: html,
      __: req.__
    });
  });
});

// Update warehouse
app.post('/warehouses/:id/update', (req: Request, res: Response) => {
  const warehouseId = parseInt(req.params.id);
  const { name, status, hasShelfSystem } = req.body;
  
  // Basic validation
  if (!name || !name.trim()) {
    return res.redirect(`/warehouses/${warehouseId}/edit?lang=${req.getLocale()}&error=nameRequired`);
  }
  
  if (name.trim().length < 2) {
    return res.redirect(`/warehouses/${warehouseId}/edit?lang=${req.getLocale()}&error=nameMinLength`);
  }
  
  if (name.trim().length > 50) {
    return res.redirect(`/warehouses/${warehouseId}/edit?lang=${req.getLocale()}&error=nameMaxLength`);
  }
  
  const warehouses = loadWarehouses();
  const warehouseIndex = warehouses.findIndex((w: any) => w.id === warehouseId);
  
  if (warehouseIndex === -1) {
    return res.redirect(`/warehouses?lang=${req.getLocale()}&error=notFound`);
  }
  
  // Check for duplicate names (case-insensitive, excluding current warehouse)
  const normalizedName = name.trim().toLowerCase();
  const existingWarehouse = warehouses.find((w: any) => 
    w.id !== warehouseId && w.name.toLowerCase() === normalizedName
  );
  
  if (existingWarehouse) {
    return res.redirect(`/warehouses/${warehouseId}/edit?lang=${req.getLocale()}&error=nameExists`);
  }
  
  // Update warehouse
  const currentWarehouse = warehouses[warehouseIndex];
  const willDisableShelfSystem = currentWarehouse.hasShelfSystem && hasShelfSystem !== 'true';
  
  warehouses[warehouseIndex] = {
    ...currentWarehouse,
    name: name.trim(),
    status: status === 'Pasif' ? 'Pasif' : 'Aktif',
    hasShelfSystem: hasShelfSystem === 'true',
    shelves: willDisableShelfSystem ? [] : currentWarehouse.shelves, // Clear shelves if disabling shelf system
    updatedAt: new Date().toISOString()
  };
  
  saveWarehouses(warehouses);
  
  res.redirect(`/warehouses/${warehouseId}?lang=${req.getLocale()}&success=updated`);
});

// Toggle warehouse status
app.post('/warehouses/:id/toggle', (req: Request, res: Response) => {
  const warehouseId = parseInt(req.params.id);
  const warehouses = loadWarehouses();
  const warehouseIndex = warehouses.findIndex((w: any) => w.id === warehouseId);
  
  if (warehouseIndex === -1) {
    return res.redirect(`/warehouses?lang=${req.getLocale()}&error=notFound`);
  }
  
  const currentStatus = warehouses[warehouseIndex].status;
  const newStatus = currentStatus === 'Aktif' ? 'Pasif' : 'Aktif';
  const successMessage = newStatus === 'Aktif' ? 'activated' : 'deactivated';
  
  warehouses[warehouseIndex] = {
    ...warehouses[warehouseIndex],
    status: newStatus,
    updatedAt: new Date().toISOString()
  };
  
  saveWarehouses(warehouses);
  
  res.redirect(`/warehouses?lang=${req.getLocale()}&success=${successMessage}`);
});

// Add shelf to warehouse
app.post('/warehouses/:id/shelves/new', (req: Request, res: Response) => {
  const warehouseId = parseInt(req.params.id);
  const { shelfName } = req.body;
  
  // Basic validation
  if (!shelfName || !shelfName.trim()) {
    return res.redirect(`/warehouses/${warehouseId}?lang=${req.getLocale()}&error=shelfNameRequired`);
  }
  
  if (shelfName.trim().length < 1) {
    return res.redirect(`/warehouses/${warehouseId}?lang=${req.getLocale()}&error=shelfNameMinLength`);
  }
  
  if (shelfName.trim().length > 20) {
    return res.redirect(`/warehouses/${warehouseId}?lang=${req.getLocale()}&error=shelfNameMaxLength`);
  }
  
  const warehouses = loadWarehouses();
  const warehouseIndex = warehouses.findIndex((w: any) => w.id === warehouseId);
  
  if (warehouseIndex === -1) {
    return res.redirect(`/warehouses?lang=${req.getLocale()}&error=notFound`);
  }
  
  const warehouse = warehouses[warehouseIndex];
  
  if (!warehouse.hasShelfSystem) {
    return res.redirect(`/warehouses/${warehouseId}?lang=${req.getLocale()}&error=shelfSystemDisabled`);
  }
  
  // Check for duplicate shelf names within the warehouse
  const normalizedShelfName = shelfName.trim();
  if (warehouse.shelves.includes(normalizedShelfName)) {
    return res.redirect(`/warehouses/${warehouseId}?lang=${req.getLocale()}&error=shelfNameExists`);
  }
  
  // Add shelf
  warehouse.shelves.push(normalizedShelfName);
  warehouse.updatedAt = new Date().toISOString();
  
  saveWarehouses(warehouses);
  
  res.redirect(`/warehouses/${warehouseId}?lang=${req.getLocale()}&success=shelfAdded`);
});

// Delete shelf from warehouse
app.post('/warehouses/:id/shelves/del', (req: Request, res: Response) => {
  const warehouseId = parseInt(req.params.id);
  const { shelfName } = req.body;
  
  const warehouses = loadWarehouses();
  const warehouseIndex = warehouses.findIndex((w: any) => w.id === warehouseId);
  
  if (warehouseIndex === -1) {
    return res.redirect(`/warehouses?lang=${req.getLocale()}&error=notFound`);
  }
  
  const warehouse = warehouses[warehouseIndex];
  
  // Remove shelf
  const shelfIndex = warehouse.shelves.indexOf(shelfName);
  if (shelfIndex > -1) {
    warehouse.shelves.splice(shelfIndex, 1);
    warehouse.updatedAt = new Date().toISOString();
    saveWarehouses(warehouses);
  }
  
  res.redirect(`/warehouses/${warehouseId}?lang=${req.getLocale()}&success=shelfDeleted`);
});


// Stock Entry Routes
app.get('/stock', (req: Request, res: Response) => {
  res.redirect('/stock/entry');
});

app.get('/stock/entry', (req: Request, res: Response) => {
  const warehouses = loadWarehouses();
  
  res.render('stock_in', {
    title: req.__('stockIn.title'),
    currentPage: 'stock',
    locale: req.getLocale(),
    warehouses,
    __: req.__
  }, (err, html) => {
    if (err) {
      console.error('Error rendering stock entry template:', err);
      return res.status(500).send('Internal Server Error');
    }
    
    res.render('layout', {
      title: req.__('stockIn.title'),
      currentPage: 'stock',
      locale: req.getLocale(),
      body: html,
      __: req.__
    });
  });
});

// Settings and Label Designer Routes

// Label Designer page
app.get('/settings/labels', (req: Request, res: Response) => {
  const templates = loadLabelTemplates();
  
  res.render('labelDesigner', {
    templates,
    locale: req.getLocale(),
    query: req.query,
    __: req.__
  }, (err, html) => {
    if (err) {
      console.error('Error rendering label designer template:', err);
      return res.status(500).send('Internal Server Error');
    }
    
    res.render('layout', {
      title: req.__('labelDesigner.title') || 'Etiket Tasarımcısı',
      currentPage: 'labelDesigner',
      locale: req.getLocale(),
      body: html,
      __: req.__
    });
  });
});

// Settings landing page (redirect to label designer)
app.get('/settings', (req: Request, res: Response) => {
  res.redirect(`/settings/labels?lang=${req.getLocale()}`);
});

// Convenience redirect from /labels to /settings/labels
app.get('/labels', (req: Request, res: Response) => {
  res.redirect(`/settings/labels?lang=${req.getLocale()}`);
});

// Placeholder routes for other ERP modules
const placeholderRoutes = ['sales', 'accounting', 'reports', 'messages', 'users'];

placeholderRoutes.forEach(route => {
  app.get(`/${route}`, (req: Request, res: Response) => {
    const bodyContent = `
        <div class="text-center py-5">
          <div class="stats-card" style="max-width: 600px; margin: 0 auto;">
            <i class="fas fa-tools fs-1 text-muted mb-3"></i>
            <h2 class="text-muted mb-3">${req.__(`menu.${route}`)} - Coming Soon</h2>
            <p class="text-muted">Bu modül şu anda geliştirilme aşamasındadır. Yakında kullanıma sunulacaktır.</p>
            <a href="/" class="btn btn-primary">
              <i class="fas fa-arrow-left me-2"></i>
              ${req.__('menu.dashboard')}
            </a>
          </div>
        </div>
      `;
    
    res.render('layout', {
      title: req.__(`menu.${route}`),
      currentPage: route,
      locale: req.getLocale(),
      body: bodyContent,
      __: req.__
    });
  });
});

// Multer error handling middleware
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: req.__('images.sizeError') });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ error: req.__('images.limitExceeded') });
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({ error: req.__('images.typeError') });
    }
  }
  
  if (err.message && err.message.includes('formatları desteklenir')) {
    return res.status(400).json({ error: req.__('images.typeError') });
  }
  
  next(err);
});

// General error handling middleware
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  console.error('Server Error:', err);
  
  const bodyContent = `
      <div class="text-center py-5">
        <div class="stats-card" style="max-width: 600px; margin: 0 auto;">
          <i class="fas fa-exclamation-triangle fs-1 text-danger mb-3"></i>
          <h2 class="text-danger mb-3">Hata ${status}</h2>
          <p class="text-muted">${message}</p>
          <a href="/" class="btn btn-primary">
            <i class="fas fa-home me-2"></i>
            Ana Sayfaya Dön
          </a>
        </div>
      </div>
    `;
  
  res.status(status).render('layout', {
    title: 'Hata',
    currentPage: 'error',
    locale: _req.getLocale() || 'tr',
    body: bodyContent,
    __: _req.__ || ((s: string) => s)
  });
});

// Health check endpoint
app.get('/healthz', (req: Request, res: Response) => {
  res.status(200).json({ ok: true, status: 'healthy', timestamp: new Date().toISOString() });
});

// Register API routes
registerRoutes(app);

// Serve React build files
app.use('/assets', express.static(path.join(__dirname, '../dist/public/assets')));

// Products Grid page (if React needed later)
app.get('/products/grid', (req: Request, res: Response) => {
  const indexPath = path.join(__dirname, '../dist/public/index.html');
  if (fs.existsSync(indexPath)) {
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');  
    res.set('Expires', '0');
    res.sendFile(indexPath);
  } else {
    res.status(404).send('React app not found');
  }
});

// Stock Movements page route
app.get('/stock/movements', async (req: Request, res: Response) => {
  try {
    const stockMovements = await storage.getStockMovements();
    const warehouses = await storage.getWarehouses();
    const products = await storage.getAllProducts();
    
    // Enrich stock movements with product and warehouse data
    const enrichedMovements = stockMovements.map(movement => {
      const product = products.find(p => p.id === movement.productId);
      const warehouse = warehouses.find(w => w.id.toString() === movement.warehouseId);
      
      return {
        ...movement,
        productName: product?.name || `Ürün ${movement.productId}`,
        productAttributes: product?.attributes || [],
        warehouseName: warehouse?.name || `Depo ${movement.warehouseId}`
      };
    });
    
    // Sort by date descending (newest first)
    enrichedMovements.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    res.render('stock_movements', {
      title: req.__('stockMovements.title'),
      currentPage: 'stock',
      locale: req.getLocale(),
      stockMovements: enrichedMovements,
      warehouses: warehouses.filter(w => w.status === 'Aktif'),
      query: req.query,
      __: req.__
    }, (err, html) => {
      if (err) {
        console.error('Error rendering stock_movements template:', err);
        return res.status(500).send('Internal Server Error');
      }
      
      res.render('layout', {
        title: req.__('stockMovements.title'),
        currentPage: 'stock',
        locale: req.getLocale(),
        body: html,
        __: req.__
      });
    });
  } catch (error) {
    console.error('Error loading stock movements page:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Import/Export page route (EJS template)
app.get(["/import-export", "/import-export-old"], (req: Request, res: Response) => {
  console.log("Import/Export route accessed - serving EJS template");
  
  // Add cache busting headers
  res.set({
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  });
  
  const timestamp = Date.now();
  
  res.render('import_export', {
    title: req.__('importExport.title'),
    currentPage: 'import-export',
    locale: req.getLocale(),
    jsVersion: timestamp,
    cssVersion: timestamp,
    __: req.__
  }, (err, html) => {
    if (err) {
      console.error('Error rendering import_export template:', err);
      return res.status(500).send('Internal Server Error');
    }
    
    // Render layout with the import_export HTML as body
    res.render('layout', {
      title: req.__('importExport.title'),
      currentPage: 'import-export',
      locale: req.getLocale(),
      cssVersion: timestamp,
      jsVersion: timestamp,
      body: html,
      __: req.__
    });
  });
});

// Customer Management Routes
app.get('/customers', async (req: Request, res: Response) => {
  try {
    const customers = await storage.getAllCustomers();
    const customerTransactions = loadCustomerTransactions();
    
    // Render customers template to string first
    res.render('customers', {
      customers,
      customerTransactions,
      query: req.query,
      locale: req.getLocale(),
      __: req.__
    }, (err, html) => {
      if (err) {
        console.error('Error rendering customers template:', err);
        return res.status(500).send('Internal Server Error');
      }
      
      // Then render layout with the customers HTML as body
      res.render('layout', {
        title: req.__('customers.title'),
        currentPage: 'customers',
        locale: req.getLocale(),
        body: html,
        __: req.__
      });
    });
  } catch (error) {
    console.error('Customers page error:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.get('/customers/new', (req: Request, res: Response) => {
  res.render('customer-form', {
    customer: null,
    locale: req.getLocale(),
    __: req.__
  });
});

app.get('/customers/:id/edit', async (req: Request, res: Response) => {
  try {
    const customer = await storage.getCustomer(req.params.id);
    if (!customer) {
      return res.redirect('/customers?error=notFound');
    }
    res.render('customer-form', {
      customer,
      locale: req.getLocale(),
      __: req.__
    });
  } catch (error) {
    console.error('Customer edit error:', error);
    res.redirect('/customers?error=serverError');
  }
});

// Customer API Routes
app.get('/api/customers', async (req: Request, res: Response) => {
  try {
    const customers = await storage.getAllCustomers();
    res.json({ success: true, customers });
  } catch (error) {
    console.error('Get customers API error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.post('/api/customers', async (req: Request, res: Response) => {
  try {
    const customer = await storage.createCustomer(req.body);
    res.json({ success: true, customer });
  } catch (error) {
    console.error('Create customer API error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.put('/api/customers/:id', async (req: Request, res: Response) => {
  try {
    const customer = await storage.updateCustomer(req.params.id, req.body);
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }
    res.json({ success: true, customer });
  } catch (error) {
    console.error('Update customer API error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.delete('/api/customers/:id', async (req: Request, res: Response) => {
  try {
    const deleted = await storage.deleteCustomer(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Delete customer API error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.post('/api/customers/payment', async (req: Request, res: Response) => {
  try {
    const { customerId, amount, description } = req.body;
    
    const transaction = await storage.createCustomerTransaction({
      customerId,
      type: 'payment',
      amount: parseFloat(amount),
      currency: 'USD',
      description: description || 'Payment received',
      date: new Date().toISOString()
    });
    
    res.json({ success: true, transaction });
  } catch (error) {
    console.error('Payment API error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.get('/api/customers/stats', async (req: Request, res: Response) => {
  try {
    const stats = await storage.getCustomerStats();
    res.json({ success: true, stats });
  } catch (error) {
    console.error('Customer stats API error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.get('/api/customers/:id/balance', async (req: Request, res: Response) => {
  try {
    const balance = await storage.getCustomerBalance(req.params.id);
    res.json({ success: true, balance });
  } catch (error) {
    console.error('Customer balance API error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.get('/api/customers/:id/transactions', async (req: Request, res: Response) => {
  try {
    const transactions = await storage.getCustomerTransactionsByCustomerId(req.params.id);
    res.json({ success: true, transactions });
  } catch (error) {
    console.error('Customer transactions API error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});


// Routes are already imported at the top and registered

// Start server
const port = parseInt(process.env.PORT || '5000', 10);

function startServer(portToTry: number) {
  const server = app.listen(portToTry, '0.0.0.0', () => {
    const actualPort = (server.address() as any)?.port || portToTry;
    console.log(`ERP Server running on port ${actualPort}`);
    
    // Log active routes
    if (process.env.NODE_ENV === 'development') {
      console.log('Active routes:');
      console.log('  GET  / (Dashboard)');
      console.log('  GET  /products (Product Management)');
      console.log('  GET  /customers (Customer Management)');
      console.log('  GET  /customers/new (New Customer Form)');
      console.log('  GET  /customers/:id/edit (Edit Customer Form)');
      console.log('  GET  /stock/by-warehouse (Stock by Warehouse)');
      console.log('  GET  /stock/movements (Stock Movements)');
      console.log('  GET  /import-export (React Import/Export)');
      console.log('  GET  /healthz (Health Check)');
      console.log('  GET/POST/PUT/DELETE /api/customers/* (Customer API)');
      console.log('  POST /api/* (Other API Endpoints)');
    }
  });

  // Handle server errors
  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`FATAL: Port ${portToTry} is required but already in use!`);
      console.error('Please ensure port 5000 is available and try again.');
      process.exit(1);
    } else {
      throw err;
    }
  });

  return server;
}

const server = startServer(port);

// Graceful shutdown
process.on('SIGINT', () => server.close(() => process.exit(0)));
process.on('SIGTERM', () => server.close(() => process.exit(0)));
