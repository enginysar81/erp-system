/**
 * Enhanced Stock by Warehouse JavaScript
 * Professional ERP-level functionality with real-time filtering, export, and analytics
 */

// Safe helper function for adding event listeners
const safeAddEventListener = (selector, eventType, handler) => {
    const element = typeof selector === 'string' ? document.querySelector(selector) : selector;
    if (element) {
        element.addEventListener(eventType, handler);
        return true;
    }
    return false;
};

class StockWarehouseManager {
    constructor() {
        this.allBarcodes = [];
        this.filteredBarcodes = [];
        this.warehouses = [];
        this.stockStats = {};
        this.currentFilters = {
            warehouseId: '',
            shelfIds: [], // Changed to array for multiple shelf selection
            productName: ''
        };
        
        // Pagination properties
        this.currentPage = 1;
        this.itemsPerPage = 30;
        this.currentView = 'table'; // 'table' or 'list'
        
        // Shelf dropdown state
        this.shelfDropdownOpen = false;
        this.selectedShelves = new Set();
        
        this.init();
    }

    async init() {
        console.log('Initializing Enhanced Stock Warehouse Manager');
        
        // Extract data from the page
        this.extractPageData();
        
        // Initialize event listeners
        this.initEventListeners();
        
        // Initialize real-time filtering
        this.initRealTimeFiltering();
        
        // Set initial filtered data
        this.filteredBarcodes = [...this.allBarcodes];
        this.updateStatistics();
        this.initializePagination();
        
        console.log(`Loaded ${this.allBarcodes.length} barcodes`);
    }

    extractPageData() {
        // Extract barcodes from table rows
        this.allBarcodes = Array.from(document.querySelectorAll('#barcode-table-body tr.table-row')).map(row => {
            return {
                code: row.dataset.barcode,
                productId: row.dataset.productId,
                warehouseId: row.dataset.warehouseId,
                shelfId: row.dataset.shelfId || null,
                productName: row.dataset.productName,
                quantity: parseFloat(row.querySelector('.quantity-badge').textContent.match(/[\d.]+/)[0] || 0),
                unit: row.querySelector('.quantity-badge').textContent.includes('m') ? 'metre' : 'adet',
                attributes: this.extractAttributesFromRow(row),
                element: row
            };
        });

        // Extract warehouses from select options
        this.warehouses = Array.from(document.querySelectorAll('#warehouse-filter option')).filter(option => option.value !== '').map(option => {
            let shelves = [];
            if (option.dataset.shelves) {
                try {
                    // Decode HTML entities before parsing JSON
                    const decodedShelves = option.dataset.shelves
                        .replace(/&quot;/g, '"')
                        .replace(/&amp;/g, '&')
                        .replace(/&lt;/g, '<')
                        .replace(/&gt;/g, '>');
                    shelves = JSON.parse(decodedShelves);
                } catch (e) {
                    console.warn('Failed to parse shelves data:', e);
                    shelves = [];
                }
            }
            return {
                id: option.value,
                name: option.textContent.trim(),
                hasShelfSystem: option.dataset.hasShelf === 'true',
                shelves: shelves
            };
        });

        // Extract stock stats from page
        this.stockStats = this.extractStockStats();
    }

    extractAttributesFromRow(row) {
        const attributesCell = row.querySelector('.features-cell');
        if (!attributesCell) return [];
        
        return Array.from(attributesCell.querySelectorAll('.feature-tag')).map(tag => {
            const text = tag.textContent.trim();
            const [name, value] = text.split(': ');
            return { name: name || '', value: value || '' };
        });
    }

    extractStockStats() {
        return {
            totalBarcodes: parseInt(document.getElementById('filtered-total-barcodes')?.textContent || '0'),
            totalPieces: parseInt(document.getElementById('filtered-total-pieces')?.textContent || '0'),
            totalMeters: parseFloat(document.getElementById('filtered-total-meters')?.textContent || '0'),
            uniqueProducts: parseInt(document.getElementById('filtered-unique-products')?.textContent || '0')
        };
    }

