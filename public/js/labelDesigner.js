// Label Designer JavaScript
document.addEventListener('DOMContentLoaded', function() {
    console.log('StockIn.JS loading');
    if (document.getElementById('labelCanvas')) {
        console.log('DOM Content Loaded - StockIn.JS initializing');
        initLabelDesigner();
    }
});

// Global variables for label designer
let currentTemplate = null;
let selectedElement = null;
let isDragging = false;
let isResizing = false;
let dragOffset = { x: 0, y: 0 };
let resizeHandle = null;
let canvasScale = 1;
let gridSize = 5; // 5mm grid
let templates = [];

// Initialize Label Designer
function initLabelDesigner() {
    console.log('Form action cleared');
    
    // Get DOM elements
    const canvas = document.getElementById('labelCanvas');
    const templateList = document.getElementById('templateList');
    const draggableFields = document.getElementById('draggableFields');
    const templateName = document.getElementById('templateName');
    const templateWidth = document.getElementById('templateWidth');
    const templateHeight = document.getElementById('templateHeight');
    
    if (!canvas || !templateList || !draggableFields) {
        console.error('Required elements not found');
        return;
    }

    // Initialize notification styles
    addNotificationStyles();
    
    // Initialize canvas settings
    setupCanvas();
    
    // Load existing templates
    loadTemplates();
    
    // Setup event listeners
    setupEventListeners();
    
    // Setup drag and drop
    setupDragAndDrop();
    
    // Setup toolbar actions
    setupToolbarActions();
    
    // Setup canvas controls
    setupCanvasControls();
    
    // Add import/export buttons to toolbar
    addImportExportButtons();
    
    console.log('Label Designer initialized successfully');
}

// Add import/export buttons to toolbar
function addImportExportButtons() {
    const toolbar = document.querySelector('.toolbar-actions');
    if (!toolbar) return;
    
    // Add export button
    const exportBtn = document.createElement('button');
    exportBtn.type = 'button';
    exportBtn.className = 'btn btn-outline';
    exportBtn.innerHTML = '<i class="fas fa-download"></i> Export';
    exportBtn.setAttribute('data-testid', 'button-export-template');
    exportBtn.addEventListener('click', exportTemplate);
    
    // Add import button
    const importBtn = document.createElement('button');
    importBtn.type = 'button';
    importBtn.className = 'btn btn-outline';
    importBtn.innerHTML = '<i class="fas fa-upload"></i> Import';
    importBtn.setAttribute('data-testid', 'button-import-template');
    importBtn.addEventListener('click', importTemplate);
    
    // Insert before the back button
    const backBtn = toolbar.querySelector('[data-testid="button-back-to-settings"]');
    if (backBtn) {
        toolbar.insertBefore(exportBtn, backBtn);
        toolbar.insertBefore(importBtn, backBtn);
    } else {
        toolbar.appendChild(importBtn);
        toolbar.appendChild(exportBtn);
    }
}

// Setup Canvas
function setupCanvas() {
    const canvas = document.getElementById('labelCanvas');
    const canvasContainer = document.getElementById('canvasContainer');
    const grid = document.getElementById('canvasGrid');
    
    // Initial canvas size (60mm x 40mm default)
    updateCanvasSize(60, 40);
    
    // Setup canvas styles
    canvas.style.position = 'relative';
    canvas.style.border = '2px solid var(--primary)';
    canvas.style.borderRadius = '4px';
    canvas.style.backgroundColor = '#ffffff';
    canvas.style.overflow = 'hidden';
    
    // Setup grid
    drawGrid();
}

// Update canvas size based on template dimensions
function updateCanvasSize(width, height) {
    const canvas = document.getElementById('labelCanvas');
    const dimensionsSpan = document.getElementById('canvasDimensions');
    
    // Convert mm to pixels (at 96 DPI: 1mm = 3.78px, but we'll use 4px for easier calculation)
    const pixelWidth = width * 4 * canvasScale;
    const pixelHeight = height * 4 * canvasScale;
    
    canvas.style.width = pixelWidth + 'px';
    canvas.style.height = pixelHeight + 'px';
    
    // Update data attributes for calculations
    canvas.dataset.widthMm = width;
    canvas.dataset.heightMm = height;
    
    // Update dimensions display
    if (dimensionsSpan) {
        dimensionsSpan.textContent = `${width}mm x ${height}mm`;
    }
    
    // Redraw grid
    drawGrid();
}

// Draw grid on canvas
function drawGrid() {
    const canvas = document.getElementById('labelCanvas');
    const grid = document.getElementById('canvasGrid');
    
    if (!canvas || !grid) return;
    
    const width = parseInt(canvas.dataset.widthMm) || 60;
    const height = parseInt(canvas.dataset.heightMm) || 40;
    
    // Clear existing grid
    grid.innerHTML = '';
    
    // Grid container setup
    grid.style.position = 'absolute';
    grid.style.top = '0';
    grid.style.left = '0';
    grid.style.width = '100%';
    grid.style.height = '100%';
    grid.style.pointerEvents = 'none';
    grid.style.zIndex = '1';
    
    // Create grid pattern using CSS
    grid.style.backgroundImage = `
        linear-gradient(to right, rgba(0,0,0,0.1) 1px, transparent 1px),
        linear-gradient(to bottom, rgba(0,0,0,0.1) 1px, transparent 1px)
    `;
    grid.style.backgroundSize = `${gridSize * 4 * canvasScale}px ${gridSize * 4 * canvasScale}px`;
}

// Load templates from server
async function loadTemplates() {
    try {
        const response = await fetch('/api/labels');
        if (response.ok) {
            templates = await response.json();
            renderTemplateList();
        } else {
            console.error('Failed to load templates');
        }
    } catch (error) {
        console.error('Error loading templates:', error);
    }
}

// Render template list in sidebar
function renderTemplateList() {
    const templateList = document.getElementById('templateList');
    if (!templateList) return;
    
    templateList.innerHTML = '';
    
    if (templates.length === 0) {
        templateList.innerHTML = '<div class="empty-state">No templates found. Create your first template!</div>';
        return;
    }
    
    templates.forEach(template => {
        const templateItem = document.createElement('div');
        templateItem.className = 'template-item';
        templateItem.dataset.testid = `template-${template.id}`;
        templateItem.innerHTML = `
            <div class="template-header">
                <h4 class="template-name">${escapeHtml(template.name)}</h4>
                ${template.isDefault ? '<span class="badge badge-success">Default</span>' : ''}
            </div>
            <div class="template-info">
                <span class="template-size">${template.width}mm × ${template.height}mm</span>
                <span class="template-elements">${(template.elements || []).length} elements</span>
            </div>
            <div class="template-actions">
                <button type="button" class="btn btn-sm btn-primary" onclick="loadTemplate('${template.id}')" data-testid="button-load-template-${template.id}">
                    <i class="fas fa-edit"></i> Load
                </button>
                <button type="button" class="btn btn-sm btn-outline" onclick="duplicateTemplate('${template.id}')" data-testid="button-duplicate-template-${template.id}">
                    <i class="fas fa-copy"></i> Duplicate
                </button>
                <button type="button" class="btn btn-sm btn-danger" onclick="deleteTemplate('${template.id}')" data-testid="button-delete-template-${template.id}">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </div>
        `;
        templateList.appendChild(templateItem);
    });
}

// Load a template for editing
async function loadTemplate(templateId) {
    try {
        const response = await fetch(`/api/labels/${templateId}`);
        if (response.ok) {
            currentTemplate = await response.json();
            renderTemplate();
            
            // Update form fields
            document.getElementById('templateName').value = currentTemplate.name || '';
            document.getElementById('templateWidth').value = currentTemplate.width || 60;
            document.getElementById('templateHeight').value = currentTemplate.height || 40;
            
            // Update canvas size
            updateCanvasSize(currentTemplate.width || 60, currentTemplate.height || 40);
            
            // Show save button
            document.getElementById('saveTemplateBtn').style.display = 'inline-flex';
            
            console.log('Template loaded:', currentTemplate);
        } else {
            console.error('Failed to load template');
        }
    } catch (error) {
        console.error('Error loading template:', error);
    }
}

// Render template elements on canvas
function renderTemplate() {
    const canvas = document.getElementById('labelCanvas');
    if (!canvas || !currentTemplate) return;
    
    // Clear existing elements
    const existingElements = canvas.querySelectorAll('.label-element');
    existingElements.forEach(el => el.remove());
    
    // Render each element
    if (currentTemplate.elements && Array.isArray(currentTemplate.elements)) {
        currentTemplate.elements.forEach((element, index) => {
            createElementOnCanvas(element, index);
        });
    }
    
    // Mark as having unsaved changes
    hasUnsavedChanges = true;
    resetAutoSaveTimer();
}

