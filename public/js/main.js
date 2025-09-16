// ERP Main JavaScript
document.addEventListener('DOMContentLoaded', function() {
    // Initialize mobile menu system first
    initMobileMenu();
    
    // Initialize lazy loading animations
    initLazyLoading();
    
    // Initialize image error handling
    initImageFallbacks();
    
    // Initialize image modal functionality  
    initImageModal();
    
    // Initialize product form features if we're on the product form page
    if (document.getElementById('productForm')) {
        initProductFormFeatures();
    }
});

// Lazy Loading with Intersection Observer
function initLazyLoading() {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '100px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('reveal');
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    // Observe product cards for reveal animation
    const productCards = document.querySelectorAll('.product-card');
    productCards.forEach((card, index) => {
        // Add staggered delay for animation
        card.style.transitionDelay = `${index * 0.1}s`;
        observer.observe(card);
    });

    // Enhanced image loading with smooth transitions
    const productImages = document.querySelectorAll('.product-image');
    productImages.forEach((img, index) => {
        // Add smooth transition for all images
        img.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
        
        // If image is already loaded, ensure it's visible
        if (img.complete && img.naturalHeight !== 0) {
            img.style.opacity = '1';
            img.style.transform = 'scale(1)';
        } else {
            // Set loading state
            img.style.opacity = '0.7';
            img.style.transform = 'scale(0.98)';
            
            // Handle load event
            img.addEventListener('load', function() {
                this.style.opacity = '1';
                this.style.transform = 'scale(1)';
                this.classList.add('loaded');
            });
            
            // Handle error event
            img.addEventListener('error', function() {
                this.style.opacity = '1';
                this.style.transform = 'scale(1)';
            });
        }
    });
}

// Image fallback handling
function initImageFallbacks() {
    const productImages = document.querySelectorAll('.product-image');
    
    productImages.forEach(img => {
        img.onerror = function() {
            this.src = '/img/placeholder-product.svg';
            this.onerror = null; // Prevent infinite loop
            this.classList.add('placeholder');
        };
    });
}

// ===== MODERN MENU SYSTEM =====

// Global menu state
let isMenuOpen = false;

// Menu elements
const menuElements = {
    sidebar: null,
    overlay: null,
    hamburger: null
};

// Initialize mobile menu system
function initMobileMenu() {
    // Get menu elements
    menuElements.sidebar = document.querySelector('.sidebar');
    menuElements.overlay = document.querySelector('.menu-overlay');
    menuElements.hamburger = document.querySelector('.hamburger-menu');
    
    if (!menuElements.sidebar || !menuElements.overlay || !menuElements.hamburger) {
        console.warn('Menu elements not found, skipping menu initialization');
        return;
    }
    
    // Hamburger button click handler
    menuElements.hamburger.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        toggleMenu();
    });
    
    // Overlay click handler - close menu
    menuElements.overlay.addEventListener('click', function(e) {
        e.preventDefault();
        closeMenu();
    });
    
    // Escape key handler - close menu
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && isMenuOpen) {
            closeMenu();
        }
    });
    
    // Navigation link click handler - auto close menu on mobile
    if (menuElements.sidebar) {
        menuElements.sidebar.addEventListener('click', function(e) {
            const link = e.target.closest('a.nav-link, a.submenu-link, a[href]');
            
            // Only close for real navigation links, not buttons or non-links
            if (link && link.href && !link.href.includes('#') && window.innerWidth <= 1024) {
                // Small delay to ensure navigation starts before closing menu
                setTimeout(() => {
                    closeMenu();
                }, 100);
            }
        });
    }
    
    // Force menu closed on page load (prevent stale state)
    closeMenu();
    
    console.log('ERP Menu System: Initialized successfully with touch gestures and accessibility features');
}

// Open menu function
function openMenu() {
    if (isMenuOpen) return;
    
    isMenuOpen = true;
    
    // Update all menu elements
    if (menuElements.sidebar) {
        menuElements.sidebar.classList.add('open');
    }
    
    if (menuElements.overlay) {
        menuElements.overlay.classList.add('show');
    }
    
    if (menuElements.hamburger) {
        menuElements.hamburger.classList.add('menu-open');
    }
    
    // Prevent body scroll on mobile
    if (window.innerWidth <= 1024) {
        document.body.style.overflow = 'hidden';
    }
}

// Close menu function
function closeMenu() {
    if (!isMenuOpen) return;
    
    isMenuOpen = false;
    
    // Update all menu elements
    if (menuElements.sidebar) {
        menuElements.sidebar.classList.remove('open');
    }
    
    if (menuElements.overlay) {
        menuElements.overlay.classList.remove('show');
    }
    
    if (menuElements.hamburger) {
        menuElements.hamburger.classList.remove('menu-open');
    }
    
    // Restore body scroll
    document.body.style.overflow = 'auto';
}

// Toggle menu function
function toggleMenu() {
    if (isMenuOpen) {
        closeMenu();
    } else {
        openMenu();
    }
}

// Legacy support - keeping for backward compatibility
function toggleSidebar() {
    toggleMenu();
}

// ===== IMAGE MODAL FUNCTIONALITY =====

let imageModal = null;

function initImageModal() {
    // Add single keyboard listener
    document.addEventListener('keydown', function(e) {
        if (!isImageModalOpen) return;
        
        switch(e.key) {
            case 'Escape':
                closeImageModal();
                break;
            case 'ArrowLeft':
                previousImage();
                break;
            case 'ArrowRight':
                nextImage();
                break;
        }
    });

    // Add single backdrop click listener to modal
    const modal = document.getElementById('imageModal');
    if (modal) {
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                closeImageModal();
            }
        });
    }
}

// Global modal instance variable
let currentModalInstance = null;
let currentImages = [];
let currentImageIndex = 0;
let isImageModalOpen = false;

function openImageModal(productId, productName) {
    const modal = document.getElementById('imageModal');
    const modalImage = document.getElementById('modalImage');
    const prevBtn = document.getElementById('prevImageBtn');
    const nextBtn = document.getElementById('nextImageBtn');
    const imageCounter = document.getElementById('imageCounter');
    const currentIndexSpan = document.getElementById('currentImageIndex');
    const totalImagesSpan = document.getElementById('totalImages');
    
    if (!modal || !modalImage) {
        console.error('Modal elements not found');
        return;
    }
    
    // Get images from data attribute
    const imageContainer = document.querySelector(`[data-testid="button-image-${productId}"]`);
    let images = [];
    
    if (imageContainer && imageContainer.dataset.images) {
        try {
            images = JSON.parse(imageContainer.dataset.images);
        } catch (e) {
            console.error('Error parsing images:', e);
            images = [];
        }
    }
    
    // Setup images array
    currentImages = images || [];
    currentImageIndex = 0;
    
    // Filter out null/undefined images
    currentImages = currentImages.filter(img => img && img.trim());
    
    if (currentImages.length === 0) {
        currentImages = ['/img/placeholder-product.svg'];
    }
    
    // Set first image
    updateModalImage();
    
    // Show/hide navigation buttons and counter based on image count
    const hasMultipleImages = currentImages.length > 1;
    
    prevBtn.style.display = hasMultipleImages ? 'flex' : 'none';
    nextBtn.style.display = hasMultipleImages ? 'flex' : 'none';
    imageCounter.style.display = hasMultipleImages ? 'block' : 'none';
    
    if (hasMultipleImages) {
        currentIndexSpan.textContent = currentImageIndex + 1;
        totalImagesSpan.textContent = currentImages.length;
    }
    
    // Set alt text
    modalImage.alt = productName;
    
    // Show modal manually for better control
    modal.style.display = 'flex';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100%';
    modal.style.height = '100%';
    modal.style.backgroundColor = 'rgba(0,0,0,0.8)';
    modal.style.zIndex = '9999';
    
    // Set modal open state
    isImageModalOpen = true;
    
    // Prevent body scroll
    document.body.style.overflow = 'hidden';
}

