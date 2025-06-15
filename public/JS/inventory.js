// === SISTEMA DE INVENTARIO PARA CONTAUNO ===

document.addEventListener('DOMContentLoaded', () => {
    // La inicialización ahora se llama desde showInventoryView() para asegurar que los elementos existan.
});

let products = [];
const INVENTORY_KEY = 'contauno_products';

function initializeInventory() {
    loadProducts();
    setupInventoryEventListeners();
    renderProductTable();
    renderProductCategories();
    // Ya no renderizamos el historial aquí, se hará al abrir el modal.
    resetInventoryForm();
}

function setupInventoryEventListeners() {
    // Formularios y botones principales
    const form = document.getElementById('inventory-form');
    form.removeEventListener('submit', handleInventoryFormSubmit);
    form.addEventListener('submit', handleInventoryFormSubmit);

    const searchInput = document.getElementById('product-search-input');
    searchInput.removeEventListener('keyup', handleSearch);
    searchInput.addEventListener('keyup', handleSearch);
    
    const cancelBtn = document.getElementById('cancel-edit-btn');
    cancelBtn.removeEventListener('click', resetInventoryForm);
    cancelBtn.addEventListener('click', resetInventoryForm);

    // --- NUEVO: Listeners para el modal de historial ---
    const showHistoryBtn = document.getElementById('btn-show-history');
    showHistoryBtn.addEventListener('click', showInventoryHistoryModal);

    const closeHistoryBtn = document.getElementById('inventory-history-modal-close-btn'); // <-- CORRECCIÓN AQUÍ
    closeHistoryBtn.addEventListener('click', hideInventoryHistoryModal);
    
    const historyModal = document.getElementById('inventory-history-modal');
    historyModal.addEventListener('click', (e) => {
        // Cierra el modal si se hace clic en el fondo oscuro
        if (e.target === historyModal) {
            hideInventoryHistoryModal();
        }
    });
}

function loadProducts() {
    const savedProducts = localStorage.getItem(INVENTORY_KEY);
    products = savedProducts ? JSON.parse(savedProducts) : [];
}

function saveProducts() {
    localStorage.setItem(INVENTORY_KEY, JSON.stringify(products));
}

function renderProductTable() {
    const tableBody = document.getElementById('product-table-body');
    const emptyMessage = document.getElementById('product-list-empty');
    const searchFilter = document.getElementById('product-search-input').value.toLowerCase();

    loadProducts(); // Asegura que los datos estén frescos
    const filteredProducts = products.filter(p => 
        p.name.toLowerCase().includes(searchFilter) ||
        (p.sku && p.sku.toLowerCase().includes(searchFilter)) ||
        p.category.toLowerCase().includes(searchFilter)
    );

    tableBody.innerHTML = '';
    const productTableContainer = document.querySelector('#product-table').parentElement.parentElement;

    if (filteredProducts.length === 0) {
        if (emptyMessage) emptyMessage.style.display = 'block';
        if (productTableContainer) productTableContainer.style.display = 'none';
    } else {
        if (emptyMessage) emptyMessage.style.display = 'none';
        if (productTableContainer) productTableContainer.style.display = 'block';

        filteredProducts.forEach(product => {
            const stockClass = product.stock <= 0 ? 'stock-out' : (product.stock <= 10 ? 'stock-low' : '');
            const row = `
                <tr>
                    <td>
                        <span class="product-name-cell">${product.name}</span>
                        <span class="product-sku-cell">${product.sku || 'Sin SKU'}</span>
                    </td>
                    <td>${product.category}</td>
                    <td><span class="stock-indicator ${stockClass}">${product.stock}</span></td>
                    <td>${formatCurrency(product.weightedAverageCost)}</td>
                    <td>${formatCurrency(product.price)}</td>
                    <td class="action-buttons">
                        <button onclick="editProduct('${product.id}')" title="Editar Producto">✏️</button>
                        <button onclick="deleteProduct('${product.id}')" title="Eliminar Producto">🗑️</button>
                    </td>
                </tr>
            `;
            tableBody.innerHTML += row;
        });
    }
}

function renderProductCategories() {
    const datalist = document.getElementById('product-categories-list');
    const uniqueCategories = [...new Set(products.map(p => p.category))];
    datalist.innerHTML = uniqueCategories.map(cat => `<option value="${cat}"></option>`).join('');
}

function handleSearch() {
    renderProductTable();
}

function handleInventoryFormSubmit(e) {
    e.preventDefault();
    
    const editingId = document.getElementById('editing-product-id').value;
    
    if (editingId) {
        const productIndex = products.findIndex(p => p.id === editingId);
        if (productIndex > -1) {
            products[productIndex].name = document.getElementById('product-name').value.trim();
            products[productIndex].sku = document.getElementById('product-sku').value.trim();
            products[productIndex].description = document.getElementById('product-description').value.trim();
            products[productIndex].category = document.getElementById('product-category').value.trim();
            products[productIndex].price = parseFloat(document.getElementById('product-price').value);
        }
    } else {
        const cost = parseFloat(document.getElementById('product-cost').value);
        const stock = parseInt(document.getElementById('initial-stock').value, 10);
        const newProduct = {
            id: `prod_${Date.now()}`,
            name: document.getElementById('product-name').value.trim(),
            sku: document.getElementById('product-sku').value.trim(),
            description: document.getElementById('product-description').value.trim(),
            category: document.getElementById('product-category').value.trim(),
            price: parseFloat(document.getElementById('product-price').value),
            stock: stock,
            weightedAverageCost: cost
        };
        products.push(newProduct);
    }

    saveProducts();
    renderProductTable();
    renderProductCategories();
    resetInventoryForm();
    showNotification(`Producto ${editingId ? 'actualizado' : 'guardado'} con éxito.`, 'success');
}