// Create element on canvas
function createElementOnCanvas(elementData, elementIndex) {
    const canvas = document.getElementById('labelCanvas');
    if (!canvas) return;
    
    const element = document.createElement('div');
    element.className = 'label-element';
    element.dataset.type = elementData.type;
    element.dataset.field = elementData.field;
    element.dataset.index = elementIndex;
    element.dataset.testid = `element-${elementData.field}-${elementIndex}`;
    
    // Position and size (convert mm to pixels)
    const x = (elementData.x || 0) * 4 * canvasScale;
    const y = (elementData.y || 0) * 4 * canvasScale;
    const width = (elementData.width || 20) * 4 * canvasScale;
    const height = (elementData.height || 10) * 4 * canvasScale;
    
    element.style.position = 'absolute';
    element.style.left = x + 'px';
    element.style.top = y + 'px';
    element.style.width = width + 'px';
    element.style.height = height + 'px';
    element.style.border = '1px dashed #ccc';
    element.style.backgroundColor = 'rgba(37, 99, 235, 0.1)';
    element.style.cursor = 'move';
    element.style.zIndex = '10';
    element.style.display = 'flex';
    element.style.alignItems = 'center';
    element.style.justifyContent = 'center';
    element.style.fontSize = '10px';
    element.style.color = '#666';
    element.style.userSelect = 'none';
    
    // Element content based on type
    let content = '';
    switch (elementData.type) {
        case 'text':
            content = `<i class="fas fa-font"></i> ${elementData.field}`;
            break;
        case 'barcode':
            content = `<i class="fas fa-barcode"></i> Barcode`;
            break;
        case 'image':
            content = `<i class="fas fa-image"></i> Image`;
            break;
        default:
            content = elementData.field;
    }
    
    element.innerHTML = content;
    
    // Add event listeners for selection and dragging
    element.addEventListener('mousedown', handleElementMouseDown);
    element.addEventListener('click', handleElementClick);
    element.addEventListener('touchstart', handleElementTouchStart, { passive: false });
    
    canvas.appendChild(element);
}

// Setup drag and drop functionality
function setupDragAndDrop() {
    const draggableFields = document.getElementById('draggableFields');
    const canvas = document.getElementById('labelCanvas');
    
    if (!draggableFields || !canvas) return;
    
    // Make fields draggable
    const fieldItems = draggableFields.querySelectorAll('.field-item');
    fieldItems.forEach(item => {
        item.addEventListener('dragstart', handleDragStart);
        item.addEventListener('dragend', handleDragEnd);
        
        // Add touch support for field items
        item.addEventListener('touchstart', handleFieldTouchStart, { passive: false });
        item.addEventListener('touchmove', handleFieldTouchMove, { passive: false });
        item.addEventListener('touchend', handleFieldTouchEnd, { passive: false });
    });
    
    // Setup canvas drop zone
    canvas.addEventListener('dragover', handleDragOver);
    canvas.addEventListener('drop', handleDrop);
    
    // Setup element dragging within canvas (mouse)
    canvas.addEventListener('mousemove', handleCanvasMouseMove);
    canvas.addEventListener('mouseup', handleCanvasMouseUp);
    canvas.addEventListener('mouseleave', handleCanvasMouseUp);
    
    // Setup element dragging within canvas (touch)
    canvas.addEventListener('touchmove', handleCanvasTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleCanvasTouchEnd, { passive: false });
}

// Handle drag start
function handleDragStart(e) {
    const fieldType = e.target.dataset.field;
    const elementType = e.target.dataset.type;
    
    e.dataTransfer.setData('text/plain', JSON.stringify({
        field: fieldType,
        type: elementType
    }));
    
    e.dataTransfer.effectAllowed = 'copy';
    
    // Add visual feedback
    e.target.style.opacity = '0.5';
}

// Handle drag end
function handleDragEnd(e) {
    e.target.style.opacity = '1';
}

// Handle drag over canvas
function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    
    // Add visual feedback to canvas
    const canvas = e.currentTarget;
    canvas.style.backgroundColor = 'rgba(37, 99, 235, 0.05)';
}

// Handle drop on canvas
function handleDrop(e) {
    e.preventDefault();
    
    const canvas = e.currentTarget;
    canvas.style.backgroundColor = '#ffffff';
    
    try {
        const data = JSON.parse(e.dataTransfer.getData('text/plain'));
        const rect = canvas.getBoundingClientRect();
        
        // Calculate drop position in mm (snap to grid)
        const pixelX = e.clientX - rect.left;
        const pixelY = e.clientY - rect.top;
        const mmX = Math.round((pixelX / (4 * canvasScale)) / gridSize) * gridSize;
        const mmY = Math.round((pixelY / (4 * canvasScale)) / gridSize) * gridSize;
        
        // Create new element data
        const newElement = createNewElement(data.type, data.field, mmX, mmY);
        
        // Add to current template
        if (!currentTemplate) {
            // Create new template if none exists
            currentTemplate = {
                name: 'New Template',
                width: 60,
                height: 40,
                elements: [],
                isDefault: false
            };
        }
        
        if (!currentTemplate.elements) {
            currentTemplate.elements = [];
        }
        
        currentTemplate.elements.push(newElement);
        
        // Re-render template
        renderTemplate();
        
        // Show save button
        document.getElementById('saveTemplateBtn').style.display = 'inline-flex';
        
        console.log('Element dropped:', newElement);
        
    } catch (error) {
        console.error('Error handling drop:', error);
    }
}

// Create new element data structure
function createNewElement(type, field, x, y) {
    const baseElement = {
        type: type,
        field: field,
        x: Math.max(0, x),
        y: Math.max(0, y)
    };
    
    // Default properties based on type
    switch (type) {
        case 'text':
            return {
                ...baseElement,
                width: 30,
                height: 8,
                fontSize: 12,
                bold: false,
                align: 'left'
            };
        case 'barcode':
            return {
                ...baseElement,
                width: 40,
                height: 10
            };
        case 'image':
            return {
                ...baseElement,
                width: 15,
                height: 15
            };
        default:
            return {
                ...baseElement,
                width: 20,
                height: 10
            };
    }
}

// Handle element click for selection
function handleElementClick(e) {
    e.stopPropagation();
    selectElement(e.currentTarget);
    hasUnsavedChanges = true;
    resetAutoSaveTimer();
}

// Handle element mouse down for dragging
function handleElementMouseDown(e) {
    e.preventDefault();
    e.stopPropagation();
    
    const element = e.currentTarget;
    selectElement(element);
    
    // Check if clicking on resize handle
    const target = e.target;
    if (target.classList.contains('resize-handle')) {
        startResize(e, target.dataset.handle);
        return;
    }
    
    // Start element dragging
    startElementDrag(e, element);
}

// Handle element touch start for dragging
function handleElementTouchStart(e) {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.touches.length !== 1) return; // Only handle single touch
    
    const touch = e.touches[0];
    const element = e.currentTarget;
    selectElement(element);
    
    // Check if touching resize handle
    const target = document.elementFromPoint(touch.clientX, touch.clientY);
    if (target && target.classList.contains('resize-handle')) {
        startResize({ clientX: touch.clientX, clientY: touch.clientY }, target.dataset.handle);
        return;
    }
    
    // Start element dragging
    startElementDrag({ clientX: touch.clientX, clientY: touch.clientY }, element);
}

// Start element dragging
function startElementDrag(e, element) {
    isDragging = true;
    selectedElement = element;
    
    const rect = element.getBoundingClientRect();
    dragOffset.x = e.clientX - rect.left;
    dragOffset.y = e.clientY - rect.top;
    
    element.style.zIndex = '100';
    document.body.style.userSelect = 'none';
    
    console.log('Started dragging element');
}

// Handle canvas mouse move (for dragging and resizing)
function handleCanvasMouseMove(e) {
    if (isDragging && selectedElement) {
        moveElement(e);
    } else if (isResizing && selectedElement) {
        resizeElement(e);
    }
}

