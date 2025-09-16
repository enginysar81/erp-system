import { useState, useRef, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Download, Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Edit3, ArrowLeft } from "lucide-react";
// import { GridEditor, type GridRow, type GridColumn } from "@/components/GridEditor";
import { insertProductSchema } from "@shared/schema";
import { z } from "zod";

interface PreviewData {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  preview: Array<{
    row: any;
    rowIndex: number;
    isValid: boolean;
    errors: string[];
  }>;
  errors: Array<{
    rowNumber: number;
    errors: string[];
    data: any;
  }>;
}

interface ImportResult {
  success: boolean;
  totalProcessed: number;
  successCount: number;
  failedCount: number;
  errors: Array<{
    rowNumber: number;
    errors: string[];
    data: any;
  }>;
}

// Grid row interface for import editing - TEMPORARILY DISABLED
// interface ImportGridRow extends GridRow {
//   name: string;
//   buyPrice: string;
//   sellPrice: string;
//   currency: string;
//   buyCurrency: string;
//   sellCurrency: string;
//   stock: string;
//   unit: string;
//   status: string;
//   description: string;
//   originalRowIndex?: number;
//   validationErrors: string[];
// }

// Grid columns configuration - TEMPORARILY DISABLED
// const IMPORT_GRID_COLUMNS: GridColumn[] = [
//   { key: "name", label: "Ürün Adı", width: "200px", type: "text", required: true },
//   { key: "buyPrice", label: "Alış Fiyatı", width: "120px", type: "number", required: true },
//   { key: "sellPrice", label: "Satış Fiyatı", width: "120px", type: "number", required: true },
//   { key: "buyCurrency", label: "Alış Para Birimi", width: "120px", type: "select", options: ["USD", "EUR", "TRY"], required: true },
//   { key: "sellCurrency", label: "Satış Para Birimi", width: "120px", type: "select", options: ["USD", "EUR", "TRY"], required: true },
//   { key: "stock", label: "Stok", width: "80px", type: "number", required: true },
//   { key: "unit", label: "Birim", width: "80px", type: "select", options: ["adet", "metre"], required: true },
//   { key: "status", label: "Durum", width: "100px", type: "select", options: ["Aktif", "Pasif"], required: true },
//   { key: "description", label: "Açıklama", width: "200px", type: "text" },
// ];