function editProduct(id) {
    const product = products.find(p => p.id === id);
    if (!product) return;

    document.getElementById('editing-product-id').value = product.id;
    document.getElementById('product-name').value = product.name;
    document.getElementById('product-sku').value = product.sku;
    document.getElementById('product-description').value = product.description;
    document.getElementById('product-category').value = product.category;
    document.getElementById('product-price').value = product.price;
    
    document.getElementById('product-cost').value = product.weightedAverageCost;
    document.getElementById('initial-stock').value = product.stock;

    document.getElementById('initial-stock').disabled = true;
    document.getElementById('product-cost').disabled = true;

    document.getElementById('product-form-title').textContent = 'Editar Producto';
    document.getElementById('save-product-btn').textContent = '💾 Actualizar Producto';
    document.getElementById('cancel-edit-btn').style.display = 'inline-block';
    
    document.querySelector('.product-form-container').scrollIntoView({ behavior: 'smooth' });
}

async function deleteProduct(id) {
    const product = products.find(p => p.id === id);
    if (!product) return;
    
    const confirmed = await showConfirmation({
        title: '¿Eliminar Producto?',
        message: `¿Estás seguro de eliminar "${product.name}"? Esta acción no se puede deshacer.`,
        confirmText: 'Sí, Eliminar'
    });

    if (confirmed) {
        products = products.filter(p => p.id !== id);
        saveProducts();
        renderProductTable();
        renderInventoryHistory(); // Actualiza el historial si se elimina un producto
        showNotification('Producto eliminado.', 'success');
    }
}

function resetInventoryForm() {
    document.getElementById('inventory-form').reset();
    document.getElementById('editing-product-id').value = '';
    
    document.getElementById('initial-stock').disabled = false;
    document.getElementById('product-cost').disabled = false;

    document.getElementById('product-form-title').textContent = 'Añadir Nuevo Producto';
    document.getElementById('save-product-btn').textContent = '💾 Guardar Producto';
    document.getElementById('cancel-edit-btn').style.display = 'none';
}

function updateProductStock(productId, quantityChange, purchaseCost = null) {
    loadProducts();
    const productIndex = products.findIndex(p => p.id === productId);
    if (productIndex === -1) {
        console.error('Producto no encontrado para actualizar stock:', productId);
        return false;
    }

    const product = products[productIndex];

    if (quantityChange < 0 && product.stock < Math.abs(quantityChange)) {
        showNotification(`Stock insuficiente para "${product.name}". Solo hay ${product.stock} disponibles.`, 'error');
        return false; 
    }

    if (quantityChange > 0 && purchaseCost !== null) {
        const oldStock = product.stock;
        const oldWAC = product.weightedAverageCost;
        const totalStock = oldStock + quantityChange;
        
        if (totalStock > 0) {
            product.weightedAverageCost = ((oldStock * oldWAC) + (quantityChange * purchaseCost)) / totalStock;
        } else {
            product.weightedAverageCost = purchaseCost;
        }
    }
    
    product.stock += quantityChange;
    saveProducts();
    return true;
}

function renderInventoryHistory() {
    const historyBody = document.getElementById('inventory-history-body');
    const emptyMessage = document.getElementById('inventory-history-empty');
    
    const allTransactions = JSON.parse(localStorage.getItem('contauno_transactions') || '{}');
    const historyMovements = [];

    Object.values(allTransactions).flat().forEach(tx => {
        if (tx.isInventory && tx.items && tx.items.length > 0) {
            tx.items.forEach(item => {
                historyMovements.push({
                    date: tx.date,
                    productName: item.productName,
                    type: tx.type, 
                    quantity: item.quantity,
                    totalValue: item.quantity * item.price
                });
            });
        }
    });

    historyMovements.sort((a, b) => new Date(b.date) - new Date(a.date));

    historyBody.innerHTML = '';
    const historyTableContainer = document.querySelector('#inventory-history-table').parentElement.parentElement;

    if (historyMovements.length === 0) {
        emptyMessage.style.display = 'block';
        historyTableContainer.style.display = 'none';

    } else {
        emptyMessage.style.display = 'none';
        historyTableContainer.style.display = 'block';
        historyMovements.forEach(move => {
            const isSale = move.type === 'income';
            const row = `
                <tr>
                    <td>${formatDateForDisplay(move.date)}</td>
                    <td>${move.productName}</td>
                    <td>
                        <span class="history-type ${isSale ? 'sale' : 'purchase'}">
                            ${isSale ? 'Venta' : 'Compra'}
                        </span>
                    </td>
                    <td>${move.quantity}</td>
                    <td>${formatCurrency(move.totalValue)}</td>
                </tr>
            `;
            historyBody.innerHTML += row;
        });
    }
}


// --- NUEVO: Funciones para controlar el Modal de Historial ---

function showInventoryHistoryModal() {
    renderInventoryHistory(); // Asegurarse de que los datos están actualizados al abrir
    document.getElementById('inventory-history-modal').style.display = 'block';
}

function hideInventoryHistoryModal() {
    document.getElementById('inventory-history-modal').style.display = 'none';
}