// Move element
function moveElement(e) {
    if (!selectedElement) return;
    
    const canvas = document.getElementById('labelCanvas');
    const canvasRect = canvas.getBoundingClientRect();
    
    // Calculate new position in pixels
    let pixelX = e.clientX - canvasRect.left - dragOffset.x;
    let pixelY = e.clientY - canvasRect.top - dragOffset.y;
    
    // Convert to mm and snap to grid
    let mmX = Math.round((pixelX / (4 * canvasScale)) / gridSize) * gridSize;
    let mmY = Math.round((pixelY / (4 * canvasScale)) / gridSize) * gridSize;
    
    // Ensure element stays within canvas bounds
    const canvasWidth = parseInt(canvas.dataset.widthMm) || 60;
    const canvasHeight = parseInt(canvas.dataset.heightMm) || 40;
    const elementIndex = parseInt(selectedElement.dataset.index);
    const elementData = currentTemplate.elements[elementIndex];
    
    mmX = Math.max(0, Math.min(mmX, canvasWidth - (elementData.width || 20)));
    mmY = Math.max(0, Math.min(mmY, canvasHeight - (elementData.height || 10)));
    
    // Update element position
    selectedElement.style.left = (mmX * 4 * canvasScale) + 'px';
    selectedElement.style.top = (mmY * 4 * canvasScale) + 'px';
    
    // Update element data
    if (currentTemplate && currentTemplate.elements && currentTemplate.elements[elementIndex]) {
        currentTemplate.elements[elementIndex].x = mmX;
        currentTemplate.elements[elementIndex].y = mmY;
        
        // Update properties panel if shown
        const elementX = document.getElementById('elementX');
        const elementY = document.getElementById('elementY');
        if (elementX) elementX.value = mmX;
        if (elementY) elementY.value = mmY;
        
        hasUnsavedChanges = true;
        resetAutoSaveTimer();
    }
}

// Handle canvas mouse up (stop dragging/resizing)
function handleCanvasMouseUp(e) {
    if (isDragging) {
        isDragging = false;
        document.body.style.userSelect = 'auto';
        if (selectedElement) {
            selectedElement.style.zIndex = '10';
        }
        console.log('Stopped dragging element');
    }
    
    if (isResizing) {
        isResizing = false;
        resizeHandle = null;
        document.body.style.userSelect = 'auto';
        console.log('Stopped resizing element');
    }
}

// Select element
function selectElement(element) {
    // Remove previous selection
    const previousSelected = document.querySelector('.label-element.selected');
    if (previousSelected) {
        previousSelected.classList.remove('selected');
        removeResizeHandles(previousSelected);
    }
    
    // Select new element
    selectedElement = element;
    element.classList.add('selected');
    element.style.border = '2px solid var(--primary)';
    element.style.backgroundColor = 'rgba(37, 99, 235, 0.2)';
    
    // Add resize handles
    addResizeHandles(element);
    
    // Update properties panel
    updatePropertiesPanel(element);
    
    console.log('Element selected:', element.dataset.field);
}

// Add resize handles to selected element
function addResizeHandles(element) {
    const handles = ['nw', 'ne', 'sw', 'se'];
    
    handles.forEach(handle => {
        const handleElement = document.createElement('div');
        handleElement.className = `resize-handle resize-${handle}`;
        handleElement.dataset.handle = handle;
        handleElement.dataset.testid = `resize-handle-${handle}`;
        
        // Handle styles
        handleElement.style.position = 'absolute';
        handleElement.style.width = '8px';
        handleElement.style.height = '8px';
        handleElement.style.backgroundColor = 'var(--primary)';
        handleElement.style.border = '1px solid #fff';
        handleElement.style.borderRadius = '2px';
        handleElement.style.zIndex = '101';
        
        // Position handles
        switch (handle) {
            case 'nw':
                handleElement.style.top = '-4px';
                handleElement.style.left = '-4px';
                handleElement.style.cursor = 'nw-resize';
                break;
            case 'ne':
                handleElement.style.top = '-4px';
                handleElement.style.right = '-4px';
                handleElement.style.cursor = 'ne-resize';
                break;
            case 'sw':
                handleElement.style.bottom = '-4px';
                handleElement.style.left = '-4px';
                handleElement.style.cursor = 'sw-resize';
                break;
            case 'se':
                handleElement.style.bottom = '-4px';
                handleElement.style.right = '-4px';
                handleElement.style.cursor = 'se-resize';
                break;
        }
        
        // Add event listeners
        handleElement.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            startResize(e, handle);
        });
        
        element.appendChild(handleElement);
    });
}

// Remove resize handles
function removeResizeHandles(element) {
    const handles = element.querySelectorAll('.resize-handle');
    handles.forEach(handle => handle.remove());
}

// Start resize operation
function startResize(e, handle) {
    e.preventDefault();
    e.stopPropagation();
    
    isResizing = true;
    resizeHandle = handle;
    
    document.body.style.userSelect = 'none';
    
    console.log('Started resizing element:', handle);
}

// Resize element
function resizeElement(e) {
    if (!selectedElement || !resizeHandle) return;
    
    const canvas = document.getElementById('labelCanvas');
    const canvasRect = canvas.getBoundingClientRect();
    const elementIndex = parseInt(selectedElement.dataset.index);
    const elementData = currentTemplate.elements[elementIndex];
    
    if (!elementData) return;
    
    // Get current element rect
    const currentRect = selectedElement.getBoundingClientRect();
    
    // Calculate mouse position relative to canvas
    const mouseX = e.clientX - canvasRect.left;
    const mouseY = e.clientY - canvasRect.top;
    
    // Calculate new dimensions based on handle
    let newWidth = elementData.width;
    let newHeight = elementData.height;
    let newX = elementData.x;
    let newY = elementData.y;
    
    switch (resizeHandle) {
        case 'se':
            newWidth = Math.max(5, Math.round((mouseX / (4 * canvasScale)) / gridSize) * gridSize - elementData.x);
            newHeight = Math.max(5, Math.round((mouseY / (4 * canvasScale)) / gridSize) * gridSize - elementData.y);
            break;
        case 'sw':
            const newRightX = Math.max(5, Math.round((mouseX / (4 * canvasScale)) / gridSize) * gridSize);
            newWidth = Math.max(5, (elementData.x + elementData.width) - newRightX);
            newHeight = Math.max(5, Math.round((mouseY / (4 * canvasScale)) / gridSize) * gridSize - elementData.y);
            newX = newRightX;
            break;
        case 'ne':
            newWidth = Math.max(5, Math.round((mouseX / (4 * canvasScale)) / gridSize) * gridSize - elementData.x);
            const newBottomY = Math.max(5, Math.round((mouseY / (4 * canvasScale)) / gridSize) * gridSize);
            newHeight = Math.max(5, (elementData.y + elementData.height) - newBottomY);
            newY = newBottomY;
            break;
        case 'nw':
            const newRightX2 = Math.max(5, Math.round((mouseX / (4 * canvasScale)) / gridSize) * gridSize);
            const newBottomY2 = Math.max(5, Math.round((mouseY / (4 * canvasScale)) / gridSize) * gridSize);
            newWidth = Math.max(5, (elementData.x + elementData.width) - newRightX2);
            newHeight = Math.max(5, (elementData.y + elementData.height) - newBottomY2);
            newX = newRightX2;
            newY = newBottomY2;
            break;
    }
    
    // Ensure element stays within canvas bounds
    const canvasWidth = parseInt(canvas.dataset.widthMm) || 60;
    const canvasHeight = parseInt(canvas.dataset.heightMm) || 40;
    
    if (newX + newWidth > canvasWidth) {
        newWidth = canvasWidth - newX;
    }
    if (newY + newHeight > canvasHeight) {
        newHeight = canvasHeight - newY;
    }
    
    // Update element style
    selectedElement.style.left = (newX * 4 * canvasScale) + 'px';
    selectedElement.style.top = (newY * 4 * canvasScale) + 'px';
    selectedElement.style.width = (newWidth * 4 * canvasScale) + 'px';
    selectedElement.style.height = (newHeight * 4 * canvasScale) + 'px';
    
    // Update element data
    elementData.x = newX;
    elementData.y = newY;
    elementData.width = newWidth;
    elementData.height = newHeight;
    
    // Update properties panel
    updatePropertiesPanel(selectedElement);
}