    initEventListeners() {
        // Warehouse filter change
        safeAddEventListener('#warehouse-filter', 'change', (e) => {
            this.handleWarehouseChange(e.target.value);
        });

        // Multi-shelf selector click outside to close
        document.addEventListener('click', (e) => {
            const shelfContainer = document.querySelector('.multi-shelf-container');
            if (shelfContainer && !shelfContainer.contains(e.target)) {
                this.closeShelfDropdown();
            }
        });

        // Product search (main filter)
        safeAddEventListener('#product-search', 'input', (e) => {
            this.currentFilters.productName = e.target.value.toLowerCase();
            this.applyFilters();
        });

        // Quick product search (real-time)
        safeAddEventListener('#quick-product-search', 'input', (e) => {
            this.handleQuickProductSearch(e.target.value);
        });

        // Reset filters
        safeAddEventListener('#reset-filters', 'click', () => {
            this.clearAllFilters();
        });

        // Form submit (prevent default)
        safeAddEventListener('#filter-form', 'submit', (e) => {
            e.preventDefault();
            this.applyFilters();
        });

        // Pagination controls (safe)
        safeAddEventListener('#prev-page', 'click', () => {
            this.changePage(-1);
        });

        safeAddEventListener('#next-page', 'click', () => {
            this.changePage(1);
        });

        safeAddEventListener('#first-page', 'click', () => {
            this.goToPage(1);
        });

        safeAddEventListener('#last-page', 'click', () => {
            const totalPages = Math.ceil(this.filteredBarcodes.length / this.itemsPerPage);
            this.goToPage(totalPages);
        });

        // Items per page selector (safe)
        safeAddEventListener('#items-per-page', 'change', (e) => {
            this.changeItemsPerPage(parseInt(e.target.value));
        });

        // View toggle buttons (safe)
        document.querySelectorAll('.view-btn').forEach(btn => {
            if (btn) {
                btn.addEventListener('click', (e) => {
                    const view = e.target.dataset.view || e.target.closest('.view-btn')?.dataset?.view;
                    if (view) {
                        this.switchView(view);
                    }
                });
            }
        });

        // Export buttons (safe)
        safeAddEventListener('#export-excel', 'click', () => {
            this.exportToExcel();
        });

        safeAddEventListener('#export-csv', 'click', () => {
            this.exportToCSV();
        });
    }