export default function ImportExport() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [updateExisting, setUpdateExisting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [exportFormat, setExportFormat] = useState<"xlsx" | "csv">("xlsx");
  
  // Grid editing state - TEMPORARILY DISABLED
  // const [isGridMode, setIsGridMode] = useState(false);
  // const [gridRows, setGridRows] = useState<ImportGridRow[]>([]);
  // const [isGridSaving, setIsGridSaving] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Helper functions for grid data transformation - TEMPORARILY DISABLED
  // const transformPreviewToGrid = useCallback((preview: PreviewData): ImportGridRow[] => {
  //   return preview.preview.filter(item => item.isValid).map((item, index) => {
  //     const row = item.row;
  //     return {
  //       id: `import-${index}`,
  //       isNew: false,
  //       isEditing: false,
  //       name: row['Ürün Adı'] || '',
  //       buyPrice: String(row['Alış Fiyatı'] || '0'),
  //       sellPrice: String(row['Satış Fiyatı'] || '0'),
  //       currency: row['Para Birimi'] || 'USD',
  //       buyCurrency: row['Alış Para Birimi'] || 'USD',
  //       sellCurrency: row['Satış Para Birimi'] || 'USD',
  //       stock: String(row['Stok'] || '0'),
  //       unit: row['Birim'] || 'adet',
  //       status: row['Durum'] || 'Aktif',
  //       description: row['Açıklama'] || '',
  //       originalRowIndex: item.rowIndex,
  //       validationErrors: item.errors || []
  //     };
  //   });
  // }, []);

  // const createEmptyGridRow = useCallback((): ImportGridRow => {
  //   return {
  //     id: `new-${Date.now()}`,
  //     isNew: true,
  //     isEditing: false,
  //     name: '',
  //     buyPrice: '0',
  //     sellPrice: '0',
  //     currency: 'USD',
  //     buyCurrency: 'USD',
  //     sellCurrency: 'USD',
  //     stock: '0',
  //     unit: 'adet',
  //     status: 'Aktif',
  //     description: '',
  //     validationErrors: []
  //   };
  // }, []);

  // const validateGridRow = useCallback((row: ImportGridRow): { [key: string]: string } | null => {
  //   const errors: { [key: string]: string } = {};
  //   
  //   if (!row.name.trim()) {
  //     errors.name = "Ürün adı gerekli";
  //   }
  //   
  //   const buyPrice = parseFloat(row.buyPrice);
  //   if (isNaN(buyPrice) || buyPrice < 0) {
  //     errors.buyPrice = "Geçerli alış fiyatı giriniz";
  //   }
  //   
  //   const sellPrice = parseFloat(row.sellPrice);
  //   if (isNaN(sellPrice) || sellPrice < 0) {
  //     errors.sellPrice = "Geçerli satış fiyatı giriniz";
  //   }
  //   
  //   const stock = parseInt(row.stock);
  //   if (isNaN(stock) || stock < 0) {
  //     errors.stock = "Geçerli stok miktarı giriniz";
  //   }
  //   
  //   return Object.keys(errors).length > 0 ? errors : null;
  // }, []);

  // Download template
  const downloadTemplate = useCallback(async (format: "xlsx" | "csv") => {
    try {
      const response = await fetch(`/api/import-export/template?format=${format}`);
      if (!response.ok) throw new Error("Template download failed");
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `urun_sablonu_${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      toast({
        title: "Başarılı",
        description: `${format.toUpperCase()} şablonu indirildi`
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Hata",
        description: "Şablon indirme hatası"
      });
    }
  }, [toast]);

  // Export products
  const exportProducts = useCallback(async () => {
    try {
      const response = await fetch('/api/import-export/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          format: exportFormat
        })
      });
      
      if (!response.ok) throw new Error("Export failed");
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `urunler_${new Date().toISOString().split('T')[0]}.${exportFormat}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      toast({
        title: "Başarılı",
        description: `Ürünler ${exportFormat.toUpperCase()} formatında dışarı aktarıldı`
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Hata",
        description: "Dışarı aktarma hatası"
      });
    }
  }, [exportFormat, toast]);

  // Preview file
  const previewMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('/api/import-export/preview', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        throw new Error('Preview failed');
      }
      
      return response.json() as Promise<PreviewData>;
    },
    onSuccess: (data: PreviewData) => {
      setPreviewData(data);
      toast({
        title: "Önizleme Hazır",
        description: `${data.totalRows} satır işlendi. ${data.validRows} geçerli, ${data.invalidRows} hatalı satır bulundu.`
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Hata",
        description: "Dosya önizleme hatası"
      });
    }
  });

  // Import confirmed data
  const importMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFile) throw new Error('No file selected');
      
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('updateExisting', updateExisting.toString());
      
      const response = await fetch('/api/import-export/import', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        throw new Error('Import failed');
      }
      
      return response.json() as Promise<ImportResult>;
    },
    onSuccess: (data) => {
      setImportResult(data);
      setPreviewData(null);
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
      // Refresh products
      queryClient.invalidateQueries({ queryKey: ['products'] });
      
      toast({
        title: "İçeri Aktarma Tamamlandı",
        description: `${data.successCount} ürün başarıyla eklendi/güncellendi`
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Hata",
        description: "İçeri aktarma hatası"
      });
    }
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setPreviewData(null);
      setImportResult(null);
    }
  };

  const handlePreview = () => {
    if (selectedFile) {
      previewMutation.mutate(selectedFile);
    }
  };

  const handleConfirmImport = () => {
    importMutation.mutate();
  };

  // Grid editing handlers - TEMPORARILY DISABLED
  // const handleEditInGrid = () => {
  //   if (previewData) {
  //     const gridData = transformPreviewToGrid(previewData);
  //     setGridRows(gridData);
  //     setIsGridMode(true);
  //   }
  // };

  // const handleBackToPreview = () => {
  //   setIsGridMode(false);
  // };

  // const handleGridRowsChange = (rows: ImportGridRow[]) => {
  //   setGridRows(rows);
  // };

  // const handleGridSave = async (row: ImportGridRow) => {
  //   // For now, just validate and update the row
  //   const errors = validateGridRow(row);
  //   if (errors) {
  //     row.validationErrors = Object.values(errors);
  //     toast({
  //       variant: "destructive",
  //       title: "Doğrulama Hatası",
  //       description: Object.values(errors).join(", ")
  //     });
  //     throw new Error("Validation failed");
  //   } else {
  //     row.validationErrors = [];
  //   }
  // };

  // const handleGridDelete = async (rowId: string, rowIndex: number) => {
  //   const updatedRows = gridRows.filter((_, index) => index !== rowIndex);
  //   setGridRows(updatedRows);
  // };

  // Import from grid data - TEMPORARILY DISABLED
  // const importFromGrid = useMutation({
  //   mutationFn: async () => {
  //     setIsGridSaving(true);
  //     
  //     // Validate all rows first
  //     const validRows = gridRows.filter(row => !row.isNew);
  //     const hasErrors = validRows.some(row => {
  //       const errors = validateGridRow(row);
  //       return errors && Object.keys(errors).length > 0;
  //     });
  //     
  //     if (hasErrors) {
  //       throw new Error('Some rows have validation errors');
  //     }

  //     // Transform grid data to API format
  //     const products = validRows.map(row => ({
  //       name: row.name,
  //       buyPrice: row.buyPrice,
  //       sellPrice: row.sellPrice,
  //       currency: row.currency,
  //       buyCurrency: row.buyCurrency,
  //       sellCurrency: row.sellCurrency,
  //       stock: parseInt(row.stock),
  //       unit: row.unit,
  //       status: row.status,
  //       description: row.description,
  //       images: [],
  //       attributes: []
  //     }));

  //     const response = await fetch('/api/import-export/import-from-grid', {
  //       method: 'POST',
  //       headers: {
  //         'Content-Type': 'application/json',
  //       },
  //       body: JSON.stringify({
  //         products,
  //         updateExisting
  //       })
  //     });
  //     
  //     if (!response.ok) {
  //       throw new Error('Grid import failed');
  //     }
  //     
  //     return response.json() as Promise<ImportResult>;
  //   },
  //   onSuccess: (data) => {
  //     setImportResult(data);
  //     setIsGridMode(false);
  //     setGridRows([]);
  //     setPreviewData(null);
  //     setSelectedFile(null);
  //     setIsGridSaving(false);
  //     if (fileInputRef.current) {
  //       fileInputRef.current.value = '';
  //     }
  //     
  //     // Refresh products
  //     queryClient.invalidateQueries({ queryKey: ['products'] });
  //     
  //     toast({
  //       title: "Grid İçeri Aktarma Tamamlandı",
  //       description: `${data.successCount} ürün başarıyla eklendi/güncellendi`
  //     });
  //   },
  //   onError: (error) => {
  //     setIsGridSaving(false);
  //     toast({
  //       variant: "destructive",
  //       title: "Hata",
  //       description: "Grid içeri aktarma hatası"
  //     });
  //   }
  // });

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-foreground">
            Ürün Import/Export
          </h1>
          <p className="text-muted-foreground">
            Ürünlerinizi Excel/CSV formatında içeri/dışarı aktarın
          </p>
        </div>

        <Tabs defaultValue="export" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="export" className="flex items-center gap-2">
              <Download className="w-4 h-4" />
              Dışarı Aktar
            </TabsTrigger>
            <TabsTrigger value="import" className="flex items-center gap-2">
              <Upload className="w-4 h-4" />
              İçeri Aktar
            </TabsTrigger>
          </TabsList>

          {/* EXPORT TAB */}
          <TabsContent value="export" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Download className="w-5 h-5" />
                  Ürünleri Dışarı Aktar
                </CardTitle>
                <CardDescription>
                  Mevcut ürünlerinizi Excel veya CSV formatında indirin
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="export-format">Format Seçimi</Label>
                  <Select value={exportFormat} onValueChange={(value: "xlsx" | "csv") => setExportFormat(value)}>
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="xlsx">Excel (.xlsx)</SelectItem>
                      <SelectItem value="csv">CSV (.csv)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex gap-2">
                  <Button onClick={exportProducts} className="flex items-center gap-2">
                    <Download className="w-4 h-4" />
                    Ürünleri İndir ({exportFormat.toUpperCase()})
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* IMPORT TAB */}
          <TabsContent value="import" className="space-y-4">
            {/* Step 1: Download Template */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5" />
                  Adım 1: Şablon İndir
                </CardTitle>
                <CardDescription>
                  Önce şablon dosyasını indirin ve doldurun
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    onClick={() => downloadTemplate("xlsx")}
                    className="flex items-center gap-2"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    Excel Şablonu (.xlsx)
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => downloadTemplate("csv")}
                    className="flex items-center gap-2"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    CSV Şablonu (.csv)
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Step 2: Upload File */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="w-5 h-5" />
                  Adım 2: Doldurulmuş Dosyayı Yükle
                </CardTitle>
                <CardDescription>
                  Doldurduğunuz Excel veya CSV dosyasını seçin
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="import-file">Dosya Seçimi</Label>
                  <Input
                    id="import-file"
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.csv"
                    onChange={handleFileSelect}
                    className="cursor-pointer"
                  />
                </div>

                {selectedFile && (
                  <Alert>
                    <CheckCircle2 className="h-4 w-4" />
                    <AlertDescription>
                      Seçilen dosya: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                    </AlertDescription>
                  </Alert>
                )}

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="update-existing"
                    checked={updateExisting}
                    onCheckedChange={(checked: boolean) => setUpdateExisting(checked)}
                  />
                  <Label htmlFor="update-existing">
                    Mevcut ürünleri güncelle (aynı isimli ürünler için)
                  </Label>
                </div>

                <Button 
                  onClick={handlePreview} 
                  disabled={!selectedFile || previewMutation.isPending}
                  className="flex items-center gap-2"
                >
                  {previewMutation.isPending ? "İşleniyor..." : "Önizleme"}
                </Button>
              </CardContent>
            </Card>

            {/* Step 3: Preview Results */}
            {previewData && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5" />
                    Adım 3: Önizleme ve Onay
                  </CardTitle>
                  <CardDescription>
                    İşlenecek verileri kontrol edin ve onaylayın
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Summary */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">{previewData.totalRows}</div>
                      <div className="text-sm text-muted-foreground">Toplam Satır</div>
                    </div>
                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-2xl font-bold text-green-600">{previewData.validRows}</div>
                      <div className="text-sm text-muted-foreground">Geçerli Satır</div>
                    </div>
                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-2xl font-bold text-red-600">{previewData.invalidRows}</div>
                      <div className="text-sm text-muted-foreground">Hatalı Satır</div>
                    </div>
                  </div>

                  {/* Errors Table */}
                  {previewData.errors.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="font-semibold text-red-600 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4" />
                        Hatalı Satırlar
                      </h3>
                      <div className="max-h-60 overflow-auto border rounded-lg">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Satır No</TableHead>
                              <TableHead>Hatalar</TableHead>
                              <TableHead>Ürün Adı</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {previewData.errors.slice(0, 10).map((error, index) => (
                              <TableRow key={index}>
                                <TableCell>{error.rowNumber}</TableCell>
                                <TableCell>
                                  <div className="space-y-1">
                                    {error.errors.map((err, errIndex) => (
                                      <Badge key={errIndex} variant="destructive" className="text-xs">
                                        {err}
                                      </Badge>
                                    ))}
                                  </div>
                                </TableCell>
                                <TableCell>{error.data['Ürün Adı'] || '-'}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                      {previewData.errors.length > 10 && (
                        <p className="text-sm text-muted-foreground">
                          ...ve {previewData.errors.length - 10} hatalı satır daha
                        </p>
                      )}
                    </div>
                  )}

                  {/* Confirmation */}
                  <div className="space-y-4">
                    {previewData.validRows > 0 && (
                      <Alert>
                        <CheckCircle2 className="h-4 w-4" />
                        <AlertDescription>
                          {previewData.validRows} geçerli satır içeri aktarılmaya hazır.
                          {updateExisting ? " Mevcut ürünler güncellenecek." : " Sadece yeni ürünler eklenecek."}
                        </AlertDescription>
                      </Alert>
                    )}

                    <div className="flex gap-2">
                      {/* Grid editing button temporarily disabled */}
                      {/* <Button 
                        onClick={handleEditInGrid}
                        disabled={previewData.validRows === 0}
                        variant="outline"
                        className="flex-1 flex items-center gap-2"
                        size="lg"
                        data-testid="button-edit-grid"
                      >
                        <Edit3 className="w-4 h-4" />
                        Grid'de Düzenle
                      </Button> */}
                      
                      <Button 
                        onClick={handleConfirmImport}
                        disabled={previewData.validRows === 0 || importMutation.isPending}
                        className="w-full"
                        size="lg"
                        data-testid="button-confirm-import"
                      >
                        {importMutation.isPending ? "İçeri Aktarılıyor..." : `${previewData.validRows} Ürünü Onayla & Kaydet`}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Grid Editor Mode - TEMPORARILY DISABLED
            {isGridMode && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Edit3 className="w-5 h-5" />
                    Adım 3b: Grid'de Düzenle
                  </CardTitle>
                  <CardDescription>
                    Ürün verilerini grid üzerinde düzenleyin, doğrulayın ve kaydedin
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <Button 
                        onClick={handleBackToPreview}
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-2"
                        data-testid="button-back-preview"
                      >
                        <ArrowLeft className="w-4 h-4" />
                        Önizlemeye Dön
                      </Button>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">
                        {gridRows.filter(row => !row.isNew).length} Ürün
                      </Badge>
                      <Badge variant={gridRows.some(row => row.validationErrors.length > 0) ? "destructive" : "default"}>
                        {gridRows.filter(row => row.validationErrors.length === 0 && !row.isNew).length} Geçerli
                      </Badge>
                    </div>
                  </div>

                  <div className="border rounded-lg">
                    <GridEditor<ImportGridRow>
                      rows={gridRows}
                      columns={IMPORT_GRID_COLUMNS}
                      onRowsChange={handleGridRowsChange}
                      onSave={handleGridSave}
                      onDelete={handleGridDelete}
                      onValidate={validateGridRow}
                      isLoading={isGridSaving}
                      createEmptyRow={createEmptyGridRow}
                      className="min-h-[400px] max-h-[600px]"
                      showRowNumbers={true}
                      showDeleteButton={true}
                    />
                  </div>

                  {gridRows.some(row => row.validationErrors.length > 0) && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        Bazı satırlarda doğrulama hataları var. Lütfen tüm hataları düzeltin.
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="space-y-4">
                    {gridRows.filter(row => !row.isNew).length > 0 && (
                      <Alert>
                        <CheckCircle2 className="h-4 w-4" />
                        <AlertDescription>
                          {gridRows.filter(row => !row.isNew && row.validationErrors.length === 0).length} geçerli ürün grid'den içeri aktarılmaya hazır.
                          {updateExisting ? " Mevcut ürünler güncellenecek." : " Sadece yeni ürünler eklenecek."}
                        </AlertDescription>
                      </Alert>
                    )}

                    <Button 
                      onClick={() => importFromGrid.mutate()}
                      disabled={
                        gridRows.filter(row => !row.isNew && row.validationErrors.length === 0).length === 0 || 
                        importFromGrid.isPending ||
                        isGridSaving
                      }
                      className="w-full"
                      size="lg"
                      data-testid="button-import-grid"
                    >
                      {importFromGrid.isPending || isGridSaving 
                        ? "Grid'den İçeri Aktarılıyor..." 
                        : `${gridRows.filter(row => !row.isNew && row.validationErrors.length === 0).length} Ürünü Grid'den Kaydet`
                      }
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
            */}

            {/* Import Results */}
            {importResult && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-green-600">
                    <CheckCircle2 className="w-5 h-5" />
                    İçeri Aktarma Tamamlandı
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">{importResult.totalProcessed}</div>
                      <div className="text-sm text-muted-foreground">Toplam İşlenen</div>
                    </div>
                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-2xl font-bold text-green-600">{importResult.successCount}</div>
                      <div className="text-sm text-muted-foreground">Başarılı</div>
                    </div>
                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-2xl font-bold text-red-600">{importResult.failedCount}</div>
                      <div className="text-sm text-muted-foreground">Başarısız</div>
                    </div>
                  </div>

                  <Alert>
                    <CheckCircle2 className="h-4 w-4" />
                    <AlertDescription>
                      {importResult.successCount} ürün başarıyla eklendi/güncellendi. 
                      Ürünler listesi otomatik olarak güncellenmiştir.
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}