function updateModalImage() {
    const modalImage = document.getElementById('modalImage');
    const currentIndexSpan = document.getElementById('currentImageIndex');
    
    if (modalImage && currentImages.length > 0) {
        const imageSrc = currentImages[currentImageIndex];
        modalImage.src = imageSrc.startsWith('/') ? imageSrc : '/' + imageSrc;
        
        if (currentIndexSpan) {
            currentIndexSpan.textContent = currentImageIndex + 1;
        }
    }
}

function previousImage() {
    if (currentImages.length > 1) {
        currentImageIndex = currentImageIndex === 0 ? currentImages.length - 1 : currentImageIndex - 1;
        updateModalImage();
    }
}

function nextImage() {
    if (currentImages.length > 1) {
        currentImageIndex = currentImageIndex === currentImages.length - 1 ? 0 : currentImageIndex + 1;
        updateModalImage();
    }
}

function closeImageModal() {
    if (!isImageModalOpen) return;
    
    const modal = document.getElementById('imageModal');
    
    if (modal) {
        // Hide modal
        modal.style.display = 'none';
        
        // Set modal closed state
        isImageModalOpen = false;
        
        // Restore body scroll
        document.body.style.overflow = 'auto';
        
        // Clear image to save memory
        const modalImage = document.getElementById('modalImage');
        if (modalImage) {
            modalImage.src = '';
        }
    }
    
    // Clean up instance
    currentModalInstance = null;
}

// ===== PRODUCT DELETION =====