// Update properties panel
function updatePropertiesPanel(element) {
    const propertiesPanel = document.getElementById('elementProperties');
    const propertiesContent = document.getElementById('propertiesContent');
    
    if (!propertiesPanel || !propertiesContent) return;
    
    const elementIndex = parseInt(element.dataset.index);
    const elementData = currentTemplate.elements[elementIndex];
    
    if (!elementData) return;
    
    // Show properties panel
    propertiesPanel.style.display = 'block';
    
    // Generate properties form based on element type
    let propertiesHTML = `
        <div class="form-group">
            <label class="form-label">Position</label>
            <div class="form-grid form-grid-2">
                <div class="form-group">
                    <label class="form-label" for="elementX">X (mm)</label>
                    <input type="number" id="elementX" class="form-control" value="${elementData.x}" min="0" data-testid="input-element-x">
                </div>
                <div class="form-group">
                    <label class="form-label" for="elementY">Y (mm)</label>
                    <input type="number" id="elementY" class="form-control" value="${elementData.y}" min="0" data-testid="input-element-y">
                </div>
            </div>
        </div>
        <div class="form-group">
            <label class="form-label">Size</label>
            <div class="form-grid form-grid-2">
                <div class="form-group">
                    <label class="form-label" for="elementWidth">Width (mm)</label>
                    <input type="number" id="elementWidth" class="form-control" value="${elementData.width}" min="5" data-testid="input-element-width">
                </div>
                <div class="form-group">
                    <label class="form-label" for="elementHeight">Height (mm)</label>
                    <input type="number" id="elementHeight" class="form-control" value="${elementData.height}" min="5" data-testid="input-element-height">
                </div>
            </div>
        </div>
    `;
    
    // Add type-specific properties
    if (elementData.type === 'text') {
        propertiesHTML += `
            <div class="form-group">
                <label class="form-label" for="elementFontSize">Font Size</label>
                <input type="number" id="elementFontSize" class="form-control" value="${elementData.fontSize || 12}" min="6" max="72" data-testid="input-element-font-size">
            </div>
            <div class="form-group">
                <label class="form-label" for="elementAlign">Alignment</label>
                <select id="elementAlign" class="form-control" data-testid="select-element-align">
                    <option value="left" ${elementData.align === 'left' ? 'selected' : ''}>Left</option>
                    <option value="center" ${elementData.align === 'center' ? 'selected' : ''}>Center</option>
                    <option value="right" ${elementData.align === 'right' ? 'selected' : ''}>Right</option>
                </select>
            </div>
            <div class="form-group">
                <div class="checkbox-wrapper">
                    <input type="checkbox" id="elementBold" ${elementData.bold ? 'checked' : ''} data-testid="checkbox-element-bold">
                    <label for="elementBold">Bold</label>
                </div>
            </div>
        `;
    }
    
    propertiesContent.innerHTML = propertiesHTML;
    
    // Add event listeners to property inputs
    addPropertyEventListeners(elementIndex);
}

// Add event listeners to property inputs
function addPropertyEventListeners(elementIndex) {
    const inputs = ['elementX', 'elementY', 'elementWidth', 'elementHeight', 'elementFontSize', 'elementAlign', 'elementBold'];
    
    inputs.forEach(inputId => {
        const input = document.getElementById(inputId);
        if (input) {
            input.addEventListener('input', () => updateElementProperty(elementIndex, inputId, input));
            input.addEventListener('change', () => updateElementProperty(elementIndex, inputId, input));
        }
    });
}

// Update element property
function updateElementProperty(elementIndex, inputId, input) {
    const elementData = currentTemplate.elements[elementIndex];
    const element = selectedElement;
    
    if (!elementData || !element) return;
    
    let value = input.type === 'checkbox' ? input.checked : 
                input.type === 'number' ? parseFloat(input.value) || 0 : input.value;
    
    switch (inputId) {
        case 'elementX':
            elementData.x = Math.max(0, value);
            element.style.left = (elementData.x * 4 * canvasScale) + 'px';
            break;
        case 'elementY':
            elementData.y = Math.max(0, value);
            element.style.top = (elementData.y * 4 * canvasScale) + 'px';
            break;
        case 'elementWidth':
            elementData.width = Math.max(5, value);
            element.style.width = (elementData.width * 4 * canvasScale) + 'px';
            break;
        case 'elementHeight':
            elementData.height = Math.max(5, value);
            element.style.height = (elementData.height * 4 * canvasScale) + 'px';
            break;
        case 'elementFontSize':
            elementData.fontSize = Math.max(6, Math.min(72, value));
            break;
        case 'elementAlign':
            elementData.align = value;
            break;
        case 'elementBold':
            elementData.bold = value;
            break;
    }
    
    console.log('Property updated:', inputId, value);
}

// Setup event listeners
function setupEventListeners() {
    // Template form inputs
    const templateWidth = document.getElementById('templateWidth');
    const templateHeight = document.getElementById('templateHeight');
    
    if (templateWidth) {
        templateWidth.addEventListener('input', () => {
            const width = parseInt(templateWidth.value) || 60;
            updateCanvasSize(width, parseInt(templateHeight.value) || 40);
            if (currentTemplate) {
                currentTemplate.width = width;
            }
        });
    }
    
    if (templateHeight) {
        templateHeight.addEventListener('input', () => {
            const height = parseInt(templateHeight.value) || 40;
            updateCanvasSize(parseInt(templateWidth.value) || 60, height);
            if (currentTemplate) {
                currentTemplate.height = height;
            }
        });
    }
    
    // Canvas click (deselect elements)
    const canvas = document.getElementById('labelCanvas');
    if (canvas) {
        canvas.addEventListener('click', (e) => {
            if (e.target === canvas) {
                deselectElement();
            }
        });
    }
    
    // Delete key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Delete' && selectedElement) {
            deleteSelectedElement();
        }
    });
}

// Deselect element
function deselectElement() {
    if (selectedElement) {
        selectedElement.classList.remove('selected');
        selectedElement.style.border = '1px dashed #ccc';
        selectedElement.style.backgroundColor = 'rgba(37, 99, 235, 0.1)';
        removeResizeHandles(selectedElement);
        selectedElement = null;
        
        // Hide properties panel
        const propertiesPanel = document.getElementById('elementProperties');
        if (propertiesPanel) {
            propertiesPanel.style.display = 'none';
        }
    }
}

// Delete selected element
function deleteSelectedElement() {
    if (!selectedElement || !currentTemplate) return;
    
    const elementIndex = parseInt(selectedElement.dataset.index);
    
    // Remove from template data
    currentTemplate.elements.splice(elementIndex, 1);
    
    // Re-render template
    renderTemplate();
    
    // Hide properties panel
    const propertiesPanel = document.getElementById('elementProperties');
    if (propertiesPanel) {
        propertiesPanel.style.display = 'none';
    }
    
    selectedElement = null;
    
    console.log('Element deleted');
}

// Setup toolbar actions
function setupToolbarActions() {
    // New template button
    const newTemplateBtn = document.getElementById('newTemplateBtn');
    if (newTemplateBtn) {
        newTemplateBtn.addEventListener('click', createNewTemplate);
    }
    
    // Save template button
    const saveTemplateBtn = document.getElementById('saveTemplateBtn');
    if (saveTemplateBtn) {
        saveTemplateBtn.addEventListener('click', showSaveModal);
    }
    
    // Preview button
    const previewBtn = document.getElementById('previewBtn');
    if (previewBtn) {
        previewBtn.addEventListener('click', showPreviewModal);
    }
    
    // Delete element button
    const deleteElementBtn = document.getElementById('deleteElementBtn');
    if (deleteElementBtn) {
        deleteElementBtn.addEventListener('click', deleteSelectedElement);
    }
    
    // Print preview button
    const printPreview = document.getElementById('printPreview');
    if (printPreview) {
        printPreview.addEventListener('click', handlePrintPreview);
    }
    
    // Template dimension change listeners for auto-save
    const templateWidth = document.getElementById('templateWidth');
    const templateHeight = document.getElementById('templateHeight');
    const templateName = document.getElementById('templateName');
    
    if (templateWidth) {
        templateWidth.addEventListener('change', handleTemplateChange);
    }
    
    if (templateHeight) {
        templateHeight.addEventListener('change', handleTemplateChange);
    }
    
    if (templateName) {
        templateName.addEventListener('input', handleTemplateChange);
    }
    
    // Initialize auto-save
    initializeAutoSave();
}

// Create new template
function createNewTemplate() {
    currentTemplate = {
        name: 'New Template',
        width: 60,
        height: 40,
        elements: [],
        isDefault: false
    };
    
    // Clear canvas
    const canvas = document.getElementById('labelCanvas');
    const existingElements = canvas.querySelectorAll('.label-element');
    existingElements.forEach(el => el.remove());
    
    // Reset form
    document.getElementById('templateName').value = 'New Template';
    document.getElementById('templateWidth').value = 60;
    document.getElementById('templateHeight').value = 40;
    
    // Update canvas
    updateCanvasSize(60, 40);
    
    // Show save button
    document.getElementById('saveTemplateBtn').style.display = 'inline-flex';
    
    // Hide properties panel
    const propertiesPanel = document.getElementById('elementProperties');
    if (propertiesPanel) {
        propertiesPanel.style.display = 'none';
    }
    
    console.log('New template created');
}

// Show save modal
function showSaveModal() {
    if (!currentTemplate) return;
    
    const modal = document.getElementById('templateModal');
    const modalTemplateName = document.getElementById('modalTemplateName');
    
    if (modal && modalTemplateName) {
        modalTemplateName.value = currentTemplate.name || 'New Template';
        modal.style.display = 'flex';
        modalTemplateName.focus();
    }
}

