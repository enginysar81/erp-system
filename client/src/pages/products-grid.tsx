import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Search, Grid3X3, Upload } from "lucide-react";
import GridEditor, { type GridRow, type GridColumn, type GridAttribute } from "@/components/GridEditor";
import type { Product, InsertProduct } from "@shared/schema";

interface GridProduct extends GridRow {
  name: string;
  buyPrice: string;
  sellPrice: string;
  currency: string;
  buyCurrency: string;
  sellCurrency: string;
  stock: number;
  unit: string;
  status: string;
  description: string | null;
  coverImage: string | null;
  images: string[] | null;
  attributes: string[] | null;
}

const CURRENCY_OPTIONS = ["USD", "PLN", "UAH"];
const UNIT_OPTIONS = ["adet", "metre"];
const STATUS_OPTIONS = ["Aktif", "Pasif"];

// Column definitions for the grid
const PRODUCT_COLUMNS: GridColumn[] = [
  { key: "name", label: "Ürün Adı", width: "200px", type: "text", required: true },
  { key: "description", label: "Açıklama", width: "180px", type: "text" },
  { key: "unit", label: "Birim", width: "100px", type: "select", options: UNIT_OPTIONS },
  { key: "buyPrice", label: "Alış Fiyatı", width: "120px", type: "number" },
  { key: "sellPrice", label: "Satış Fiyatı", width: "120px", type: "number" },
  { key: "buyCurrency", label: "Alış Para Birimi", width: "140px", type: "select", options: CURRENCY_OPTIONS },
  { key: "sellCurrency", label: "Satış Para Birimi", width: "140px", type: "select", options: CURRENCY_OPTIONS },
  { key: "status", label: "Durum", width: "100px", type: "select", options: STATUS_OPTIONS },
];

export default function ProductsGrid() {
  const [products, setProducts] = useState<GridProduct[]>([]);
  const [attributes, setAttributes] = useState<GridAttribute[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredProducts, setFilteredProducts] = useState<GridProduct[]>([]);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch products
  const { data: productsData, isLoading: productsLoading } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  // Fetch attributes for dynamic columns
  const { data: attributesData } = useQuery<GridAttribute[]>({
    queryKey: ["/data/attributes.json"],
    queryFn: async () => {
      const response = await fetch('/data/attributes.json');
      if (!response.ok) throw new Error('Failed to fetch attributes');
      return response.json();
    }
  });

  // Initialize data when fetched
  useEffect(() => {
    if (productsData) {
      const gridProducts = productsData.map(p => ({ ...p, isNew: false, isEditing: false }));
      // Always add one empty row at the end
      gridProducts.push(createEmptyProduct());
      setProducts(gridProducts);
    }
  }, [productsData]);

  useEffect(() => {
    if (attributesData) {
      setAttributes(attributesData);
    }
  }, [attributesData]);

  // Filter products based on search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredProducts(products);
    } else {
      const filtered = products.filter(product =>
        product.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.description?.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredProducts(filtered);
    }
  }, [products, searchQuery]);

  const createEmptyProduct = (): GridProduct => ({
    id: "",
    name: "",
    description: "",
    buyPrice: "0",
    sellPrice: "0",
    currency: "USD",
    buyCurrency: "USD",
    sellCurrency: "USD",
    stock: 0,
    unit: "adet",
    status: "Aktif",
    coverImage: null,
    images: [],
    attributes: [],
    isNew: true,
    isEditing: false
  });

  // Save product handler
  const handleSaveProduct = async (product: GridProduct): Promise<void> => {
    try {
      if (product.isNew) {
        // Create new product
        const { isNew, isEditing, ...productData } = product;
        await apiRequest("POST", "/api/products", productData);
      } else {
        // Update existing product
        const { isNew, isEditing, ...productData } = product;
        await apiRequest("PATCH", `/api/products/${product.id}`, productData);
      }
      
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({
        title: "Başarılı",
        description: "Ürün kaydedildi",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Hata",
        description: "Ürün kaydedilemedi",
      });
      throw error;
    }
  };

  // Delete product handler
  const handleDeleteProduct = async (productId: string, rowIndex: number): Promise<void> => {
    try {
      await apiRequest("DELETE", `/api/products/${productId}`);
      
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({
        title: "Başarılı",
        description: "Ürün silindi",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Hata",
        description: "Ürün silinemedi",
      });
      throw error;
    }
  };

  // Product validation handler
  const handleValidateProduct = (product: GridProduct): { [key: string]: string } | null => {
    const errors: { [key: string]: string } = {};
    
    if (!product.name || product.name.trim() === "") {
      errors.name = "Ürün adı gereklidir";
    }
    
    if (product.buyPrice && isNaN(Number(product.buyPrice))) {
      errors.buyPrice = "Geçerli bir fiyat giriniz";
    }
    
    if (product.sellPrice && isNaN(Number(product.sellPrice))) {
      errors.sellPrice = "Geçerli bir fiyat giriniz";
    }
    
    return Object.keys(errors).length > 0 ? errors : null;
  };




  if (productsLoading) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-foreground">Ürün Grid Editörü</h1>
            <p className="text-muted-foreground mt-2">Veriler yükleniyor...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-foreground flex items-center justify-center gap-2">
            <Grid3X3 className="w-8 h-8" />
            Ürün Grid Editörü
          </h1>
          <p className="text-muted-foreground">
            Excel benzeri tablo editörü ile ürünlerinizi yönetin
          </p>
        </div>

        {/* Controls */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Search className="w-5 h-5" />
              Arama ve Filtreler
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4 items-center">
              <div className="flex-1">
                <Label htmlFor="search">Ürün Ara</Label>
                <Input
                  id="search"
                  type="text"
                  placeholder="Ürün adı veya açıklama ile ara..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="mt-1"
                  data-testid="input-search"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => window.location.href = '/import-export'}
                  className="flex items-center gap-2"
                  data-testid="button-import-export"
                >
                  <Upload className="w-4 h-4" />
                  Import/Export
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Grid */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Ürün Tablosu ({filteredProducts.length - 1} ürün)</span>
              <div className="text-sm text-muted-foreground">
                Düzenlemek için hücreye çift tıklayın
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <GridEditor<GridProduct>
              rows={filteredProducts}
              columns={PRODUCT_COLUMNS}
              attributes={attributes}
              onRowsChange={setProducts}
              onSave={handleSaveProduct}
              onDelete={handleDeleteProduct}
              onValidate={handleValidateProduct}
              isLoading={productsLoading}
              createEmptyRow={createEmptyProduct}
              showRowNumbers={true}
              showDeleteButton={true}
            />
            
            {/* Grid Info */}
            <div className="mt-4 text-sm text-muted-foreground space-y-1">
              <p>• Son satır her zaman yeni ürün eklemek için boş bırakılır</p>
              <p>• Değişiklikler otomatik olarak kaydedilir</p>
              <p>• Dropdown alanlar için hücreye tıklayarak seçenekleri görün</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}