async function toggleProductStatus(productId, newStatus) {
    try {
        const response = await fetch(`/products/toggle/${productId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        });
        
        if (response.ok) {
            // Reload the page to show updated status
            window.location.reload();
        } else {
            throw new Error('Failed to toggle product status');
        }
    } catch (error) {
        console.error('Error toggling product status:', error);
        alert('Ürün durumu değiştirilirken hata oluştu. Lütfen tekrar deneyin.');
    }
}

// Smooth scrolling for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// Enhanced form handling - handled by validation system

// Product card interactions
document.querySelectorAll('.product-card').forEach(card => {
    // Add hover effects for better UX
    card.addEventListener('mouseenter', function() {
        this.style.transform = 'translateY(-4px)';
    });
    
    card.addEventListener('mouseleave', function() {
        this.style.transform = 'translateY(-2px)';
    });
});

// Statistics cards animation on load
function animateStats() {
    const statCards = document.querySelectorAll('.stat-card');
    statCards.forEach((card, index) => {
        setTimeout(() => {
            card.classList.add('fade-in-up');
        }, index * 100);
    });
}

// Initialize stats animation
setTimeout(animateStats, 500);

// Global variables for charts and modal management
let dailySalesChart = null;
let monthlyMovementsChart = null;
let isModalOpen = false;

// Statistics Modal Functions
function openStatsModal(productId, productName, productStatus) {
    if (isModalOpen) return; // Prevent multiple opens
    
    const modal = document.getElementById('statsModal');
    const modalProductName = document.getElementById('modalProductName');
    const modalProductId = document.getElementById('modalProductId');
    const modalProductStatus = document.getElementById('modalProductStatus');
    
    // Destroy existing charts first to prevent memory leaks
    destroyCharts();
    
    // Update modal header (safely escape content)
    modalProductName.textContent = productName || 'Unknown Product';
    modalProductId.textContent = `ID: ${productId || 'N/A'}`;
    
    // Update status badge
    modalProductStatus.textContent = productStatus || 'Unknown';
    modalProductStatus.className = `badge ${productStatus === 'Aktif' ? 'badge-success' : 'badge-muted'}`;
    
    // Show modal
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    isModalOpen = true;
    
    // Create charts after modal is visible
    setTimeout(() => {
        createStatsCharts();
    }, 100);
}

function closeStatsModal() {
    const modal = document.getElementById('statsModal');
    if (!modal || !isModalOpen) return;
    
    modal.style.display = 'none';
    document.body.style.overflow = 'auto';
    isModalOpen = false;
    
    // Destroy existing charts
    destroyCharts();
}

// Helper function to destroy charts safely
function destroyCharts() {
    if (dailySalesChart) {
        dailySalesChart.destroy();
        dailySalesChart = null;
    }
    if (monthlyMovementsChart) {
        monthlyMovementsChart.destroy();
        monthlyMovementsChart = null;
    }
}

// Generate dummy data for daily sales (30 days)
function generateDailySalesData() {
    const labels = [];
    const data = [];
    const today = new Date();
    
    for (let i = 29; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        labels.push(date.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' }));
        // Generate random sales data between 5-25
        data.push(Math.floor(Math.random() * 20) + 5);
    }
    
    return { labels, data };
}

// Generate dummy data for monthly movements (6 months)
function generateMonthlyMovementsData() {
    const labels = [];
    const inData = [];
    const outData = [];
    const today = new Date();
    
    for (let i = 5; i >= 0; i--) {
        const date = new Date(today);
        date.setMonth(date.getMonth() - i);
        labels.push(date.toLocaleDateString('tr-TR', { month: 'short', year: '2-digit' }));
        // Generate random in/out data
        inData.push(Math.floor(Math.random() * 100) + 50);
        outData.push(Math.floor(Math.random() * 80) + 30);
    }
    
    return { labels, inData, outData };
}

// Create Chart.js charts
function createStatsCharts() {
    const dailySalesCtx = document.getElementById('dailySalesChart');
    const monthlyMovementsCtx = document.getElementById('monthlyMovementsChart');
    
    if (!dailySalesCtx || !monthlyMovementsCtx) return;
    
    // Daily Sales Line Chart
    const dailySalesData = generateDailySalesData();
    dailySalesChart = new Chart(dailySalesCtx, {
        type: 'line',
        data: {
            labels: dailySalesData.labels,
            datasets: [{
                label: 'Günlük Satış',
                data: dailySalesData.data,
                borderColor: '#2563EB',
                backgroundColor: 'rgba(37, 99, 235, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4,
                pointBackgroundColor: '#2563EB',
                pointBorderColor: '#FFFFFF',
                pointBorderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: '#E5E7EB'
                    },
                    ticks: {
                        color: '#6B7280'
                    }
                },
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        color: '#6B7280'
                    }
                }
            },
            elements: {
                point: {
                    hoverBackgroundColor: '#2563EB'
                }
            }
        }
    });
    
    // Monthly Movements Bar Chart
    const monthlyData = generateMonthlyMovementsData();
    monthlyMovementsChart = new Chart(monthlyMovementsCtx, {
        type: 'bar',
        data: {
            labels: monthlyData.labels,
            datasets: [{
                label: 'Giriş',
                data: monthlyData.inData,
                backgroundColor: '#16A34A',
                borderRadius: 4,
                maxBarThickness: 40
            }, {
                label: 'Çıkış',
                data: monthlyData.outData,
                backgroundColor: '#DC2626',
                borderRadius: 4,
                maxBarThickness: 40
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        boxWidth: 12,
                        padding: 15,
                        color: '#6B7280'
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: '#E5E7EB'
                    },
                    ticks: {
                        color: '#6B7280'
                    }
                },
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        color: '#6B7280'
                    }
                }
            }
        }
    });
}

// Modal event listeners
document.addEventListener('DOMContentLoaded', function() {
    // Delegated event listener for statistics buttons
    document.addEventListener('click', function(e) {
        if (e.target.closest('.stats-button')) {
            const button = e.target.closest('.stats-button');
            const productId = button.dataset.productId;
            const productName = button.dataset.productName;
            const productStatus = button.dataset.productStatus;
            
            openStatsModal(productId, productName, productStatus);
        }
    });
    
    // Modal close button
    const closeButton = document.getElementById('modalCloseButton');
    if (closeButton) {
        closeButton.addEventListener('click', closeStatsModal);
    }
    
    // Close modal on backdrop click
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('modal-backdrop') && isModalOpen) {
            closeStatsModal();
        }
    });
    
    // Close modal on ESC key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && isModalOpen) {
            closeStatsModal();
        }
    });
});

// ===== PRODUCT FORM FEATURES =====

// Global variables for product form functionality
let autocompleteDebounceTimer = null;
let isAutocompleteOpen = false;
let allProductNames = [];
let currentSelectedIndex = -1;

// Initialize all product form features
function initProductFormFeatures() {
    console.log('Initializing product form features');
    
    // Initialize autocomplete functionality
    initProductNameAutocomplete();
    
    // Initialize duplicate detection
    initDuplicateDetection();
    
    // Initialize attribute validation
    initAttributeValidation();
    
    // Initialize unit selection validation
    initUnitValidation();
    
    // Initialize form validation
    initFormValidation();
}

// ===== PRODUCT NAME AUTOCOMPLETE =====

function initProductNameAutocomplete() {
    const nameInput = document.getElementById('productName');
    const dropdown = document.getElementById('nameAutocompleteDropdown');
    
    if (!nameInput || !dropdown) return;
    
    // Add event listeners
    nameInput.addEventListener('input', handleAutocompleteInput);
    nameInput.addEventListener('keydown', handleAutocompleteKeydown);
    nameInput.addEventListener('focus', handleAutocompleteFocus);
    nameInput.addEventListener('blur', handleAutocompleteBlur);
    
    // Click outside to close dropdown
    document.addEventListener('click', function(e) {
        if (!nameInput.contains(e.target) && !dropdown.contains(e.target)) {
            closeAutocompleteDropdown();
        }
    });
}

function handleAutocompleteInput(e) {
    const searchTerm = e.target.value.trim();
    
    // Clear previous debounce timer
    if (autocompleteDebounceTimer) {
        clearTimeout(autocompleteDebounceTimer);
    }
    
    // Set new debounce timer (300ms)
    autocompleteDebounceTimer = setTimeout(() => {
        if (searchTerm.length >= 2) {
            fetchAutocompleteSuggestions(searchTerm);
        } else {
            closeAutocompleteDropdown();
        }
    }, 300);
}

function handleAutocompleteKeydown(e) {
    if (!isAutocompleteOpen) return;
    
    const dropdown = document.getElementById('nameAutocompleteDropdown');
    const items = dropdown.querySelectorAll('.autocomplete-item');
    
    switch (e.key) {
        case 'ArrowDown':
            e.preventDefault();
            currentSelectedIndex = Math.min(currentSelectedIndex + 1, items.length - 1);
            updateAutocompleteSelection(items);
            break;
            
        case 'ArrowUp':
            e.preventDefault();
            currentSelectedIndex = Math.max(currentSelectedIndex - 1, -1);
            updateAutocompleteSelection(items);
            break;
            
        case 'Enter':
            e.preventDefault();
            if (currentSelectedIndex >= 0 && items[currentSelectedIndex]) {
                selectAutocompleteItem(items[currentSelectedIndex]);
            }
            break;
            
        case 'Escape':
            e.preventDefault();
            closeAutocompleteDropdown();
            break;
    }
}

function handleAutocompleteFocus(e) {
    const searchTerm = e.target.value.trim();
    if (searchTerm.length >= 2) {
        fetchAutocompleteSuggestions(searchTerm);
    } else if (searchTerm.length === 0) {
        // Show popular products when focused with empty input
        fetchPopularProducts();
    }
}

function handleAutocompleteBlur(e) {
    // Delay blur to allow click events on dropdown items
    setTimeout(() => {
        closeAutocompleteDropdown();
    }, 150);
}

async function fetchAutocompleteSuggestions(searchTerm) {
    try {
        showAutocompleteLoading();
        
        const response = await fetch(`/api/products/names?q=${encodeURIComponent(searchTerm)}`);
        if (!response.ok) {
            throw new Error('Failed to fetch suggestions');
        }
        
        const suggestions = await response.json();
        displayAutocompleteSuggestions(suggestions);
        
    } catch (error) {
        console.error('Error fetching autocomplete suggestions:', error);
        showAutocompleteError();
    }
}

async function fetchPopularProducts() {
    try {
        showAutocompleteLoading();
        
        const response = await fetch('/api/products/popular');
        if (!response.ok) {
            throw new Error('Failed to fetch popular products');
        }
        
        const popularProducts = await response.json();
        displayAutocompleteSuggestions(popularProducts, true); // Add flag for popular products
        
    } catch (error) {
        console.error('Error fetching popular products:', error);
        showAutocompleteError();
    }
}

function showAutocompleteLoading() {
    const dropdown = document.getElementById('nameAutocompleteDropdown');
    dropdown.innerHTML = '<div class="autocomplete-loading"><i class="fas fa-spinner fa-spin"></i> Yükleniyor...</div>';
    dropdown.style.display = 'block';
    isAutocompleteOpen = true;
}

function showAutocompleteError() {
    const dropdown = document.getElementById('nameAutocompleteDropdown');
    dropdown.innerHTML = '<div class="autocomplete-error"><i class="fas fa-exclamation-triangle"></i> Öneriler yüklenemedi</div>';
    dropdown.style.display = 'block';
    isAutocompleteOpen = true;
}

function displayAutocompleteSuggestions(suggestions, isPopular = false) {
    const dropdown = document.getElementById('nameAutocompleteDropdown');
    
    if (!suggestions || suggestions.length === 0) {
        const message = isPopular ? 'Popüler ürün bulunamadı' : 'Eşleşen ürün bulunamadı';
        dropdown.innerHTML = `<div class="autocomplete-empty">${message}</div>`;
        dropdown.style.display = 'block';
        isAutocompleteOpen = true;
        return;
    }
    
    // Add header for popular products
    const headerHtml = isPopular ? 
        '<div class="autocomplete-header"><i class="fas fa-star"></i> Popüler Ürünler</div>' : '';
    
    const html = suggestions.map((productGroup) => {
        const mainItem = `
            <div class="autocomplete-item main-item" data-product-id="${productGroup.firstId}" data-product-name="${productGroup.name}">
                <div class="item-content">
                    <div class="item-header">
                        <i class="fas fa-box"></i>
                        <span class="product-name">${productGroup.name}</span>
                        <span class="variant-count">(${productGroup.variants.length} varyant)</span>
                    </div>
                </div>
            </div>
        `;
        
        const variants = productGroup.variants.map((variant) => {
            const attributesText = variant.attributes && variant.attributes.length > 0 
                ? variant.attributes.map(attr => `${attr.name}: ${attr.value}`).join(', ')
                : 'Özellik yok';
            
            const statusClass = variant.status === 'Aktif' ? 'status-active' : 'status-inactive';
            
            return `
                <div class="autocomplete-item variant-item" data-product-id="${variant.id}" data-product-name="${productGroup.name}">
                    <div class="item-content">
                        <div class="variant-info">
                            <i class="fas fa-tag"></i>
                            <span class="attributes">${attributesText}</span>
                            <span class="price">${variant.sellPrice} ${variant.sellCurrency}</span>
                            <span class="status ${statusClass}">${variant.status}</span>
                        </div>
                        <div class="variant-actions">
                            <button class="variant-action-btn edit-btn" onclick="window.location.href='/products/${variant.id}/edit'" title="Düzenle">
                                <i class="fas fa-edit"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
        return mainItem + variants;
    }).join('');
    
    dropdown.innerHTML = headerHtml + html;
    dropdown.style.display = 'block';
    isAutocompleteOpen = true;
    currentSelectedIndex = -1;
    
    // Add click listeners to main items (not variants)
    dropdown.querySelectorAll('.autocomplete-item.main-item').forEach(item => {
        item.addEventListener('click', () => selectAutocompleteItem(item));
    });
    
    // Prevent click propagation on edit buttons
    dropdown.querySelectorAll('.variant-action-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    });
}

function updateAutocompleteSelection(items) {
    items.forEach((item, index) => {
        if (index === currentSelectedIndex) {
            item.classList.add('selected');
        } else {
            item.classList.remove('selected');
        }
    });
}

function selectAutocompleteItem(item) {
    const productName = item.dataset.productName;
    const nameInput = document.getElementById('productName');
    
    nameInput.value = productName;
    closeAutocompleteDropdown();
    
    // Trigger duplicate detection
    checkForDuplicateProduct(productName);
}

function closeAutocompleteDropdown() {
    const dropdown = document.getElementById('nameAutocompleteDropdown');
    dropdown.style.display = 'none';
    isAutocompleteOpen = false;
    currentSelectedIndex = -1;
}

// ===== DUPLICATE DETECTION =====

function initDuplicateDetection() {
    const nameInput = document.getElementById('productName');
    if (!nameInput) return;
    
    // Check for duplicates on blur (with delay for autocomplete)
    nameInput.addEventListener('blur', function(e) {
        setTimeout(() => {
            const productName = e.target.value.trim();
            if (productName) {
                checkForDuplicateProduct(productName);
            }
        }, 200);
    });
}

async function checkForDuplicateProduct(productName) {
    const warning = document.getElementById('duplicateWarning');
    const currentProduct = getCurrentProductBeingEdited(); // Get current product ID if editing
    
    try {
        const response = await fetch(`/api/products/names?q=${encodeURIComponent(productName)}`);
        if (!response.ok) return;
        
        const products = await response.json();
        
        // Find exact match (case-insensitive)
        const exactMatch = products.find(product => 
            product.name.toLowerCase() === productName.toLowerCase() &&
            product.id !== currentProduct?.id // Exclude current product when editing
        );
        
        if (exactMatch) {
            showDuplicateWarning(exactMatch);
        } else {
            hideDuplicateWarning();
        }
        
    } catch (error) {
        console.error('Error checking for duplicate product:', error);
        hideDuplicateWarning();
    }
}

function getCurrentProductBeingEdited() {
    // Check if we're editing (form action contains /update)
    const form = document.getElementById('productForm');
    if (form && form.action.includes('/update')) {
        const matches = form.action.match(/\/products\/([^\/]+)\/update/);
        return matches ? { id: matches[1] } : null;
    }
    return null;
}

function showDuplicateWarning(product) {
    const warning = document.getElementById('duplicateWarning');
    const message = document.getElementById('duplicateMessage');
    const editLink = document.getElementById('duplicateEditLink');
    
    if (warning && message && editLink) {
        message.textContent = 'Bu adla bir ürün zaten var.';
        editLink.href = `/products/${product.id}/edit`;
        warning.style.display = 'flex';
    }
}

function hideDuplicateWarning() {
    const warning = document.getElementById('duplicateWarning');
    if (warning) {
        warning.style.display = 'none';
    }
}

// ===== ATTRIBUTE VALIDATION =====

function initAttributeValidation() {
    const attributeInputs = document.querySelectorAll('[id^="attribute_"]');
    const saveButton = document.querySelector('button[type="submit"][form="productForm"]');
    
    if (attributeInputs.length === 0) return; // No attributes to validate
    
    // Add event listeners to all attribute inputs
    attributeInputs.forEach(input => {
        input.addEventListener('input', validateAttributes);
        input.addEventListener('change', validateAttributes);
    });
    
    // Initial validation
    validateAttributes();
}

function validateAttributes() {
    const attributeInputs = document.querySelectorAll('[id^="attribute_"]');
    let filledAttributes = 0;
    
    attributeInputs.forEach(input => {
        const value = input.value.trim();
        if (value) {
            filledAttributes++;
        }
    });
    
    const hasValidAttributes = filledAttributes >= 1;
    updateAttributeValidationUI(hasValidAttributes, filledAttributes, attributeInputs.length);
    
    return hasValidAttributes;
}

function updateAttributeValidationUI(isValid, filledCount, totalCount) {
    const saveButton = document.querySelector('button[type="submit"][form="productForm"]');
    let validationMessage = document.getElementById('attributeValidationMessage');
    
    // Create validation message element if it doesn't exist
    if (!validationMessage) {
        validationMessage = document.createElement('div');
        validationMessage.id = 'attributeValidationMessage';
        validationMessage.className = 'validation-message';
        
        // Insert after the attributes section
        const attributesSection = document.querySelector('.form-section:has([id^="attribute_"])');
        if (attributesSection) {
            attributesSection.appendChild(validationMessage);
        }
    }
    
    if (!isValid && totalCount > 0) {
        validationMessage.innerHTML = `
            <i class="fas fa-exclamation-triangle"></i>
            En az 1 ürün özelliği doldurulmalıdır (${filledCount}/${totalCount} dolu)
        `;
        validationMessage.style.display = 'flex';
        validationMessage.className = 'validation-message validation-error';
    } else if (isValid && totalCount > 0) {
        validationMessage.innerHTML = `
            <i class="fas fa-check-circle"></i>
            Ürün özellikleri geçerli (${filledCount}/${totalCount} dolu)
        `;
        validationMessage.style.display = 'flex';
        validationMessage.className = 'validation-message validation-success';
        
        // Hide success message after 3 seconds
        setTimeout(() => {
            validationMessage.style.display = 'none';
        }, 3000);
    } else {
        validationMessage.style.display = 'none';
    }
}

// ===== UNIT SELECTION VALIDATION =====

function initUnitValidation() {
    const unitSelect = document.getElementById('productUnit');
    if (!unitSelect) return;
    
    unitSelect.addEventListener('change', validateUnit);
    validateUnit(); // Initial validation
}

function validateUnit() {
    const unitSelect = document.getElementById('productUnit');
    const unitValue = unitSelect?.value;
    
    const isValid = unitValue && unitValue.trim() !== '';
    updateUnitValidationUI(isValid);
    
    return isValid;
}

function updateUnitValidationUI(isValid) {
    const unitSelect = document.getElementById('productUnit');
    if (!unitSelect) return;
    
    if (isValid) {
        unitSelect.classList.remove('error');
    } else {
        unitSelect.classList.add('error');
    }
}

// ===== FORM VALIDATION =====

function initFormValidation() {
    const form = document.getElementById('productForm');
    if (!form) return;
    
    form.addEventListener('submit', handleFormSubmit);
}

function handleFormSubmit(e) {
    e.preventDefault();
    
    const isValid = validateEntireForm();
    
    if (isValid) {
        // Allow form to submit normally
        e.target.submit();
    } else {
        // Focus on first invalid field
        focusFirstInvalidField();
    }
}

function validateEntireForm() {
    let isValid = true;
    const validationErrors = [];
    
    // Validate product name (required)
    const nameInput = document.getElementById('productName');
    if (!nameInput?.value.trim()) {
        validationErrors.push('Ürün adı gereklidir');
        nameInput?.classList.add('error');
        isValid = false;
    } else {
        nameInput?.classList.remove('error');
    }
    
    // Validate sell price (required)
    const sellPriceInput = document.querySelector('[name="sellPrice"]');
    const sellPrice = parseFloat(sellPriceInput?.value || '0');
    if (!sellPrice || sellPrice <= 0) {
        validationErrors.push('Satış fiyatı gereklidir ve 0\'dan büyük olmalıdır');
        sellPriceInput?.classList.add('error');
        isValid = false;
    } else {
        sellPriceInput?.classList.remove('error');
    }
    
    // Validate unit selection
    if (!validateUnit()) {
        validationErrors.push('Birim seçimi gereklidir');
        isValid = false;
    }
    
    // Validate attributes (if any exist)
    const attributeInputs = document.querySelectorAll('[id^="attribute_"]');
    if (attributeInputs.length > 0 && !validateAttributes()) {
        validationErrors.push('En az 1 ürün özelliği doldurulmalıdır');
        isValid = false;
    }
    
    // Display validation summary
    displayValidationSummary(validationErrors);
    
    return isValid;
}

function displayValidationSummary(errors) {
    let summaryElement = document.getElementById('validationSummary');
    
    if (errors.length === 0) {
        // Remove validation summary if no errors
        if (summaryElement) {
            summaryElement.remove();
        }
        return;
    }
    
    // Create validation summary if it doesn't exist
    if (!summaryElement) {
        summaryElement = document.createElement('div');
        summaryElement.id = 'validationSummary';
        summaryElement.className = 'validation-summary validation-error';
        
        // Insert at the top of the form
        const form = document.getElementById('productForm');
        form.insertBefore(summaryElement, form.firstChild);
    }
    
    const errorList = errors.map(error => `<li>${error}</li>`).join('');
    summaryElement.innerHTML = `
        <div class="validation-header">
            <i class="fas fa-exclamation-triangle"></i>
            <strong>Form doğrulama hataları:</strong>
        </div>
        <ul class="validation-errors">${errorList}</ul>
    `;
    
    // Scroll to validation summary
    summaryElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function focusFirstInvalidField() {
    const invalidFields = [
        document.getElementById('productName'),
        document.querySelector('[name="sellPrice"]'),
        document.getElementById('productUnit'),
        ...document.querySelectorAll('[id^="attribute_"]')
    ].filter(field => field && field.classList.contains('error'));
    
    if (invalidFields.length > 0) {
        invalidFields[0].focus();
    }
}

// ===== FILTERING SYSTEM =====

// Global filter state (only for non-products pages)
if (typeof window.filterState === 'undefined') {
    window.filterState = {
        searchTerm: '',
        status: 'all',
        buyMinPrice: '',
        buyMaxPrice: '',
        sellMinPrice: '',
        sellMaxPrice: '',
        buyCurrency: 'all',
        sellCurrency: 'all',
        selectedAttributes: new Map()
    };
}

// Ensure selectedAttributes is always a Map
if (!window.filterState.selectedAttributes || !(window.filterState.selectedAttributes instanceof Map)) {
    window.filterState.selectedAttributes = new Map();
}

// ===== URL PARAMETER PERSISTENCE =====

// Read filter state from URL query parameters
function readFiltersFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    const newFilterState = {
        searchTerm: urlParams.get('search') || '',
        status: urlParams.get('status') || 'all',
        buyMinPrice: urlParams.get('buyMin') || '',
        buyMaxPrice: urlParams.get('buyMax') || '',
        sellMinPrice: urlParams.get('sellMin') || '',
        sellMaxPrice: urlParams.get('sellMax') || '',
        buyCurrency: urlParams.get('buyCurrency') || 'all',
        sellCurrency: urlParams.get('sellCurrency') || 'all',
        selectedAttributes: new Map()
    };
    
    // Handle attributes from URL
    urlParams.forEach((value, key) => {
        if (key.startsWith('attr_')) {
            const attributeId = key.substring(5); // Remove 'attr_' prefix
            const values = value.split(',').filter(v => v.trim() !== '');
            if (values.length > 0) {
                newFilterState.selectedAttributes.set(attributeId, values);
            }
        }
    });
    
    return newFilterState;
}

// Write current filter state to URL query parameters
function writeFiltersToURL() {
    const urlParams = new URLSearchParams();
    
    // Add basic filters
    if (window.filterState.searchTerm) {
        urlParams.set('search', window.filterState.searchTerm);
    }
    if (window.filterState.status !== 'all') {
        urlParams.set('status', window.filterState.status);
    }
    if (window.filterState.buyMinPrice) {
        urlParams.set('buyMin', window.filterState.buyMinPrice);
    }
    if (window.filterState.buyMaxPrice) {
        urlParams.set('buyMax', window.filterState.buyMaxPrice);
    }
    if (window.filterState.sellMinPrice) {
        urlParams.set('sellMin', window.filterState.sellMinPrice);
    }
    if (window.filterState.sellMaxPrice) {
        urlParams.set('sellMax', window.filterState.sellMaxPrice);
    }
    if (window.filterState.buyCurrency !== 'all') {
        urlParams.set('buyCurrency', window.filterState.buyCurrency);
    }
    if (window.filterState.sellCurrency !== 'all') {
        urlParams.set('sellCurrency', window.filterState.sellCurrency);
    }
    
    // Add attribute filters
    if (window.filterState.selectedAttributes) {
        window.filterState.selectedAttributes.forEach((values, attributeId) => {
            if (values.length > 0) {
                urlParams.set(`attr_${attributeId}`, values.join(','));
            }
        });
    }
    
    // Update URL without page refresh
    const newURL = urlParams.toString() ? 
        `${window.location.pathname}?${urlParams.toString()}` : 
        window.location.pathname;
    
    window.history.replaceState({}, '', newURL);
}

// Clear all URL parameters
function clearURLParameters() {
    window.history.replaceState({}, '', window.location.pathname);
}

// Restore UI state from current filter state
function restoreUIFromFilterState() {
    // Search input
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.value = window.filterState.searchTerm;
    }
    
    // Status radio buttons
    const statusRadios = document.querySelectorAll('input[name="status"]');
    statusRadios.forEach(radio => {
        radio.checked = radio.value === window.filterState.status;
    });
    
    // Price inputs
    const priceInputs = {
        'buyMinPrice': window.filterState.buyMinPrice,
        'buyMaxPrice': window.filterState.buyMaxPrice,
        'sellMinPrice': window.filterState.sellMinPrice,
        'sellMaxPrice': window.filterState.sellMaxPrice
    };
    
    Object.entries(priceInputs).forEach(([id, value]) => {
        const input = document.getElementById(id);
        if (input) {
            input.value = value;
        }
    });
    
    // Currency selectors
    const buyCurrencySelect = document.getElementById('buyCurrencySelect');
    const sellCurrencySelect = document.getElementById('sellCurrencySelect');
    if (buyCurrencySelect) {
        buyCurrencySelect.value = window.filterState.buyCurrency || 'all';
    }
    if (sellCurrencySelect) {
        sellCurrencySelect.value = window.filterState.sellCurrency || 'all';
    }
    
    // Attribute checkboxes
    const attributeCheckboxes = document.querySelectorAll('input[name^="attr_"]');
    attributeCheckboxes.forEach(checkbox => {
        checkbox.checked = false; // Reset first
        
        const attributeId = checkbox.name.replace('attr_', '');
        const selectedValues = window.filterState.selectedAttributes.get(attributeId);
        
        if (selectedValues && selectedValues.includes(checkbox.value)) {
            checkbox.checked = true;
            
            // Expand the accordion if any attribute is selected
            const accordionButton = checkbox.closest('.accordion-item')?.querySelector('.accordion-toggle');
            if (accordionButton && !accordionButton.classList.contains('active')) {
                toggleAccordion(accordionButton);
            }
        }
    });
}