// Setup canvas controls
function setupCanvasControls() {
    const zoomInBtn = document.getElementById('zoomInBtn');
    const zoomOutBtn = document.getElementById('zoomOutBtn');
    const fitToScreenBtn = document.getElementById('fitToScreenBtn');
    
    if (zoomInBtn) {
        zoomInBtn.addEventListener('click', () => {
            canvasScale = Math.min(3, canvasScale * 1.2);
            updateCanvasSize(currentTemplate?.width || 60, currentTemplate?.height || 40);
            renderTemplate();
        });
    }
    
    if (zoomOutBtn) {
        zoomOutBtn.addEventListener('click', () => {
            canvasScale = Math.max(0.3, canvasScale * 0.8);
            updateCanvasSize(currentTemplate?.width || 60, currentTemplate?.height || 40);
            renderTemplate();
        });
    }
    
    if (fitToScreenBtn) {
        fitToScreenBtn.addEventListener('click', () => {
            canvasScale = 1;
            updateCanvasSize(currentTemplate?.width || 60, currentTemplate?.height || 40);
            renderTemplate();
        });
    }
}

// Duplicate template
async function duplicateTemplate(templateId) {
    try {
        const response = await fetch(`/api/labels/${templateId}`);
        if (response.ok) {
            const template = await response.json();
            
            // Create duplicate with new name
            const duplicatedTemplate = {
                ...template,
                id: undefined, // Let server generate new ID
                name: template.name + ' (Copy)',
                isDefault: false
            };
            
            // Save the duplicated template
            const saveResponse = await fetch('/api/labels', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(duplicatedTemplate)
            });
            
            if (saveResponse.ok) {
                // Reload templates
                await loadTemplates();
                console.log('Template duplicated successfully');
            } else {
                console.error('Failed to duplicate template');
            }
        } else {
            console.error('Failed to load template for duplication');
        }
    } catch (error) {
        console.error('Error duplicating template:', error);
    }
}

// Delete template
async function deleteTemplate(templateId) {
    if (!confirm('Are you sure you want to delete this template?')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/labels/${templateId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            // Reload templates
            await loadTemplates();
            
            // If currently loaded template was deleted, clear canvas
            if (currentTemplate && currentTemplate.id === templateId) {
                createNewTemplate();
            }
            
            console.log('Template deleted successfully');
        } else {
            console.error('Failed to delete template');
        }
    } catch (error) {
        console.error('Error deleting template:', error);
    }
}

// Show preview modal with actual data rendering
async function showPreviewModal() {
    if (!currentTemplate) {
        showNotification('No template loaded to preview', 'warning');
        return;
    }
    
    const modal = document.getElementById('previewModal');
    const previewContainer = document.getElementById('previewContainer');
    
    if (modal && previewContainer) {
        try {
            // Show loading state
            previewContainer.innerHTML = '<div class="loading">Generating preview...</div>';
            modal.style.display = 'flex';
            
            // Get sample product data for preview
            const sampleProduct = await getSampleProductData();
            
            // Generate preview with actual data
            await renderLabelPreview(previewContainer, sampleProduct);
            
        } catch (error) {
            console.error('Error generating preview:', error);
            previewContainer.innerHTML = '<div class="error">Error generating preview</div>';
            showNotification('Failed to generate preview', 'error');
        }
    }
}

// Modal event listeners
document.addEventListener('DOMContentLoaded', function() {
    // Save modal event listeners
    const confirmSave = document.getElementById('confirmSave');
    const cancelModal = document.getElementById('cancelModal');
    const closeModal = document.getElementById('closeModal');
    const templateModal = document.getElementById('templateModal');
    
    if (confirmSave) {
        confirmSave.addEventListener('click', saveTemplate);
    }
    
    if (cancelModal) {
        cancelModal.addEventListener('click', () => {
            templateModal.style.display = 'none';
        });
    }
    
    if (closeModal) {
        closeModal.addEventListener('click', () => {
            templateModal.style.display = 'none';
        });
    }
    
    // Preview modal event listeners
    const closePreviewModal = document.getElementById('closePreviewModal');
    const previewModal = document.getElementById('previewModal');
    
    if (closePreviewModal) {
        closePreviewModal.addEventListener('click', () => {
            previewModal.style.display = 'none';
        });
    }
});