    initRealTimeFiltering() {
        // Debounced search function
        const productSearch = document.getElementById('product-search');
        if (productSearch) {
            let debounceTimer;
            productSearch.addEventListener('input', (e) => {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    this.currentFilters.productName = e.target.value.toLowerCase();
                    this.applyFilters();
                }, 300);
            });
        }
    }

    handleWarehouseChange(warehouseId) {
        this.currentFilters.warehouseId = warehouseId;
        
        // Update shelf options
        this.updateShelfOptions(warehouseId);
        
        // Reset shelf selection
        this.currentFilters.shelfIds = [];
        this.selectedShelves.clear();
        this.updateShelfDisplay();
        
        // Apply filters
        this.applyFilters();
    }

    updateShelfOptions(warehouseId) {
        const shelfOptionsContainer = document.getElementById('shelf-options-container');
        if (!shelfOptionsContainer) return;

        // Clear existing options
        shelfOptionsContainer.innerHTML = '';
        
        if (!warehouseId) {
            shelfOptionsContainer.innerHTML = '<div class="no-shelves-message">Depo seçiniz</div>';
            return;
        }

        const warehouse = this.warehouses.find(w => w.id === warehouseId);
        if (warehouse && warehouse.hasShelfSystem && warehouse.shelves.length > 0) {
            warehouse.shelves.forEach(shelf => {
                const option = document.createElement('div');
                option.className = 'shelf-option';
                option.innerHTML = `
                    <label class="shelf-checkbox-label">
                        <input type="checkbox" value="${shelf}" onchange="handleShelfCheckboxChange('${shelf}', this.checked)">
                        <span class="shelf-name">${shelf}</span>
                    </label>
                `;
                shelfOptionsContainer.appendChild(option);
            });
        } else {
            shelfOptionsContainer.innerHTML = '<div class="no-shelves-message">Bu depoda raf sistemi yok</div>';
        }
    }

    // Multi-Shelf Selection Methods
    toggleShelfDropdown() {
        const dropdown = document.getElementById('shelf-dropdown');
        const arrow = document.querySelector('.dropdown-arrow');
        
        if (!dropdown) return;
        
        this.shelfDropdownOpen = !this.shelfDropdownOpen;
        
        if (this.shelfDropdownOpen) {
            dropdown.style.display = 'block';
            if (arrow) arrow.classList.add('rotated');
        } else {
            dropdown.style.display = 'none';
            if (arrow) arrow.classList.remove('rotated');
        }
    }

    closeShelfDropdown() {
        const dropdown = document.getElementById('shelf-dropdown');
        const arrow = document.querySelector('.dropdown-arrow');
        
        if (dropdown && this.shelfDropdownOpen) {
            dropdown.style.display = 'none';
            if (arrow) arrow.classList.remove('rotated');
            this.shelfDropdownOpen = false;
        }
    }

    handleShelfSelection(shelfId, isSelected) {
        if (isSelected) {
            this.selectedShelves.add(shelfId);
        } else {
            this.selectedShelves.delete(shelfId);
        }
        
        this.currentFilters.shelfIds = Array.from(this.selectedShelves);
        this.updateShelfDisplay();
        this.applyFilters();
    }

    // New method to handle checkbox changes from the template
    handleShelfCheckboxChange(shelfId, isChecked) {
        this.handleShelfSelection(shelfId, isChecked);
    }

    updateShelfDisplay() {
        const display = document.getElementById('selected-shelves-display');
        if (!display) return;
        
        const placeholder = display.querySelector('.placeholder-text');
        const tagsContainer = display.querySelector('.selected-shelves-tags');
        
        // Remove existing tags container
        if (tagsContainer) {
            tagsContainer.remove();
        }
        
        if (this.selectedShelves.size === 0) {
            if (placeholder) {
                placeholder.style.display = 'block';
                placeholder.textContent = this.currentFilters.warehouseId ? 
                    'Raf seçiniz' : 'Raf seçmek için depo seçiniz';
            }
        } else {
            if (placeholder) {
                placeholder.style.display = 'none';
            }
            
            const newTagsContainer = document.createElement('div');
            newTagsContainer.className = 'selected-shelves-tags';
            
            Array.from(this.selectedShelves).forEach(shelf => {
                const tag = document.createElement('span');
                tag.className = 'shelf-tag';
                tag.innerHTML = `
                    ${shelf}
                    <i class="fas fa-times remove" onclick="stockManager.removeShelfSelection('${shelf}')"></i>
                `;
                newTagsContainer.appendChild(tag);
            });
            
            display.insertBefore(newTagsContainer, display.querySelector('.dropdown-arrow'));
        }
    }

    removeShelfSelection(shelfId) {
        this.selectedShelves.delete(shelfId);
        this.currentFilters.shelfIds = Array.from(this.selectedShelves);
        
        // Update checkbox state
        const checkbox = document.querySelector(`input[value="${shelfId}"]`);
        if (checkbox) {
            checkbox.checked = false;
        }
        
        this.updateShelfDisplay();
        this.applyFilters();
    }

    clearSelectedShelves() {
        this.selectedShelves.clear();
        this.currentFilters.shelfIds = [];
        
        // Update all checkboxes
        document.querySelectorAll('.shelf-option input[type="checkbox"]').forEach(checkbox => {
            checkbox.checked = false;
        });
        
        this.updateShelfDisplay();
        this.applyFilters();
    }

    selectAllShelves() {
        const warehouse = this.warehouses.find(w => w.id === this.currentFilters.warehouseId);
        if (!warehouse || !warehouse.shelves) return;
        
        warehouse.shelves.forEach(shelf => {
            this.selectedShelves.add(shelf);
        });
        
        this.currentFilters.shelfIds = Array.from(this.selectedShelves);
        
        // Update all checkboxes
        document.querySelectorAll('.shelf-option input[type="checkbox"]').forEach(checkbox => {
            checkbox.checked = true;
        });
        
        this.updateShelfDisplay();
        this.applyFilters();
    }

    // Quick Shelf Selection Methods (for quick filters section - Button-based)
    toggleQuickShelfSelection(shelfId) {
        const button = document.querySelector(`[data-shelf-id="${shelfId}"]`);
        if (!button) return;
        
        const isSelected = this.selectedShelves.has(shelfId);
        
        if (isSelected) {
            this.selectedShelves.delete(shelfId);
            button.classList.remove('selected');
        } else {
            this.selectedShelves.add(shelfId);
            button.classList.add('selected');
        }
        
        this.currentFilters.shelfIds = Array.from(this.selectedShelves);
        
        // Sync with main shelf dropdown if open
        this.syncShelfSelections();
        this.updateShelfDisplay();
        this.applyFilters();
    }

    // Legacy method for backwards compatibility - now redirects to button method
    handleQuickShelfSelection(shelfId, isSelected) {
        // For any remaining checkbox functionality
        if (isSelected) {
            this.selectedShelves.add(shelfId);
        } else {
            this.selectedShelves.delete(shelfId);
        }
        
        this.currentFilters.shelfIds = Array.from(this.selectedShelves);
        this.syncShelfSelections();
        this.updateShelfDisplay();
        this.applyFilters();
    }

    selectAllQuickShelves() {
        // Get all available shelves from quick filters (buttons)
        const quickShelfButtons = document.querySelectorAll('.quick-shelf-btn');
        
        quickShelfButtons.forEach(button => {
            const shelfId = button.dataset.shelfId;
            if (shelfId) {
                this.selectedShelves.add(shelfId);
                button.classList.add('selected');
            }
        });
        
        // Also handle any remaining checkboxes for backwards compatibility
        const quickShelfCheckboxes = document.querySelectorAll('.shelf-checkbox');
        quickShelfCheckboxes.forEach(checkbox => {
            const shelfId = checkbox.dataset.shelfId;
            if (shelfId) {
                this.selectedShelves.add(shelfId);
                checkbox.checked = true;
            }
        });
        
        this.currentFilters.shelfIds = Array.from(this.selectedShelves);
        this.syncShelfSelections();
        this.updateShelfDisplay();
        this.applyFilters();
    }

    clearAllQuickShelves() {
        // Clear all quick shelf selections (buttons)
        const quickShelfButtons = document.querySelectorAll('.quick-shelf-btn');
        
        quickShelfButtons.forEach(button => {
            const shelfId = button.dataset.shelfId;
            if (shelfId) {
                this.selectedShelves.delete(shelfId);
                button.classList.remove('selected');
            }
        });
        
        // Also handle any remaining checkboxes for backwards compatibility
        const quickShelfCheckboxes = document.querySelectorAll('.shelf-checkbox');
        quickShelfCheckboxes.forEach(checkbox => {
            checkbox.checked = false;
            const shelfId = checkbox.dataset.shelfId;
            if (shelfId) {
                this.selectedShelves.delete(shelfId);
            }
        });
        
        this.currentFilters.shelfIds = [];
        this.syncShelfSelections();
        this.updateShelfDisplay();
        this.applyFilters();
    }

    // Quick Product Search Methods
    handleQuickProductSearch(searchValue) {
        const trimmedValue = searchValue.trim();
        this.currentFilters.productName = trimmedValue.toLowerCase();
        
        // Show/hide clear button
        const clearButton = document.getElementById('quick-search-clear');
        if (clearButton) {
            clearButton.style.display = trimmedValue ? 'block' : 'none';
        }
        
        // Also sync with main product search if it exists
        const mainProductSearch = document.getElementById('product-search');
        if (mainProductSearch && mainProductSearch.value !== searchValue) {
            mainProductSearch.value = searchValue;
        }
        
        // Apply filters with debouncing
        if (this.quickSearchTimeout) {
            clearTimeout(this.quickSearchTimeout);
        }
        
        this.quickSearchTimeout = setTimeout(() => {
            this.applyFilters();
        }, 300); // 300ms debounce
    }

    clearQuickSearch() {
        const quickSearchInput = document.getElementById('quick-product-search');
        const mainProductSearch = document.getElementById('product-search');
        const clearButton = document.getElementById('quick-search-clear');
        
        if (quickSearchInput) {
            quickSearchInput.value = '';
        }
        
        if (mainProductSearch) {
            mainProductSearch.value = '';
        }
        
        if (clearButton) {
            clearButton.style.display = 'none';
        }
        
        this.currentFilters.productName = '';
        this.applyFilters();
    }

    syncShelfSelections() {
        // Sync selection state between quick filters and main dropdown
        document.querySelectorAll('.shelf-option input[type="checkbox"]').forEach(checkbox => {
            const shelfId = checkbox.value;
            checkbox.checked = this.selectedShelves.has(shelfId);
        });
    }

    // Pagination Methods
    initializePagination() {
        this.updatePagination();
    }

    updatePagination() {
        const totalItems = this.filteredBarcodes.length;
        const totalPages = Math.ceil(totalItems / this.itemsPerPage);
        
        // Update pagination info
        const paginationInfo = document.getElementById('pagination-info');
        if (paginationInfo) {
            const startItem = (this.currentPage - 1) * this.itemsPerPage + 1;
            const endItem = Math.min(this.currentPage * this.itemsPerPage, totalItems);
            paginationInfo.textContent = `${startItem}-${endItem} / ${totalItems} kayıt`;
        }
        
        // Update pagination buttons
        const prevBtn = document.getElementById('prev-page');
        const nextBtn = document.getElementById('next-page');
        
        if (prevBtn) {
            prevBtn.disabled = this.currentPage <= 1;
        }
        
        if (nextBtn) {
            nextBtn.disabled = this.currentPage >= totalPages;
        }
        
        // Update page numbers
        this.renderPageNumbers(totalPages);
        
        // Hide pagination if not needed
        const paginationContainer = document.getElementById('pagination-container');
        if (paginationContainer) {
            paginationContainer.style.display = totalPages > 1 ? 'flex' : 'none';
        }
    }

    renderPageNumbers(totalPages) {
        const numbersContainer = document.getElementById('pagination-numbers');
        if (!numbersContainer) return;
        
        numbersContainer.innerHTML = '';
        
        // Show max 5 page numbers around current page
        let startPage = Math.max(1, this.currentPage - 2);
        let endPage = Math.min(totalPages, startPage + 4);
        
        if (endPage - startPage < 4) {
            startPage = Math.max(1, endPage - 4);
        }
        
        for (let i = startPage; i <= endPage; i++) {
            const pageBtn = document.createElement('button');
            pageBtn.className = `page-number ${i === this.currentPage ? 'active' : ''}`;
            pageBtn.textContent = i;
            pageBtn.onclick = () => this.goToPage(i);
            numbersContainer.appendChild(pageBtn);
        }
    }

    goToPage(page) {
        const totalPages = Math.ceil(this.filteredBarcodes.length / this.itemsPerPage);
        if (page < 1 || page > totalPages) return;
        
        this.currentPage = page;
        this.updateTable();
        this.updatePagination();
    }

    changePage(direction) {
        const newPage = this.currentPage + direction;
        this.goToPage(newPage);
    }

    changeItemsPerPage(itemsPerPage) {
        this.itemsPerPage = parseInt(itemsPerPage);
        this.currentPage = 1; // Reset to first page
        this.updateTable();
        this.updatePagination();
    }

    // View Toggle Methods
    switchView(view) {
        this.currentView = view;
        
        // Update button states
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.view === view) {
                btn.classList.add('active');
            }
        });
        
        // Switch between table and list view
        const tableWrapper = document.querySelector('.table-wrapper');
        const listContainer = document.querySelector('.barcode-list');
        
        if (view === 'table') {
            if (tableWrapper) tableWrapper.style.display = 'block';
            if (listContainer) listContainer.style.display = 'none';
        } else {
            if (tableWrapper) tableWrapper.style.display = 'none';
            if (listContainer) listContainer.style.display = 'block';
            this.renderListView();
        }
    }

    renderListView() {
        let listContainer = document.querySelector('.barcode-list');
        
        if (!listContainer) {
            listContainer = document.createElement('div');
            listContainer.className = 'barcode-list';
            document.querySelector('.results-container').appendChild(listContainer);
        }
        
        listContainer.innerHTML = '';
        
        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        const pageItems = this.filteredBarcodes.slice(startIndex, endIndex);
        
        pageItems.forEach(barcode => {
            const warehouse = this.warehouses.find(w => w.id === barcode.warehouseId);
            const item = document.createElement('div');
            item.className = 'barcode-item';
            item.onclick = () => openBarcodeModal(barcode.code);
            
            item.innerHTML = `
                <div class="barcode-item-header">
                    <div class="barcode-item-title">${barcode.productName}</div>
                    <div class="barcode-item-code">${barcode.code}</div>
                </div>
                <div class="barcode-item-details">
                    <div><strong>${window.i18nUnits?.quantity || 'Miktar'}:</strong> ${barcode.quantity} ${barcode.unit === 'metre' ? window.i18nUnits?.meters || 'm' : window.i18nUnits?.pieces || 'adet'}</div>
                    <div><strong>Depo:</strong> ${warehouse ? warehouse.name : 'N/A'}</div>
                    <div><strong>Raf:</strong> ${barcode.shelfId || '-'}</div>
                </div>
            `;
            
            listContainer.appendChild(item);
        });
    }

    applyFilters() {
        this.filteredBarcodes = this.allBarcodes.filter(barcode => {
            // Warehouse filter
            if (this.currentFilters.warehouseId && barcode.warehouseId !== this.currentFilters.warehouseId) {
                return false;
            }
            
            // Shelf filter (multiple shelves)
            if (this.currentFilters.shelfIds.length > 0 && 
                !this.currentFilters.shelfIds.includes(barcode.shelfId)) {
                return false;
            }
            
            // Product name search
            if (this.currentFilters.productName && 
                !barcode.productName.toLowerCase().includes(this.currentFilters.productName)) {
                return false;
            }
            
            return true;
        });

        this.currentPage = 1; // Reset to first page when filtering
        this.updateTable();
        this.updateStatistics();
        this.updateActiveFilters();
        this.updateQuickFilterStates();
        this.updatePagination();
    }

    updateTable() {
        const tableBody = document.getElementById('barcode-table-body');
        const noResults = document.getElementById('no-results');
        
        if (!tableBody) return;

        // Hide all rows first
        this.allBarcodes.forEach(barcode => {
            if (barcode.element) {
                barcode.element.style.display = 'none';
            }
        });

        // Show filtered rows with pagination
        if (this.filteredBarcodes.length > 0) {
            const startIndex = (this.currentPage - 1) * this.itemsPerPage;
            const endIndex = startIndex + this.itemsPerPage;
            const pageItems = this.filteredBarcodes.slice(startIndex, endIndex);
            
            pageItems.forEach(barcode => {
                if (barcode.element) {
                    barcode.element.style.display = '';
                }
            });
            
            if (noResults) noResults.style.display = 'none';
            
            // Update list view if active
            if (this.currentView === 'list') {
                this.renderListView();
            }
        } else {
            if (noResults) noResults.style.display = 'block';
        }
    }

    updateStatistics() {
        const totalBarcodes = this.filteredBarcodes.length;
        const totalPieces = this.filteredBarcodes
            .filter(b => b.unit === 'adet')
            .reduce((sum, b) => sum + b.quantity, 0);
        const totalMeters = this.filteredBarcodes
            .filter(b => b.unit === 'metre')
            .reduce((sum, b) => sum + b.quantity, 0);
        const uniqueProducts = new Set(this.filteredBarcodes.map(b => b.productId)).size;

        // Update stat cards
        const elements = {
            'filtered-total-barcodes': totalBarcodes,
            'filtered-total-pieces': totalPieces,
            'filtered-total-meters': totalMeters.toFixed(2),
            'filtered-unique-products': uniqueProducts
        };

        Object.entries(elements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = value;
                this.animateNumberChange(element);
            }
        });

        // Update header stats
        const totalRecords = document.getElementById('total-records');
        if (totalRecords) {
            totalRecords.innerHTML = `<i class="fas fa-box"></i> ${totalBarcodes} Kayıt Gösteriliyor`;
        }
    }

    animateNumberChange(element) {
        element.style.transform = 'scale(1.1)';
        element.style.transition = 'transform 0.2s ease';
        setTimeout(() => {
            element.style.transform = 'scale(1)';
        }, 200);
    }

    updateActiveFilters() {
        const activeFiltersContainer = document.getElementById('active-filters');
        const activeFiltersList = document.querySelector('.active-filters-list');
        
        if (!activeFiltersContainer || !activeFiltersList) return;

        const activeFilters = [];
        
        if (this.currentFilters.warehouseId) {
            const warehouse = this.warehouses.find(w => w.id === this.currentFilters.warehouseId);
            if (warehouse) {
                activeFilters.push({
                    type: 'warehouse',
                    label: `Depo: ${warehouse.name}`,
                    value: this.currentFilters.warehouseId
                });
            }
        }
        
        if (this.currentFilters.shelfIds.length > 0) {
            activeFilters.push({
                type: 'shelf',
                label: `Raflar: ${this.currentFilters.shelfIds.join(', ')}`,
                value: this.currentFilters.shelfIds.join(',')
            });
        }
        
        if (this.currentFilters.productName) {
            activeFilters.push({
                type: 'product',
                label: `Ürün: "${this.currentFilters.productName}"`,
                value: this.currentFilters.productName
            });
        }

        if (activeFilters.length > 0) {
            activeFiltersList.innerHTML = activeFilters.map(filter => `
                <div class="active-filter-tag">
                    <span>${filter.label}</span>
                    <button type="button" onclick="stockManager.removeFilter('${filter.type}')">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `).join('');
            activeFiltersContainer.style.display = 'block';
        } else {
            activeFiltersContainer.style.display = 'none';
        }
    }

    updateQuickFilterStates() {
        // Update quick filter button states
        document.querySelectorAll('.quick-filter-btn').forEach(btn => {
            btn.classList.remove('active');
        });

        if (this.currentFilters.warehouseId) {
            const warehouseBtn = document.querySelector(`[data-warehouse-id="${this.currentFilters.warehouseId}"]`);
            if (warehouseBtn) warehouseBtn.classList.add('active');
        }

        if (this.currentFilters.shelfId) {
            const shelfBtn = document.querySelector(`[data-shelf-id="${this.currentFilters.shelfId}"]`);
            if (shelfBtn) shelfBtn.classList.add('active');
        }
    }

    removeFilter(type) {
        switch (type) {
            case 'warehouse':
                this.currentFilters.warehouseId = '';
                this.currentFilters.shelfIds = []; // Also clear shelves
                const warehouseFilter = document.getElementById('warehouse-filter');
                if (warehouseFilter) {
                    warehouseFilter.value = '';
                }
                this.selectedShelves.clear();
                this.updateShelfOptions('');
                this.updateShelfDisplay();
                break;
            case 'shelf':
                this.currentFilters.shelfIds = [];
                this.selectedShelves.clear();
                this.updateShelfDisplay();
                // Uncheck all shelf checkboxes
                document.querySelectorAll('.shelf-option input[type="checkbox"]').forEach(checkbox => {
                    checkbox.checked = false;
                });
                break;
            case 'product':
                this.currentFilters.productName = '';
                const productSearch = document.getElementById('product-search');
                if (productSearch) {
                    productSearch.value = '';
                }
                break;
        }
        this.applyFilters();
    }

    // Quick filter functions
    quickFilterWarehouse(warehouseId) {
        const warehouseFilter = document.getElementById('warehouse-filter');
        if (warehouseFilter) {
            warehouseFilter.value = warehouseId;
            this.handleWarehouseChange(warehouseId);
        }
    }

    quickFilterShelf(shelfId) {
        // Find warehouse for this shelf
        const barcode = this.allBarcodes.find(b => b.shelfId === shelfId);
        if (barcode) {
            const warehouseFilter = document.getElementById('warehouse-filter');
            if (warehouseFilter) {
                warehouseFilter.value = barcode.warehouseId;
                this.handleWarehouseChange(barcode.warehouseId);
                setTimeout(() => {
                    // Add shelf to selected shelves
                    this.selectedShelves.add(shelfId);
                    this.currentFilters.shelfIds = [shelfId];
                    
                    // Update checkbox if it exists
                    const checkbox = document.querySelector(`input[value="${shelfId}"]`);
                    if (checkbox) {
                        checkbox.checked = true;
                    }
                    
                    this.updateShelfDisplay();
                    this.applyFilters();
                }, 100);
            }
        }
    }

    clearAllFilters() {
        this.currentFilters = {
            warehouseId: '',
            shelfIds: [],
            productName: ''
        };
        
        const warehouseFilter = document.getElementById('warehouse-filter');
        if (warehouseFilter) {
            warehouseFilter.value = '';
        }
        
        const productSearch = document.getElementById('product-search');
        if (productSearch) {
            productSearch.value = '';
        }
        
        this.selectedShelves.clear();
        this.updateShelfOptions('');
        this.updateShelfDisplay();
        this.applyFilters();
    }

    // Export functionality
    exportToExcel() {
        const data = this.prepareExportData();
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Stock by Warehouse");
        
        const fileName = `stock_by_warehouse_${new Date().toISOString().split('T')[0]}.xlsx`;
        XLSX.writeFile(wb, fileName);
    }

    exportToCSV() {
        const data = this.prepareExportData();
        const csv = this.jsonToCSV(data);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `stock_by_warehouse_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    prepareExportData() {
        return this.filteredBarcodes.map(barcode => {
            const warehouse = this.warehouses.find(w => w.id === barcode.warehouseId);
            const attributes = barcode.attributes.map(attr => `${attr.name}: ${attr.value}`).join(', ');
            
            return {
                'Barkod': barcode.code,
                'Ürün Adı': barcode.productName,
                'Özellikler': attributes || '-',
                'Miktar': `${barcode.quantity} ${barcode.unit === 'metre' ? window.i18nUnits?.meters || 'm' : window.i18nUnits?.pieces || 'adet'}`,
                'Depo': warehouse ? warehouse.name : 'N/A',
                'Raf': barcode.shelfId || '-',
                'Birim': barcode.unit === 'metre' ? window.i18nUnits?.unitMetre || 'Metre' : window.i18nUnits?.unitAdet || 'Adet',
                'Miktar (Sayı)': barcode.quantity
            };
        });
    }

    jsonToCSV(jsonData) {
        if (!jsonData.length) return '';
        
        const headers = Object.keys(jsonData[0]);
        const csvContent = [
            headers.join(','),
            ...jsonData.map(row => 
                headers.map(header => 
                    `"${String(row[header]).replace(/"/g, '""')}"`
                ).join(',')
            )
        ].join('\n');
        
        return csvContent;
    }

}