// Debounce helper function
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Toggle filter panel - Centered Modal
function toggleFilterPanel() {
    const panel = document.getElementById('filterPanel');
    const overlay = document.getElementById('filterOverlay');
    
    if (!panel || !overlay) return;
    
    const isOpen = panel.classList.contains('open');
    
    if (isOpen) {
        // Close modal with fade and scale out
        panel.classList.remove('open');
        panel.style.opacity = '0';
        panel.style.transform = 'translate(-50%, -50%) scale(0.9)';
        panel.style.visibility = 'hidden';
        overlay.classList.remove('show');
        overlay.style.display = 'none';
        document.body.style.overflow = '';
    } else {
        // Open modal with fade and scale in
        panel.classList.add('open');
        panel.style.opacity = '1';
        panel.style.transform = 'translate(-50%, -50%) scale(1)';
        panel.style.visibility = 'visible';
        overlay.classList.add('show');
        overlay.style.display = 'block';
        document.body.style.overflow = 'hidden';
    }
}

// Apply filters to products
function applyFilters() {
    console.log('Applying filters with state:', window.filterState);
    
    const productCards = document.querySelectorAll('.product-card');
    let visibleCount = 0;
    
    productCards.forEach(card => {
        const isVisible = shouldShowProduct(card);
        
        if (isVisible) {
            card.style.display = 'block';
            visibleCount++;
        } else {
            card.style.display = 'none';
        }
    });
    
    // Update active filters count
    updateActiveFiltersCount();
    
    // Update stats or show no results message
    console.log(`Filtered results: ${visibleCount} products visible`);
    
    // Show/hide empty state
    toggleEmptyState(visibleCount === 0);
    
    // Update URL with current filter state
    writeFiltersToURL();
}