// Enhanced save template with validation and notifications
async function saveTemplate() {
    if (!currentTemplate) {
        showNotification('No template to save', 'warning');
        return;
    }
    
    const modalTemplateName = document.getElementById('modalTemplateName');
    const setAsDefault = document.getElementById('setAsDefault');
    
    // Validate template data
    const validation = validateTemplate({
        name: modalTemplateName?.value?.trim() || '',
        width: parseInt(document.getElementById('templateWidth').value) || 60,
        height: parseInt(document.getElementById('templateHeight').value) || 40,
        elements: currentTemplate.elements || []
    });
    
    if (!validation.isValid) {
        showNotification(validation.errors.join(', '), 'error');
        return;
    }
    
    // Show saving indicator
    const confirmBtn = document.getElementById('confirmSave');
    const originalText = confirmBtn.innerHTML;
    confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    confirmBtn.disabled = true;
    
    try {
        // Update template data
        currentTemplate.name = modalTemplateName.value.trim();
        currentTemplate.width = parseInt(document.getElementById('templateWidth').value) || 60;
        currentTemplate.height = parseInt(document.getElementById('templateHeight').value) || 40;
        
        if (setAsDefault && setAsDefault.checked) {
            currentTemplate.isDefault = true;
        }
        
        let response;
        
        if (currentTemplate.id) {
            // Update existing template
            response = await fetch(`/api/labels/${currentTemplate.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(currentTemplate)
            });
        } else {
            // Create new template
            response = await fetch('/api/labels', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(currentTemplate)
            });
        }
        
        if (response.ok) {
            const savedTemplate = await response.json();
            currentTemplate = savedTemplate;
            
            // Set as default if requested
            if (setAsDefault && setAsDefault.checked) {
                await fetch(`/api/labels/${savedTemplate.id}/default`, {
                    method: 'POST'
                });
            }
            
            // Reload templates
            await loadTemplates();
            
            // Close modal
            document.getElementById('templateModal').style.display = 'none';
            
            // Show success notification
            showNotification(`Template "${savedTemplate.name}" saved successfully!`, 'success');
            
            // Reset auto-save timer
            resetAutoSaveTimer();
            
            console.log('Template saved successfully');
        } else {
            const errorData = await response.json();
            showNotification(errorData.message || 'Failed to save template. Please try again.', 'error');
        }
    } catch (error) {
        console.error('Error saving template:', error);
        showNotification('Error saving template. Please try again.', 'error');
    } finally {
        // Reset button state
        confirmBtn.innerHTML = originalText;
        confirmBtn.disabled = false;
    }
}

// Utility function to escape HTML
function escapeHtml(text) {
    if (typeof text !== 'string') {
        text = String(text);
    }
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, function(m) { return map[m]; });
}

// Auto-save functionality
let autoSaveTimer = null;
let hasUnsavedChanges = false;

function initializeAutoSave() {
    // Check for unsaved changes every 30 seconds
    setInterval(() => {
        if (hasUnsavedChanges && currentTemplate && currentTemplate.id) {
            autoSaveTemplate();
        }
    }, 30000);
}

function handleTemplateChange() {
    hasUnsavedChanges = true;
    resetAutoSaveTimer();
    
    // Update canvas when dimensions change
    const width = parseInt(document.getElementById('templateWidth').value) || 60;
    const height = parseInt(document.getElementById('templateHeight').value) || 40;
    
    if (currentTemplate) {
        currentTemplate.width = width;
        currentTemplate.height = height;
        updateCanvasSize(width, height);
    }
}

function resetAutoSaveTimer() {
    if (autoSaveTimer) {
        clearTimeout(autoSaveTimer);
    }
    
    // Auto-save after 5 seconds of inactivity
    autoSaveTimer = setTimeout(() => {
        if (hasUnsavedChanges && currentTemplate && currentTemplate.id) {
            autoSaveTemplate();
        }
    }, 5000);
}

async function autoSaveTemplate() {
    if (!currentTemplate || !currentTemplate.id) return;
    
    try {
        const templateData = {
            ...currentTemplate,
            name: document.getElementById('templateName').value || currentTemplate.name,
            width: parseInt(document.getElementById('templateWidth').value) || currentTemplate.width,
            height: parseInt(document.getElementById('templateHeight').value) || currentTemplate.height
        };
        
        const response = await fetch(`/api/labels/${currentTemplate.id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(templateData)
        });
        
        if (response.ok) {
            hasUnsavedChanges = false;
            showNotification('Template auto-saved', 'info', 2000);
        }
    } catch (error) {
        console.error('Auto-save failed:', error);
    }
}

// Print preview functionality
function handlePrintPreview() {
    if (!currentTemplate) {
        showNotification('No template to print', 'warning');
        return;
    }
    
    // Create a new window for printing
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Label Preview - ${escapeHtml(currentTemplate.name)}</title>
            <style>
                body { 
                    margin: 0; 
                    padding: 20px; 
                    font-family: Arial, sans-serif;
                    background: #f5f5f5;
                }
                .print-container {
                    background: white;
                    padding: 20px;
                    border-radius: 8px;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                    max-width: 800px;
                    margin: 0 auto;
                }
                .label-preview {
                    border: 2px solid #333;
                    margin: 20px auto;
                    background: white;
                    position: relative;
                }
                .print-info {
                    margin-bottom: 20px;
                    padding: 10px;
                    background: #f8f9fa;
                    border-radius: 4px;
                }
                @media print {
                    body { background: white; }
                    .print-container { box-shadow: none; }
                    .print-info { display: none; }
                }
                @page {
                    margin: 0.5in;
                }
            </style>
        </head>
        <body>
            <div class="print-container">
                <div class="print-info">
                    <h2>Label Template: ${escapeHtml(currentTemplate.name)}</h2>
                    <p>Dimensions: ${currentTemplate.width}mm × ${currentTemplate.height}mm</p>
                    <p>Elements: ${currentTemplate.elements.length}</p>
                    <p>Generated: ${new Date().toLocaleString()}</p>
                    <button onclick="window.print()">Print</button>
                    <button onclick="window.close()">Close</button>
                </div>
                <div id="labelContainer"></div>
            </div>
        </body>
        </html>
    `);
    
    printWindow.document.close();
    
    // Render the label in the print window
    const labelContainer = printWindow.document.getElementById('labelContainer');
    
    getSampleProductData().then(sampleData => {
        renderPrintableLabel(labelContainer, currentTemplate, sampleData, printWindow);
    });
}

async function renderPrintableLabel(container, template, sampleData, printWindow) {
    const scale = 3; // Higher scale for print quality
    const pixelWidth = template.width * 4 * scale;
    const pixelHeight = template.height * 4 * scale;
    
    const labelDiv = printWindow.document.createElement('div');
    labelDiv.className = 'label-preview';
    labelDiv.style.width = pixelWidth + 'px';
    labelDiv.style.height = pixelHeight + 'px';
    
    container.appendChild(labelDiv);
    
    // Render elements
    for (const element of template.elements) {
        const elementDiv = printWindow.document.createElement('div');
        elementDiv.style.position = 'absolute';
        elementDiv.style.left = (element.x * 4 * scale) + 'px';
        elementDiv.style.top = (element.y * 4 * scale) + 'px';
        elementDiv.style.width = (element.width * 4 * scale) + 'px';
        elementDiv.style.height = (element.height * 4 * scale) + 'px';
        
        if (element.type === 'text') {
            const textValue = sampleData[element.field] || element.field;
            const fontSize = (element.fontSize || 12) * scale;
            
            elementDiv.style.fontSize = fontSize + 'px';
            elementDiv.style.fontWeight = element.bold ? 'bold' : 'normal';
            elementDiv.style.fontStyle = element.italic ? 'italic' : 'normal';
            elementDiv.style.textAlign = element.align || 'left';
            elementDiv.style.display = 'flex';
            elementDiv.style.alignItems = 'center';
            elementDiv.style.color = '#000';
            elementDiv.innerHTML = escapeHtml(textValue);
        } else if (element.type === 'barcode') {
            elementDiv.style.border = '1px solid #ddd';
            elementDiv.style.display = 'flex';
            elementDiv.style.alignItems = 'center';
            elementDiv.style.justifyContent = 'center';
            elementDiv.innerHTML = `<div style="font-size: ${8 * scale}px;">BARCODE: ${sampleData.barcode}</div>`;
        } else if (element.type === 'image') {
            elementDiv.style.border = '1px dashed #ccc';
            elementDiv.style.display = 'flex';
            elementDiv.style.alignItems = 'center';
            elementDiv.style.justifyContent = 'center';
            elementDiv.innerHTML = `<div style="font-size: ${8 * scale}px;">LOGO</div>`;
        }
        
        labelDiv.appendChild(elementDiv);
    }
}

// Template import/export functionality
function exportTemplate() {
    if (!currentTemplate) {
        showNotification('No template to export', 'warning');
        return;
    }
    
    const templateData = {
        ...currentTemplate,
        name: document.getElementById('templateName').value || currentTemplate.name,
        width: parseInt(document.getElementById('templateWidth').value) || currentTemplate.width,
        height: parseInt(document.getElementById('templateHeight').value) || currentTemplate.height
    };
    
    // Remove ID for export
    delete templateData.id;
    delete templateData.createdAt;
    delete templateData.updatedAt;
    
    const dataStr = JSON.stringify(templateData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `label-template-${templateData.name.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    
    showNotification('Template exported successfully', 'success');
}

function importTemplate() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = function(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const templateData = JSON.parse(e.target.result);
                
                // Validate imported template
                const validation = validateTemplate(templateData);
                if (!validation.isValid) {
                    showNotification('Invalid template: ' + validation.errors.join(', '), 'error');
                    return;
                }
                
                // Load imported template
                currentTemplate = {
                    ...templateData,
                    name: templateData.name + ' (Imported)',
                    isDefault: false
                };
                
                // Update UI
                document.getElementById('templateName').value = currentTemplate.name;
                document.getElementById('templateWidth').value = currentTemplate.width;
                document.getElementById('templateHeight').value = currentTemplate.height;
                
                updateCanvasSize(currentTemplate.width, currentTemplate.height);
                renderTemplate();
                
                // Show save button
                document.getElementById('saveTemplateBtn').style.display = 'inline-flex';
                
                showNotification('Template imported successfully', 'success');
                
            } catch (error) {
                console.error('Error importing template:', error);
                showNotification('Error importing template: Invalid JSON file', 'error');
            }
        };
        
        reader.readAsText(file);
    };
    
    input.click();
}

// Delete selected element
function deleteSelectedElement() {
    if (!selectedElement || !currentTemplate || !currentTemplate.elements) {
        showNotification('No element selected', 'warning');
        return;
    }
    
    const elementIndex = parseInt(selectedElement.dataset.index);
    
    if (elementIndex >= 0 && elementIndex < currentTemplate.elements.length) {
        // Remove element from template
        currentTemplate.elements.splice(elementIndex, 1);
        
        // Remove element from canvas
        selectedElement.remove();
        selectedElement = null;
        
        // Hide properties panel
        const propertiesPanel = document.getElementById('elementProperties');
        if (propertiesPanel) {
            propertiesPanel.style.display = 'none';
        }
        
        // Re-render template to update indices
        renderTemplate();
        
        // Show save button
        document.getElementById('saveTemplateBtn').style.display = 'inline-flex';
        
        showNotification('Element deleted', 'success');
        
        hasUnsavedChanges = true;
        resetAutoSaveTimer();
    }
}

// Update properties panel
function updatePropertiesPanel(element) {
    const propertiesPanel = document.getElementById('elementProperties');
    const propertiesContent = document.getElementById('propertiesContent');
    
    if (!propertiesPanel || !propertiesContent || !element) return;
    
    const elementIndex = parseInt(element.dataset.index);
    const elementData = currentTemplate.elements[elementIndex];
    
    if (!elementData) return;
    
    let propertiesHTML = `
        <div class="form-group">
            <label class="form-label">Position & Size</label>
            <div class="form-grid form-grid-4">
                <div class="form-group">
                    <label class="form-label-sm">X (mm)</label>
                    <input type="number" id="elementX" class="form-control form-control-sm" 
                           value="${elementData.x}" min="0" step="1" data-testid="input-element-x">
                </div>
                <div class="form-group">
                    <label class="form-label-sm">Y (mm)</label>
                    <input type="number" id="elementY" class="form-control form-control-sm" 
                           value="${elementData.y}" min="0" step="1" data-testid="input-element-y">
                </div>
                <div class="form-group">
                    <label class="form-label-sm">Width (mm)</label>
                    <input type="number" id="elementWidth" class="form-control form-control-sm" 
                           value="${elementData.width}" min="1" step="1" data-testid="input-element-width">
                </div>
                <div class="form-group">
                    <label class="form-label-sm">Height (mm)</label>
                    <input type="number" id="elementHeight" class="form-control form-control-sm" 
                           value="${elementData.height}" min="1" step="1" data-testid="input-element-height">
                </div>
            </div>
        </div>
    `;
    
    if (elementData.type === 'text') {
        propertiesHTML += `
            <div class="form-group">
                <label class="form-label">Text Properties</label>
                <div class="form-grid form-grid-2">
                    <div class="form-group">
                        <label class="form-label-sm">Font Size</label>
                        <input type="number" id="elementFontSize" class="form-control form-control-sm" 
                               value="${elementData.fontSize || 12}" min="4" max="72" data-testid="input-font-size">
                    </div>
                    <div class="form-group">
                        <label class="form-label-sm">Alignment</label>
                        <select id="elementAlign" class="form-control form-control-sm" data-testid="select-text-align">
                            <option value="left" ${elementData.align === 'left' ? 'selected' : ''}>Left</option>
                            <option value="center" ${elementData.align === 'center' ? 'selected' : ''}>Center</option>
                            <option value="right" ${elementData.align === 'right' ? 'selected' : ''}>Right</option>
                        </select>
                    </div>
                </div>
                <div class="form-group">
                    <div class="checkbox-wrapper">
                        <input type="checkbox" id="elementBold" ${elementData.bold ? 'checked' : ''} data-testid="checkbox-bold">
                        <label for="elementBold">Bold</label>
                    </div>
                    <div class="checkbox-wrapper">
                        <input type="checkbox" id="elementItalic" ${elementData.italic ? 'checked' : ''} data-testid="checkbox-italic">
                        <label for="elementItalic">Italic</label>
                    </div>
                </div>
            </div>
        `;
    }
    
    propertiesContent.innerHTML = propertiesHTML;
    propertiesPanel.style.display = 'block';
    
    // Add event listeners for property changes
    addPropertyEventListeners(elementIndex);
}