// Global functions for onclick handlers
function quickFilterWarehouse(warehouseId) {
    if (window.stockManager) {
        window.stockManager.quickFilterWarehouse(warehouseId);
    }
}

function quickFilterShelf(shelfId) {
    if (window.stockManager) {
        window.stockManager.quickFilterShelf(shelfId);
    }
}

function clearAllFilters() {
    if (window.stockManager) {
        window.stockManager.clearAllFilters();
    }
}

function exportToExcel() {
    if (window.stockManager) {
        window.stockManager.exportToExcel();
    }
}

function exportToCSV() {
    if (window.stockManager) {
        window.stockManager.exportToCSV();
    }
}


// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('Initializing Enhanced Stock Warehouse System');
    window.stockManager = new StockWarehouseManager();
});

// Global functions for HTML onclick handlers
function toggleShelfDropdown() {
    if (window.stockManager) {
        window.stockManager.toggleShelfDropdown();
    }
}

function clearSelectedShelves() {
    if (window.stockManager) {
        window.stockManager.clearSelectedShelves();
    }
}

function selectAllShelves() {
    if (window.stockManager) {
        window.stockManager.selectAllShelves();
    }
}

function changePage(direction) {
    if (window.stockManager) {
        window.stockManager.changePage(direction);
    }
}

function changeItemsPerPage(itemsPerPage) {
    if (window.stockManager) {
        window.stockManager.changeItemsPerPage(itemsPerPage);
    }
}

function switchView(view) {
    if (window.stockManager) {
        window.stockManager.switchView(view);
    }
}

// Make sure stockManager is available globally for onclick handlers
function handleShelfCheckboxChange(shelfId, isChecked) {
    if (window.stockManager) {
        window.stockManager.handleShelfCheckboxChange(shelfId, isChecked);
    }
}

// Add XLSX library check
if (typeof XLSX === 'undefined') {
    console.warn('XLSX library not loaded. Excel export will not work.');
    // Load XLSX library dynamically
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    document.head.appendChild(script);
}