// Determine if a product should be shown based on current filters
function shouldShowProduct(card) {
    const productData = {
        name: card.dataset.name?.toLowerCase() || '',
        description: card.dataset.description?.toLowerCase() || '',
        status: card.dataset.status || '',
        buyPrice: parseFloat(card.dataset.buyPrice) || 0,
        sellPrice: parseFloat(card.dataset.sellPrice) || 0,
        buyCurrency: card.dataset.buyCurrency || 'USD',
        sellCurrency: card.dataset.sellCurrency || 'USD',
        stock: parseInt(card.dataset.stock) || 0,
        attributes: card.dataset.attributes ? JSON.parse(card.dataset.attributes) : []
    };
    
    // Search filter
    if (window.filterState.searchTerm && 
        !productData.name.includes(window.filterState.searchTerm.toLowerCase()) &&
        !productData.description.includes(window.filterState.searchTerm.toLowerCase())) {
        return false;
    }
    
    // Status filter
    if (window.filterState.status !== 'all' && productData.status !== window.filterState.status) {
        return false;
    }
    
    // Buy price filter (only apply if currency matches or no currency filter)
    if ((window.filterState.buyMinPrice !== '' || window.filterState.buyMaxPrice !== '') &&
        (window.filterState.buyCurrency === 'all' || window.filterState.buyCurrency === productData.buyCurrency)) {
        
        if (window.filterState.buyMinPrice !== '' && productData.buyPrice < parseFloat(window.filterState.buyMinPrice)) {
            return false;
        }
        if (window.filterState.buyMaxPrice !== '' && productData.buyPrice > parseFloat(window.filterState.buyMaxPrice)) {
            return false;
        }
    }
    
    // Sell price filter (only apply if currency matches or no currency filter)
    if ((window.filterState.sellMinPrice !== '' || window.filterState.sellMaxPrice !== '') &&
        (window.filterState.sellCurrency === 'all' || window.filterState.sellCurrency === productData.sellCurrency)) {
        
        if (window.filterState.sellMinPrice !== '' && productData.sellPrice < parseFloat(window.filterState.sellMinPrice)) {
            return false;
        }
        if (window.filterState.sellMaxPrice !== '' && productData.sellPrice > parseFloat(window.filterState.sellMaxPrice)) {
            return false;
        }
    }
    
    // Attribute filters
    if (window.filterState.selectedAttributes && window.filterState.selectedAttributes.size > 0) {
        for (let [attributeId, selectedValues] of window.filterState.selectedAttributes) {
            if (selectedValues.length === 0) continue;
            
            const productAttribute = productData.attributes.find(attr => attr.attributeId === attributeId);
            if (!productAttribute || !selectedValues.includes(productAttribute.value)) {
                return false;
            }
        }
    }
    
    return true;
}