// Add event listeners for property changes
function addPropertyEventListeners(elementIndex) {
    const inputs = ['elementX', 'elementY', 'elementWidth', 'elementHeight', 'elementFontSize', 'elementAlign', 'elementBold', 'elementItalic'];
    
    inputs.forEach(inputId => {
        const input = document.getElementById(inputId);
        if (input) {
            input.addEventListener('change', () => updateElementProperty(elementIndex, inputId));
            input.addEventListener('input', () => updateElementProperty(elementIndex, inputId));
        }
    });
}

// Update element property
function updateElementProperty(elementIndex, propertyId) {
    if (!currentTemplate || !currentTemplate.elements || !currentTemplate.elements[elementIndex]) return;
    
    const element = currentTemplate.elements[elementIndex];
    const input = document.getElementById(propertyId);
    
    if (!input) return;
    
    switch (propertyId) {
        case 'elementX':
            element.x = Math.max(0, parseInt(input.value) || 0);
            break;
        case 'elementY':
            element.y = Math.max(0, parseInt(input.value) || 0);
            break;
        case 'elementWidth':
            element.width = Math.max(1, parseInt(input.value) || 1);
            break;
        case 'elementHeight':
            element.height = Math.max(1, parseInt(input.value) || 1);
            break;
        case 'elementFontSize':
            element.fontSize = Math.max(4, Math.min(72, parseInt(input.value) || 12));
            break;
        case 'elementAlign':
            element.align = input.value;
            break;
        case 'elementBold':
            element.bold = input.checked;
            break;
        case 'elementItalic':
            element.italic = input.checked;
            break;
    }
    
    // Re-render template
    renderTemplate();
    
    // Show save button
    document.getElementById('saveTemplateBtn').style.display = 'inline-flex';
    
    hasUnsavedChanges = true;
    resetAutoSaveTimer();
}

// Add keyboard shortcuts
document.addEventListener('keydown', function(e) {
    // Ctrl+S to save
    if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        if (currentTemplate) {
            showSaveModal();
        }
    }
    
    // Delete key to delete selected element
    if (e.key === 'Delete' && selectedElement) {
        e.preventDefault();
        deleteSelectedElement();
    }
    
    // Escape to deselect
    if (e.key === 'Escape') {
        if (selectedElement) {
            deselectElement();
        }
    }
});

// Deselect element
function deselectElement() {
    if (selectedElement) {
        selectedElement.classList.remove('selected');
        selectedElement.style.border = '1px dashed #ccc';
        selectedElement.style.backgroundColor = 'rgba(37, 99, 235, 0.1)';
        removeResizeHandles(selectedElement);
        selectedElement = null;
        
        // Hide properties panel
        const propertiesPanel = document.getElementById('elementProperties');
        if (propertiesPanel) {
            propertiesPanel.style.display = 'none';
        }
    }
}

// Click on canvas to deselect
document.addEventListener('click', function(e) {
    const canvas = document.getElementById('labelCanvas');
    if (canvas && e.target === canvas) {
        deselectElement();
    }
});

// Add notification styles dynamically
function addNotificationStyles() {
    if (document.getElementById('notificationStyles')) return;
    
    const style = document.createElement('style');
    style.id = 'notificationStyles';
    style.textContent = `
        .notification-container {
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10000;
            display: flex;
            flex-direction: column;
            gap: 10px;
            max-width: 400px;
        }
        
        .notification {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 12px 16px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            animation: slideInRight 0.3s ease-out;
            font-weight: 500;
            min-width: 300px;
        }
        
        .notification-success {
            background: #10B981;
            color: white;
        }
        
        .notification-error {
            background: #EF4444;
            color: white;
        }
        
        .notification-warning {
            background: #F59E0B;
            color: white;
        }
        
        .notification-info {
            background: #3B82F6;
            color: white;
        }
        
        .notification-close {
            background: none;
            border: none;
            color: inherit;
            cursor: pointer;
            padding: 4px;
            margin-left: auto;
            opacity: 0.7;
        }
        
        .notification-close:hover {
            opacity: 1;
        }
        
        @keyframes slideInRight {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        
        @keyframes slideOutRight {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(100%);
                opacity: 0;
            }
        }
        
        .loading {
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 40px;
            font-size: 16px;
            color: #666;
        }
        
        .error {
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 40px;
            font-size: 16px;
            color: #dc2626;
            background: #fef2f2;
            border: 1px solid #fecaca;
            border-radius: 8px;
        }
        
        .preview-info {
            margin-top: 20px;
            padding: 16px;
            background: #f8f9fa;
            border-radius: 8px;
        }
        
        .preview-info h4 {
            margin: 0 0 12px 0;
            color: #374151;
        }
        
        .preview-info p {
            margin: 4px 0;
            font-size: 14px;
            color: #6b7280;
        }
    `;
    
    document.head.appendChild(style);
}

// Initialize notification styles when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addNotificationStyles);
} else {
    addNotificationStyles();
}

// Touch support variables
let touchStartData = null;
let isDraggingFromField = false;

// Touch handlers for field items
function handleFieldTouchStart(e) {
    e.preventDefault();
    
    if (e.touches.length !== 1) return;
    
    const touch = e.touches[0];
    const fieldType = e.currentTarget.dataset.field;
    const elementType = e.currentTarget.dataset.type;
    
    touchStartData = {
        field: fieldType,
        type: elementType,
        startX: touch.clientX,
        startY: touch.clientY,
        element: e.currentTarget
    };
    
    isDraggingFromField = true;
    e.currentTarget.style.opacity = '0.5';
}

function handleFieldTouchMove(e) {
    if (!touchStartData || !isDraggingFromField) return;
    e.preventDefault();
    
    const touch = e.touches[0];
    const deltaX = Math.abs(touch.clientX - touchStartData.startX);
    const deltaY = Math.abs(touch.clientY - touchStartData.startY);
    
    // Only start visual feedback if moved enough
    if (deltaX > 5 || deltaY > 5) {
        // Add visual feedback (could create a ghost element here)
    }
}

function handleFieldTouchEnd(e) {
    if (!touchStartData || !isDraggingFromField) return;
    e.preventDefault();
    
    touchStartData.element.style.opacity = '1';
    
    if (e.changedTouches.length > 0) {
        const touch = e.changedTouches[0];
        const canvas = document.getElementById('labelCanvas');
        const canvasRect = canvas.getBoundingClientRect();
        
        // Check if touch ended over canvas
        if (touch.clientX >= canvasRect.left && touch.clientX <= canvasRect.right &&
            touch.clientY >= canvasRect.top && touch.clientY <= canvasRect.bottom) {
            
            // Simulate drop on canvas
            const dropEvent = {
                preventDefault: () => {},
                currentTarget: canvas,
                clientX: touch.clientX,
                clientY: touch.clientY,
                dataTransfer: {
                    getData: () => JSON.stringify({
                        field: touchStartData.field,
                        type: touchStartData.type
                    })
                }
            };
            
            handleDrop(dropEvent);
        }
    }
    
    touchStartData = null;
    isDraggingFromField = false;
}

// Touch handlers for canvas
function handleCanvasTouchMove(e) {
    if (e.touches.length !== 1) return;
    
    const touch = e.touches[0];
    const mouseEvent = {
        clientX: touch.clientX,
        clientY: touch.clientY
    };
    
    if (isDragging && selectedElement) {
        e.preventDefault();
        moveElement(mouseEvent);
    } else if (isResizing && selectedElement) {
        e.preventDefault();
        resizeElement(mouseEvent);
    }
}

