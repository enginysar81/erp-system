import { useState, useRef, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

// Generic row interface - any row data must extend this
export interface GridRow {
  id: string;
  isNew: boolean;
  isEditing: boolean;
  [key: string]: any;
}

// Column definition interface
export interface GridColumn {
  key: string;
  label: string;
  width?: string;
  type?: "text" | "number" | "select";
  options?: string[];
  required?: boolean;
}

// Attribute interface for dynamic columns
export interface GridAttribute {
  id: string;
  name: string;
  type: string;
  options: string[];
}

// GridEditor props interface
export interface GridEditorProps<T extends GridRow> {
  rows: T[];
  columns: GridColumn[];
  attributes?: GridAttribute[];
  onRowsChange: (rows: T[]) => void;
  onSave?: (row: T) => Promise<void>;
  onDelete?: (rowId: string, rowIndex: number) => Promise<void>;
  onValidate?: (row: T) => { [key: string]: string } | null;
  isLoading?: boolean;
  createEmptyRow: () => T;
  className?: string;
  showRowNumbers?: boolean;
  showDeleteButton?: boolean;
}

// Cell editing state interface
interface EditingCell {
  rowIndex: number;
  field: string;
}

export function GridEditor<T extends GridRow>({
  rows,
  columns,
  attributes = [],
  onRowsChange,
  onSave,
  onDelete,
  onValidate,
  isLoading = false,
  createEmptyRow,
  className = "",
  showRowNumbers = true,
  showDeleteButton = true,
}: GridEditorProps<T>) {
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleCellClick = (rowIndex: number, field: string) => {
    setEditingCell({ rowIndex, field });
  };

  const handleCellBlur = useCallback(async (rowIndex: number, field: string, value: any) => {
    setEditingCell(null);
    
    const updatedRows = [...rows];
    const row = updatedRows[rowIndex];
    
    // Update the field value
    (row as any)[field] = value;
    
    // Validate if validator is provided
    if (onValidate) {
      const errors = onValidate(row);
      if (errors && Object.keys(errors).length > 0) {
        // Could show validation errors here
        console.warn("Validation errors:", errors);
      }
    }
    
    // If this was an empty row and user entered data, save it and add new empty row
    if (row.isNew && hasData(row)) {
      // Mark as ready to save
      row.isEditing = true;
      onRowsChange(updatedRows);
      
      // Save the row if save function is provided
      if (onSave) {
        try {
          await onSave(row);
          
          // Add new empty row if this was the last row
          if (rowIndex === rows.length - 1) {
            updatedRows.push(createEmptyRow());
            onRowsChange(updatedRows);
          }
        } catch (error) {
          console.error("Save failed:", error);
        }
      }
    } else if (!row.isNew) {
      // Update existing row
      onRowsChange(updatedRows);
      if (onSave) {
        try {
          await onSave(row);
        } catch (error) {
          console.error("Update failed:", error);
        }
      }
    } else {
      // Just update state for new rows without significant data
      onRowsChange(updatedRows);
    }
  }, [rows, onRowsChange, onSave, onValidate, createEmptyRow]);

  const handleDeleteRow = async (rowId: string, rowIndex: number) => {
    if (rows[rowIndex].isNew) {
      // Just remove from local state
      const updatedRows = rows.filter((_, index) => index !== rowIndex);
      onRowsChange(updatedRows);
    } else if (onDelete) {
      // Delete from server
      try {
        await onDelete(rowId, rowIndex);
      } catch (error) {
        console.error("Delete failed:", error);
      }
    }
  };

  const hasData = (row: T): boolean => {
    // Check if row has meaningful data (customize this logic based on your needs)
    return columns.some(col => {
      const value = (row as any)[col.key];
      return value && value.toString().trim() !== "" && value !== 0;
    });
  };

  const getRowAttribute = (row: T, attributeName: string): string => {
    const rowAttributes = (row as any).attributes;
    if (!rowAttributes || !Array.isArray(rowAttributes)) return "";
    // Handle both string array and object array formats
    if (rowAttributes.length > 0 && typeof rowAttributes[0] === 'string') {
      // Legacy string array format, return empty string for now
      return "";
    }
    const attr = (rowAttributes as any[]).find((a: any) => a.name === attributeName);
    return attr?.value || "";
  };

  const setRowAttribute = (row: T, attributeName: string, value: string) => {
    if (!(row as any).attributes) (row as any).attributes = [];
    
    const rowAttributes = (row as any).attributes;
    const existingAttrIndex = rowAttributes.findIndex((a: any) => a.name === attributeName);
    const attribute = attributes.find(a => a.name === attributeName);
    
    if (existingAttrIndex >= 0) {
      rowAttributes[existingAttrIndex].value = value;
    } else if (attribute) {
      rowAttributes.push({
        attributeId: attribute.id,
        name: attributeName,
        value: value
      });
    }
  };

  const renderCell = (row: T, rowIndex: number, column: GridColumn, attributeName?: string) => {
    const isEditing = editingCell?.rowIndex === rowIndex && editingCell?.field === column.key;
    
    if (attributeName) {
      const value = getRowAttribute(row, attributeName);
      const attribute = attributes.find(a => a.name === attributeName);
      
      if (isEditing && attribute?.options) {
        return (
          <Select
            value={value}
            onValueChange={(newValue: string) => {
              setRowAttribute(row, attributeName, newValue);
              handleCellBlur(rowIndex, column.key, row);
            }}
            data-testid={`select-${column.key}-${rowIndex}`}
          >
            <SelectTrigger className="h-8 border-0 focus:ring-1 focus:ring-primary">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {attribute.options.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      }
      
      return (
        <div
          className="h-8 px-2 py-1 cursor-pointer hover:bg-muted/50 rounded text-sm flex items-center"
          onClick={() => handleCellClick(rowIndex, column.key)}
          data-testid={`cell-${column.key}-${rowIndex}`}
        >
          {value || (row.isNew ? "" : "-")}
        </div>
      );
    }

    const value = (row as any)[column.key] || "";

    if (isEditing) {
      // Handle different input types
      if (column.type === "select" && column.options) {
        return (
          <Select
            value={value}
            onValueChange={(newValue: string) => handleCellBlur(rowIndex, column.key, newValue)}
            data-testid={`select-${column.key}-${rowIndex}`}
          >
            <SelectTrigger className="h-8 border-0 focus:ring-1 focus:ring-primary">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {column.options.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      }

      // Regular text/number input
      return (
        <Input
          ref={inputRef}
          type={column.type === "number" ? "number" : "text"}
          value={value}
          onChange={(e) => {
            const updatedRows = [...rows];
            (updatedRows[rowIndex] as any)[column.key] = e.target.value;
            onRowsChange(updatedRows);
          }}
          onBlur={() => handleCellBlur(rowIndex, column.key, value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              handleCellBlur(rowIndex, column.key, value);
            }
          }}
          className="h-8 border-0 focus:ring-1 focus:ring-primary"
          autoFocus
          data-testid={`input-${column.key}-${rowIndex}`}
        />
      );
    }

    // Display mode
    return (
      <div
        className="h-8 px-2 py-1 cursor-pointer hover:bg-muted/50 rounded text-sm flex items-center"
        onClick={() => handleCellClick(rowIndex, column.key)}
        data-testid={`cell-${column.key}-${rowIndex}`}
      >
        {value || (row.isNew ? "" : "-")}
      </div>
    );
  };

  return (
    <div className={`overflow-auto border rounded-lg bg-background ${className}`}>
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            {showRowNumbers && (
              <TableHead className="w-12 text-center font-semibold">#</TableHead>
            )}
            {columns.map((col) => (
              <TableHead 
                key={col.key} 
                style={{ width: col.width }}
                className="font-semibold text-foreground"
              >
                {col.label}
              </TableHead>
            ))}
            {attributes.map((attr) => (
              <TableHead 
                key={attr.id} 
                className="font-semibold text-foreground w-32"
              >
                {attr.name}
              </TableHead>
            ))}
            {showDeleteButton && (
              <TableHead className="w-12 text-center font-semibold">İşlem</TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, index) => (
            <TableRow 
              key={row.id || `new-${index}`}
              className={`
                ${row.isNew ? 'bg-blue-50/50 dark:bg-blue-950/20' : 'hover:bg-muted/30'}
                ${index % 2 === 0 ? 'bg-background' : 'bg-muted/20'}
              `}
            >
              {/* Row number */}
              {showRowNumbers && (
                <TableCell className="text-center text-muted-foreground font-mono text-sm">
                  {row.isNew ? '•' : index + 1}
                </TableCell>
              )}
              
              {/* Base columns */}
              {columns.map((col) => (
                <TableCell key={col.key} className="p-1">
                  {renderCell(row, index, col)}
                </TableCell>
              ))}
              
              {/* Attribute columns */}
              {attributes.map((attr) => (
                <TableCell key={attr.id} className="p-1">
                  {renderCell(row, index, { key: `attr-${attr.name}`, label: attr.name }, attr.name)}
                </TableCell>
              ))}
              
              {/* Actions */}
              {showDeleteButton && (
                <TableCell className="text-center p-1">
                  {!row.isNew && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteRow(row.id!, index)}
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                      data-testid={`button-delete-${index}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default GridEditor;