// Update active filters count badge and chips
function updateActiveFiltersCount() {
    const badge = document.getElementById('activeFiltersCount');
    if (!badge) return;
    
    let count = 0;
    
    if (window.filterState.searchTerm) count++;
    if (window.filterState.status !== 'all') count++;
    if (window.filterState.buyMinPrice || window.filterState.buyMaxPrice) count++;
    if (window.filterState.sellMinPrice || window.filterState.sellMaxPrice) count++;
    if (window.filterState.buyCurrency !== 'all' || window.filterState.sellCurrency !== 'all') count++;
    count += (window.filterState.selectedAttributes ? window.filterState.selectedAttributes.size : 0);
    
    if (count > 0) {
        badge.textContent = count;
        badge.style.display = 'inline-block';
    } else {
        badge.style.display = 'none';
    }
    
    // Update active filter chips
    renderActiveFilterChips();
}

// Render active filter chips
function renderActiveFilterChips() {
    const activeFiltersSection = document.getElementById('activeFiltersSection');
    const activeFiltersContainer = document.getElementById('activeFiltersContainer');
    
    if (!activeFiltersSection || !activeFiltersContainer) return;
    
    // Clear existing chips
    activeFiltersContainer.innerHTML = '';
    
    const chips = [];
    
    // Search term chip
    if (window.filterState.searchTerm) {
        chips.push({
            type: 'search',
            label: `Arama: "${window.filterState.searchTerm}"`,
            onRemove: () => {
                document.getElementById('searchInput').value = '';
                window.filterState.searchTerm = '';
                applyFilters();
            }
        });
    }
    
    // Status chip
    if (window.filterState.status !== 'all') {
        const statusLabels = {
            'Aktif': 'Aktif',
            'Pasif': 'Pasif'
        };
        chips.push({
            type: 'status',
            label: `Durum: ${statusLabels[window.filterState.status] || window.filterState.status}`,
            onRemove: () => {
                const allRadio = document.querySelector('input[name="status"][value="all"]');
                if (allRadio) allRadio.checked = true;
                window.filterState.status = 'all';
                applyFilters();
            }
        });
    }
    
    // Buy price range chip
    if (window.filterState.buyMinPrice || window.filterState.buyMaxPrice) {
        const min = window.filterState.buyMinPrice || '0';
        const max = window.filterState.buyMaxPrice || '∞';
        const currency = window.filterState.buyCurrency || 'USD';
        chips.push({
            type: 'buy-price',
            label: `Alış: ${min} - ${max} ${currency}`,
            onRemove: () => {
                const buyMinInput = document.getElementById('buyMinPrice');
                const buyMaxInput = document.getElementById('buyMaxPrice');
                const buyCurrencySelect = document.getElementById('buyCurrencySelect');
                if (buyMinInput) buyMinInput.value = '';
                if (buyMaxInput) buyMaxInput.value = '';
                if (buyCurrencySelect) buyCurrencySelect.value = 'all';
                window.filterState.buyMinPrice = '';
                window.filterState.buyMaxPrice = '';
                window.filterState.buyCurrency = 'all';
                applyFilters();
            }
        });
    }
    
    // Sell price range chip
    if (window.filterState.sellMinPrice || window.filterState.sellMaxPrice) {
        const min = window.filterState.sellMinPrice || '0';
        const max = window.filterState.sellMaxPrice || '∞';
        const currency = window.filterState.sellCurrency || 'USD';
        chips.push({
            type: 'sell-price',
            label: `Satış: ${min} - ${max} ${currency}`,
            onRemove: () => {
                const sellMinInput = document.getElementById('sellMinPrice');
                const sellMaxInput = document.getElementById('sellMaxPrice');
                const sellCurrencySelect = document.getElementById('sellCurrencySelect');
                if (sellMinInput) sellMinInput.value = '';
                if (sellMaxInput) sellMaxInput.value = '';
                if (sellCurrencySelect) sellCurrencySelect.value = 'all';
                window.filterState.sellMinPrice = '';
                window.filterState.sellMaxPrice = '';
                window.filterState.sellCurrency = 'all';
                applyFilters();
            }
        });
    }
    
    // Attribute chips
    if (window.filterState.selectedAttributes) {
        window.filterState.selectedAttributes.forEach((values, attributeId) => {
            if (values.length > 0) {
                // Get attribute name from DOM
                const attributeContainer = document.querySelector(`[data-testid="button-accordion-${attributeId}"]`);
                const attributeName = attributeContainer ? attributeContainer.querySelector('span').textContent : `Attribute ${attributeId}`;
                
                chips.push({
                    type: 'attribute',
                    label: `${attributeName}: ${values.join(', ')}`,
                    onRemove: () => {
                        // Uncheck all related checkboxes
                        const checkboxes = document.querySelectorAll(`input[name="attr_${attributeId}"]`);
                        checkboxes.forEach(cb => cb.checked = false);
                        window.filterState.selectedAttributes.delete(attributeId);
                        applyFilters();
                    }
                });
            }
        });
    }
    
    // Show/hide the active filters section
    if (chips.length > 0) {
        activeFiltersSection.style.display = 'block';
        
        // Render chips
        chips.forEach(chip => {
            const chipElement = document.createElement('div');
            chipElement.className = 'filter-chip';
            chipElement.dataset.testid = `chip-${chip.type}`;
            chipElement.innerHTML = `
                <span class="filter-chip-label"></span>
                <button class="filter-chip-remove" onclick="event.stopPropagation();" data-testid="button-remove-${chip.type}">
                    <i class="fas fa-times"></i>
                </button>
            `;
            
            // Safely set the label text to prevent XSS
            const labelSpan = chipElement.querySelector('.filter-chip-label');
            labelSpan.textContent = chip.label;
            
            // Add click handler to remove button
            const removeBtn = chipElement.querySelector('.filter-chip-remove');
            removeBtn.addEventListener('click', chip.onRemove);
            
            activeFiltersContainer.appendChild(chipElement);
        });
    } else {
        activeFiltersSection.style.display = 'none';
    }
}