function handleCanvasTouchEnd(e) {
    if (isDragging) {
        isDragging = false;
        document.body.style.userSelect = 'auto';
        if (selectedElement) {
            selectedElement.style.zIndex = '10';
        }
        console.log('Stopped dragging element (touch)');
    }
    
    if (isResizing) {
        isResizing = false;
        resizeHandle = null;
        document.body.style.userSelect = 'auto';
        console.log('Stopped resizing element (touch)');
    }
}

console.log('Label Designer JS loaded with touch support');

// ========== ENHANCED FUNCTIONALITY ==========

// Notification system
function showNotification(message, type = 'info', duration = 5000) {
    const container = getOrCreateNotificationContainer();
    
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <i class="fas ${getNotificationIcon(type)}"></i>
        <span>${escapeHtml(message)}</span>
        <button class="notification-close" onclick="closeNotification(this.parentElement)">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    container.appendChild(notification);
    
    // Auto-remove after duration
    if (duration > 0) {
        setTimeout(() => {
            if (notification.parentElement) {
                closeNotification(notification);
            }
        }, duration);
    }
    
    return notification;
}

function getOrCreateNotificationContainer() {
    let container = document.getElementById('notificationContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'notificationContainer';
        container.className = 'notification-container';
        document.body.appendChild(container);
    }
    return container;
}

function getNotificationIcon(type) {
    const icons = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-triangle',
        warning: 'fa-exclamation-circle',
        info: 'fa-info-circle'
    };
    return icons[type] || icons.info;
}

function closeNotification(notification) {
    notification.style.animation = 'slideOutRight 0.3s ease-in-out';
    setTimeout(() => {
        if (notification.parentElement) {
            notification.parentElement.removeChild(notification);
        }
    }, 300);
}

// Template validation
function validateTemplate(template) {
    const errors = [];
    
    if (!template.name || template.name.trim().length === 0) {
        errors.push('Template name is required');
    }
    
    if (template.name && template.name.length > 100) {
        errors.push('Template name must be less than 100 characters');
    }
    
    if (!template.width || template.width < 10 || template.width > 500) {
        errors.push('Template width must be between 10mm and 500mm');
    }
    
    if (!template.height || template.height < 10 || template.height > 500) {
        errors.push('Template height must be between 10mm and 500mm');
    }
    
    if (!template.elements || template.elements.length === 0) {
        errors.push('Template must have at least one element');
    }
    
    // Validate elements
    if (template.elements) {
        template.elements.forEach((element, index) => {
            if (!element.type) {
                errors.push(`Element ${index + 1}: Type is required`);
            }
            
            if (!element.field) {
                errors.push(`Element ${index + 1}: Field is required`);
            }
            
            if (element.x < 0 || element.y < 0) {
                errors.push(`Element ${index + 1}: Position cannot be negative`);
            }
            
            if (element.width <= 0 || element.height <= 0) {
                errors.push(`Element ${index + 1}: Size must be positive`);
            }
            
            // Check if element is within template bounds
            if (element.x + element.width > template.width) {
                errors.push(`Element ${index + 1}: Extends beyond template width`);
            }
            
            if (element.y + element.height > template.height) {
                errors.push(`Element ${index + 1}: Extends beyond template height`);
            }
        });
    }
    
    return {
        isValid: errors.length === 0,
        errors: errors
    };
}

// Get sample product data for preview
async function getSampleProductData() {
    try {
        const response = await fetch('/api/products');
        if (response.ok) {
            const products = await response.json();
            if (products.length > 0) {
                // Use first active product or first product
                const activeProduct = products.find(p => p.status === 'Aktif') || products[0];
                return {
                    productName: activeProduct.name,
                    features: activeProduct.attributes?.map(attr => `${attr.name}: ${attr.value}`).join(', ') || 'Premium Quality',
                    price: `${activeProduct.sellPrice} ${activeProduct.sellCurrency || window.i18nUnits?.currencyUSD || 'USD'}`,
                    date: new Date().toLocaleDateString('tr-TR'),
                    barcode: await generateSampleBarcode()
                };
            }
        }
    } catch (error) {
        console.error('Error fetching sample product data:', error);
    }
    
    // Fallback sample data
    return {
        productName: 'Sample Product',
        features: 'High Quality, Durable',
        price: `29.99 ${window.i18nUnits?.currencyUSD || 'USD'}`,
        date: new Date().toLocaleDateString('tr-TR'),
        barcode: await generateSampleBarcode()
    };
}

// Generate sample barcode for preview
async function generateSampleBarcode() {
    try {
        const response = await fetch('/api/barcode/generate');
        if (response.ok) {
            const data = await response.json();
            return data.code;
        }
    } catch (error) {
        console.error('Error generating sample barcode:', error);
    }
    return '123456'; // Fallback
}

// Render label preview with actual data
async function renderLabelPreview(container, sampleData) {
    if (!currentTemplate || !container) return;
    
    const scale = 2; // Preview scale factor
    const pixelWidth = currentTemplate.width * 4 * scale;
    const pixelHeight = currentTemplate.height * 4 * scale;
    
    container.innerHTML = `
        <div class="preview-label" style="
            width: ${pixelWidth}px;
            height: ${pixelHeight}px;
            position: relative;
            background: white;
            border: 2px solid #ddd;
            border-radius: 4px;
            margin: 20px auto;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        ">
            <div class="preview-elements"></div>
        </div>
        <div class="preview-info">
            <h4>Preview Data:</h4>
            <p><strong>Product:</strong> ${escapeHtml(sampleData.productName)}</p>
            <p><strong>Features:</strong> ${escapeHtml(sampleData.features)}</p>
            <p><strong>Price:</strong> ${escapeHtml(sampleData.price)}</p>
            <p><strong>Date:</strong> ${escapeHtml(sampleData.date)}</p>
            <p><strong>Barcode:</strong> ${escapeHtml(sampleData.barcode)}</p>
        </div>
    `;
    
    const elementsContainer = container.querySelector('.preview-elements');
    
    // Render each element with actual data
    for (const element of currentTemplate.elements) {
        await renderPreviewElement(elementsContainer, element, sampleData, scale);
    }
}

// Render individual preview element
async function renderPreviewElement(container, elementData, sampleData, scale) {
    const elementDiv = document.createElement('div');
    elementDiv.style.position = 'absolute';
    elementDiv.style.left = (elementData.x * 4 * scale) + 'px';
    elementDiv.style.top = (elementData.y * 4 * scale) + 'px';
    elementDiv.style.width = (elementData.width * 4 * scale) + 'px';
    elementDiv.style.height = (elementData.height * 4 * scale) + 'px';
    
    let content = '';
    
    switch (elementData.type) {
        case 'text':
            const textValue = sampleData[elementData.field] || elementData.field;
            const fontSize = (elementData.fontSize || 12) * scale;
            
            elementDiv.style.fontSize = fontSize + 'px';
            elementDiv.style.fontWeight = elementData.bold ? 'bold' : 'normal';
            elementDiv.style.fontStyle = elementData.italic ? 'italic' : 'normal';
            elementDiv.style.textAlign = elementData.align || 'left';
            elementDiv.style.display = 'flex';
            elementDiv.style.alignItems = 'center';
            elementDiv.style.color = '#000';
            elementDiv.style.lineHeight = '1.2';
            elementDiv.style.overflow = 'hidden';
            
            content = escapeHtml(textValue);
            break;
            
        case 'barcode':
            try {
                const barcodeResponse = await fetch(`/api/barcode/${sampleData.barcode}/image`);
                if (barcodeResponse.ok) {
                    const blob = await barcodeResponse.blob();
                    const imageUrl = URL.createObjectURL(blob);
                    
                    elementDiv.style.backgroundImage = `url(${imageUrl})`;
                    elementDiv.style.backgroundSize = 'contain';
                    elementDiv.style.backgroundRepeat = 'no-repeat';
                    elementDiv.style.backgroundPosition = 'center';
                } else {
                    content = `<div style="background: #f0f0f0; display: flex; align-items: center; justify-content: center; height: 100%; font-size: ${8 * scale}px;">BARCODE</div>`;
                }
            } catch (error) {
                console.error('Error loading barcode image:', error);
                content = `<div style="background: #f0f0f0; display: flex; align-items: center; justify-content: center; height: 100%; font-size: ${8 * scale}px;">BARCODE</div>`;
            }
            break;
            
        case 'image':
            content = `<div style="background: #f8f9fa; display: flex; align-items: center; justify-content: center; height: 100%; font-size: ${8 * scale}px; border: 1px dashed #ccc;"><i class="fas fa-image"></i> LOGO</div>`;
            break;
            
        default:
            content = escapeHtml(elementData.field || 'Unknown');
    }
    
    elementDiv.innerHTML = content;
    container.appendChild(elementDiv);
}