import fs from 'fs';

// Read the products file
const productsData = fs.readFileSync('data/products.json', 'utf8');
const products = JSON.parse(productsData);

// Add unit field to products that don't have it
const updatedProducts = products.map(product => {
  if (!product.unit) {
    product.unit = "adet";
  }
  return product;
});

// Write back to file
fs.writeFileSync('data/products.json', JSON.stringify(updatedProducts, null, 2));

console.log(`Updated ${updatedProducts.length} products with unit field`);