// Toggle empty state visibility
function toggleEmptyState(show) {
    const contentBody = document.getElementById('contentBody');
    if (!contentBody) return;
    
    const productsGrid = contentBody.querySelector('.products-grid');
    let emptyState = contentBody.querySelector('.filter-empty-state');
    
    if (show && !emptyState) {
        emptyState = document.createElement('div');
        emptyState.className = 'filter-empty-state text-center';
        emptyState.style.cssText = 'padding: 60px 20px;';
        emptyState.innerHTML = `
            <div class="card" style="max-width: 400px; margin: 0 auto; padding: 40px;">
                <i class="fas fa-search" style="font-size: 3rem; color: var(--muted); margin-bottom: 20px;"></i>
                <h3 style="color: var(--muted); margin-bottom: 12px;">Filtre sonucu bulunamadı</h3>
                <p class="text-muted mb-lg">Arama kriterlerinizi değiştirip tekrar deneyin.</p>
                <button onclick="clearAllFilters()" class="btn btn-primary">
                    <i class="fas fa-times"></i>
                    Filtreleri Temizle
                </button>
            </div>
        `;
        contentBody.appendChild(emptyState);
    } else if (!show && emptyState) {
        emptyState.remove();
    }
    
    if (productsGrid) {
        productsGrid.style.display = show ? 'none' : 'grid';
    }
}

// Clear all filters
function clearAllFilters() {
    console.log('Clearing all filters');
    
    // Reset filter state
    window.filterState = {
        searchTerm: '',
        status: 'all',
        buyMinPrice: '',
        buyMaxPrice: '',
        sellMinPrice: '',
        sellMaxPrice: '',
        buyCurrency: 'all',
        sellCurrency: 'all',
        selectedAttributes: new Map()
    };
    
    // Reset form controls
    const searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.value = '';
    
    // Reset status radio buttons
    const statusRadios = document.querySelectorAll('input[name="status"]');
    statusRadios.forEach(radio => {
        radio.checked = radio.value === 'all';
    });
    
    // Reset price inputs
    ['buyMinPrice', 'buyMaxPrice', 'sellMinPrice', 'sellMaxPrice'].forEach(id => {
        const input = document.getElementById(id);
        if (input) input.value = '';
    });
    
    // Reset currency selectors
    const buyCurrencySelect = document.getElementById('buyCurrencySelect');
    const sellCurrencySelect = document.getElementById('sellCurrencySelect');
    if (buyCurrencySelect) buyCurrencySelect.value = 'all';
    if (sellCurrencySelect) sellCurrencySelect.value = 'all';
    
    // Reset attribute checkboxes
    const attributeCheckboxes = document.querySelectorAll('input[name^="attr_"]');
    attributeCheckboxes.forEach(checkbox => {
        checkbox.checked = false;
    });
    
    // Close accordions
    const accordionToggles = document.querySelectorAll('.accordion-toggle');
    accordionToggles.forEach(toggle => {
        toggle.classList.remove('active');
        const content = toggle.nextElementSibling;
        if (content) content.style.maxHeight = '0px';
    });
    
    // Clear URL parameters
    clearURLParameters();
    
    // Apply cleared filters
    applyFilters();
}

// Initialize filter system
function initFilterSystem() {
    console.log('Initializing filter system');
    
    // FORCE filter panel to be closed by default
    const panel = document.getElementById('filterPanel');
    const overlay = document.getElementById('filterOverlay');
    if (panel) {
        panel.classList.remove('open');
        panel.style.transform = 'translateX(-100%)';
        panel.style.visibility = 'hidden';
    }
    if (overlay) {
        overlay.classList.remove('show');
        overlay.style.display = 'none';
    }
    // Reset body overflow
    document.body.style.overflow = '';
    
    // Initialize from URL parameters first
    const urlFilterState = readFiltersFromURL();
    if (urlFilterState) {
        window.filterState = urlFilterState;
        restoreUIFromFilterState();
    }
    
    // Search input with debounce
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        const debouncedSearch = debounce((value) => {
            window.filterState.searchTerm = value.trim();
            applyFilters();
        }, 300);
        
        searchInput.addEventListener('input', (e) => {
            debouncedSearch(e.target.value);
        });
    }
    
    // Status radio buttons
    const statusRadios = document.querySelectorAll('input[name="status"]');
    statusRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (e.target.checked) {
                window.filterState.status = e.target.value;
                applyFilters();
            }
        });
    });
    
    // Price inputs
    ['buyMinPrice', 'buyMaxPrice', 'sellMinPrice', 'sellMaxPrice'].forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            const debouncedPriceFilter = debounce(() => {
                window.filterState[id] = input.value;
                applyFilters();
            }, 500);
            
            input.addEventListener('input', debouncedPriceFilter);
        }
    });
    
    // Currency selectors
    const buyCurrencySelect = document.getElementById('buyCurrencySelect');
    const sellCurrencySelect = document.getElementById('sellCurrencySelect');
    
    if (buyCurrencySelect) {
        buyCurrencySelect.addEventListener('change', (e) => {
            window.filterState.buyCurrency = e.target.value;
            applyFilters();
        });
    }
    
    if (sellCurrencySelect) {
        sellCurrencySelect.addEventListener('change', (e) => {
            window.filterState.sellCurrency = e.target.value;
            applyFilters();
        });
    }
    
    // Attribute checkboxes
    const attributeCheckboxes = document.querySelectorAll('input[name^="attr_"]');
    attributeCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            const attributeId = e.target.name.replace('attr_', '');
            const value = e.target.value;
            
            if (!window.filterState.selectedAttributes.has(attributeId)) {
                window.filterState.selectedAttributes.set(attributeId, []);
            }
            
            const selectedValues = window.filterState.selectedAttributes.get(attributeId);
            
            if (e.target.checked) {
                if (!selectedValues.includes(value)) {
                    selectedValues.push(value);
                }
            } else {
                const index = selectedValues.indexOf(value);
                if (index > -1) {
                    selectedValues.splice(index, 1);
                }
                
                if (selectedValues.length === 0) {
                    window.filterState.selectedAttributes.delete(attributeId);
                }
            }
            
            applyFilters();
        });
    });
    
    // Initialize accordion functionality
    initAccordions();
    
    // Apply initial filters if any were loaded from URL
    if (urlFilterState && Object.values(urlFilterState).some(val => 
        val !== '' && val !== 'all' && !(val instanceof Map && val.size === 0))) {
        applyFilters();
    }
}

// Accordion functionality
function toggleAccordion(button) {
    const isActive = button.classList.contains('active');
    const content = button.nextElementSibling;
    
    if (isActive) {
        button.classList.remove('active');
        content.style.maxHeight = '0px';
    } else {
        button.classList.add('active');
        content.style.maxHeight = content.scrollHeight + 'px';
    }
}

function initAccordions() {
    const accordionButtons = document.querySelectorAll('.accordion-toggle');
    accordionButtons.forEach(button => {
        button.addEventListener('click', () => toggleAccordion(button));
    });
}

// ===== INITIALIZE FILTER SYSTEM =====

function initFilterSystem() {
    console.log('Initializing filter system');
    
    // Read filter state from URL parameters
    const urlFilterState = readFiltersFromURL();
    if (urlFilterState) {
        window.filterState = urlFilterState;
        restoreUIFromFilterState();
    }
    
    // Search input with debounce
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        const debouncedSearch = debounce((value) => {
            window.filterState.searchTerm = value.trim();
            applyFilters();
        }, 300);
        
        searchInput.addEventListener('input', (e) => {
            debouncedSearch(e.target.value);
        });
    }
    
    // Status radio buttons
    const statusRadios = document.querySelectorAll('input[name="status"]');
    statusRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (e.target.checked) {
                window.filterState.status = e.target.value;
                applyFilters();
            }
        });
    });
    
    // Price inputs
    ['buyMinPrice', 'buyMaxPrice', 'sellMinPrice', 'sellMaxPrice'].forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            const debouncedPriceFilter = debounce(() => {
                window.filterState[id] = input.value;
                applyFilters();
            }, 500);
            
            input.addEventListener('input', debouncedPriceFilter);
        }
    });
    
    // Currency selectors
    const buyCurrencySelect = document.getElementById('buyCurrencySelect');
    const sellCurrencySelect = document.getElementById('sellCurrencySelect');
    
    if (buyCurrencySelect) {
        buyCurrencySelect.addEventListener('change', (e) => {
            window.filterState.buyCurrency = e.target.value;
            applyFilters();
        });
    }
    
    if (sellCurrencySelect) {
        sellCurrencySelect.addEventListener('change', (e) => {
            window.filterState.sellCurrency = e.target.value;
            applyFilters();
        });
    }
    
    // Attribute checkboxes
    const attributeCheckboxes = document.querySelectorAll('input[name^="attr_"]');
    attributeCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            const attributeId = e.target.name.replace('attr_', '');
            const value = e.target.value;
            
            if (!window.filterState.selectedAttributes.has(attributeId)) {
                window.filterState.selectedAttributes.set(attributeId, []);
            }
            
            const selectedValues = window.filterState.selectedAttributes.get(attributeId);
            
            if (e.target.checked) {
                if (!selectedValues.includes(value)) {
                    selectedValues.push(value);
                }
            } else {
                const index = selectedValues.indexOf(value);
                if (index > -1) {
                    selectedValues.splice(index, 1);
                }
                
                if (selectedValues.length === 0) {
                    window.filterState.selectedAttributes.delete(attributeId);
                }
            }
            
            applyFilters();
        });
    });
    
    // Initialize accordion functionality
    initAccordions();
    
    // Apply initial filters if any were loaded from URL
    if (urlFilterState && Object.values(urlFilterState).some(val => 
        val !== '' && val !== 'all' && !(val instanceof Map && val.size === 0))) {
        applyFilters();
    }
}

// Clear all filters function
function clearAllFilters() {
    // Reset filter state
    window.filterState = {
        searchTerm: '',
        status: 'all',
        buyMinPrice: '',
        buyMaxPrice: '',
        sellMinPrice: '',
        sellMaxPrice: '',
        buyCurrency: 'all',
        sellCurrency: 'all',
        selectedAttributes: new Map()
    };
    
    // Reset UI elements
    const searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.value = '';
    
    const statusRadios = document.querySelectorAll('input[name="status"]');
    statusRadios.forEach(radio => {
        radio.checked = radio.value === 'all';
    });
    
    ['buyMinPrice', 'buyMaxPrice', 'sellMinPrice', 'sellMaxPrice'].forEach(id => {
        const input = document.getElementById(id);
        if (input) input.value = '';
    });
    
    const buyCurrencySelect = document.getElementById('buyCurrencySelect');
    const sellCurrencySelect = document.getElementById('sellCurrencySelect');
    if (buyCurrencySelect) buyCurrencySelect.value = 'all';
    if (sellCurrencySelect) sellCurrencySelect.value = 'all';
    
    const attributeCheckboxes = document.querySelectorAll('input[name^="attr_"]');
    attributeCheckboxes.forEach(checkbox => {
        checkbox.checked = false;
    });
    
    // Close all accordions
    const accordionButtons = document.querySelectorAll('.accordion-toggle.active');
    accordionButtons.forEach(button => {
        toggleAccordion(button);
    });
    
    // Clear URL parameters
    clearURLParameters();
    
    // Apply filters to show all products
    applyFilters();
    
    // Close filter panel
    toggleFilterPanel();
}

// Initialize filter system when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initFilterSystem();
});