// JS/inventory.js (VERSIÓN CORREGIDA Y CON HISTORIAL FUNCIONAL)

// Las variables globales 'currentUser', 'products', 'transactions' y la constante 'db' de Firebase están disponibles globalmente.

function initializeInventory() {
    // Esta función se llama desde showInventoryView() en scripts.js
    setupInventoryEventListeners();
    renderProducts();
    populateProductCategoriesDatalist();
}

function setupInventoryEventListeners() {
    const form = document.getElementById('inventory-form');
    const searchInput = document.getElementById('product-search-input');
    const tableBody = document.getElementById('product-table-body');
    const cancelBtn = document.getElementById('cancel-edit-btn');
    const showHistoryBtn = document.getElementById('btn-show-history'); // Botón de historial
    
    if (form) form.addEventListener('submit', handleProductSubmit);
    if (searchInput) searchInput.addEventListener('input', renderProducts);
    if (cancelBtn) cancelBtn.addEventListener('click', clearProductForm);
    
    // --- NUEVO: Event listener para el botón de historial ---
    if (showHistoryBtn) showHistoryBtn.addEventListener('click', showInventoryHistory);

    if (tableBody) {
        tableBody.addEventListener('click', (e) => {
            const editButton = e.target.closest('.edit-product-btn');
            const deleteButton = e.target.closest('.delete-product-btn');

            if (editButton) {
                const id = editButton.dataset.id;
                editProduct(id);
            }
            if (deleteButton) {
                const id = deleteButton.dataset.id;
                deleteProduct(id);
            }
        });
    }
}

function renderProducts() {
    const tableBody = document.getElementById('product-table-body');
    const emptyState = document.getElementById('product-list-empty');
    const searchInput = document.getElementById('product-search-input');
    if (!tableBody || !emptyState) return;

    const searchTerm = searchInput.value.toLowerCase().trim();
    const filteredProducts = products.filter(p => 
        p.name.toLowerCase().includes(searchTerm) ||
        (p.sku && p.sku.toLowerCase().includes(searchTerm)) ||
        (p.category && p.category.toLowerCase().includes(searchTerm))
    );

    tableBody.innerHTML = '';
    if (filteredProducts.length === 0) {
        emptyState.style.display = 'block';
        tableBody.style.display = 'none';
    } else {
        emptyState.style.display = 'none';
        tableBody.style.display = '';
        filteredProducts.forEach(product => {
            const tr = document.createElement('tr');
            let stockClass = '';
            if (product.stock <= 0) stockClass = 'stock-out';
            else if (product.stock <= 5) stockClass = 'stock-low';

            tr.innerHTML = `
                <td>
                    <span class="product-name-cell">${product.name}</span>
                    <span class="product-sku-cell">${product.sku || 'N/A'}</span>
                </td>
                <td>${product.category || 'Sin categoría'}</td>
                <td class="${stockClass}">${product.stock}</td>
                <td>${formatCurrency(product.cost)}</td>
                <td>${formatCurrency(product.price)}</td>
                <td class="action-buttons">
                    <button class="edit-product-btn" data-id="${product.id}" title="Editar">✏️</button>
                    <button class="delete-product-btn" data-id="${product.id}" title="Eliminar">🗑️</button>
                </td>
            `;
            tableBody.appendChild(tr);
        });
    }
}

async function handleProductSubmit(e) {
    e.preventDefault();
    if (!currentUser) {
        showNotification("Debes iniciar sesión.", "error");
        return;
    }

    const editingId = document.getElementById('editing-product-id').value;
    const productData = {
        name: document.getElementById('product-name').value.trim(),
        sku: document.getElementById('product-sku').value.trim(),
        description: document.getElementById('product-description').value.trim(),
        category: document.getElementById('product-category').value.trim(),
        cost: parseFloat(document.getElementById('product-cost').value),
        price: parseFloat(document.getElementById('product-price').value),
    };

    if (!editingId) {
        productData.stock = parseInt(document.getElementById('initial-stock').value, 10);
    }
    
    if (!productData.name || isNaN(productData.cost) || isNaN(productData.price) || (!editingId && isNaN(productData.stock))) {
        showNotification("Nombre, costo, precio y stock inicial son campos requeridos.", "error");
        return;
    }

    try {
        const userProductsRef = db.collection('users').doc(currentUser.uid).collection('products');
        if (editingId) {
            await userProductsRef.doc(editingId).update(productData);
            
            const index = products.findIndex(p => p.id === editingId);
            if (index > -1) {
                products[index] = { ...products[index], ...productData };
            }
            showNotification("Producto actualizado con éxito.", "success");
        } else {
            const docRef = await userProductsRef.add(productData);
            products.push({ ...productData, id: docRef.id });
            showNotification("Producto añadido con éxito.", "success");
        }
        
        products.sort((a, b) => a.name.localeCompare(b.name));

        clearProductForm();
        renderProducts();
        populateProductCategoriesDatalist();

    } catch (error) {
        console.error("Error guardando producto en Firestore:", error);
        showNotification("Error al guardar el producto. Revisa tu conexión.", "error");
    }
}

function editProduct(id) {
    const product = products.find(p => p.id === id);
    if (!product) return;

    document.getElementById('editing-product-id').value = product.id;
    document.getElementById('product-name').value = product.name;
    document.getElementById('product-sku').value = product.sku || '';
    document.getElementById('product-description').value = product.description || '';
    document.getElementById('product-category').value = product.category || '';
    document.getElementById('product-cost').value = product.cost;
    document.getElementById('product-price').value = product.price;
    
    const stockInput = document.getElementById('initial-stock');
    stockInput.value = product.stock;
    stockInput.disabled = true;

    document.getElementById('product-form-title').textContent = 'Editar Producto';
    document.getElementById('save-product-btn').textContent = '💾 Actualizar Producto';
    document.getElementById('cancel-edit-btn').style.display = 'inline-block';
    
    // CORRECCIÓN: Usamos querySelector para buscar por CLASE en lugar de ID
    const formContainer = document.querySelector('.product-form-container');
    if (formContainer) {
        formContainer.scrollIntoView({ behavior: 'smooth' });
    }
}

async function deleteProduct(id) {
    if (!currentUser) return;
    
    const product = products.find(p => p.id === id);
    if(!product) return;

    const isProductInUse = Object.values(transactions).flat().some(tx => 
        tx.isInventory && tx.items.some(item => item.productId === id)
    );

    if(isProductInUse) {
        showNotification(`No se puede eliminar "${product.name}" porque tiene transacciones asociadas.`, 'error');
        return;
    }

    const confirmed = await showConfirmation({
        title: '¿Eliminar Producto?',
        message: `¿Seguro que quieres eliminar "${product.name}"? Esta acción no se puede deshacer.`,
        confirmText: 'Sí, Eliminar'
    });

    if (confirmed) {
        try {
            await db.collection('users').doc(currentUser.uid).collection('products').doc(id).delete();
            products = products.filter(p => p.id !== id);
            renderProducts();
            showNotification('Producto eliminado.', 'success');
        } catch (error) {
            console.error("Error eliminando producto:", error);
            showNotification("Error al eliminar el producto.", 'error');
        }
    }
}

function clearProductForm() {
    document.getElementById('inventory-form').reset();
    document.getElementById('editing-product-id').value = '';
    
    const stockInput = document.getElementById('initial-stock');
    stockInput.disabled = false;
    
    document.getElementById('product-form-title').textContent = 'Añadir Nuevo Producto';
    document.getElementById('save-product-btn').innerHTML = '<i data-lucide="save"></i> Guardar Producto';
    document.getElementById('cancel-edit-btn').style.display = 'none';
}

function populateProductCategoriesDatalist() {
    const datalist = document.getElementById('product-categories-list');
    if (!datalist) return;

    const uniqueCategories = [...new Set(products.map(p => p.category).filter(Boolean))];
    datalist.innerHTML = uniqueCategories.map(cat => `<option value="${cat}"></option>`).join('');
}


// =================================================================
// === NUEVA FUNCIONALIDAD: MOSTRAR HISTORIAL DE MOVIMIENTOS     ===
// =================================================================
function showInventoryHistory() {
    const modal = document.getElementById('inventory-history-modal');
    const tableBody = document.getElementById('inventory-history-body');
    const emptyState = document.getElementById('inventory-history-empty');

    if (!modal || !tableBody || !emptyState) {
        console.error("No se encontraron los elementos del modal de historial.");
        return;
    }

    // 1. Recolectar y procesar todos los movimientos de inventario
    const historyEntries = [];
    const allTransactions = Object.values(transactions).flat(); // Obtener una lista plana de todas las transacciones

    allTransactions.forEach(tx => {
        if (tx.isInventory && tx.items) {
            tx.items.forEach(item => {
                historyEntries.push({
                    date: tx.date,
                    productName: item.productName,
                    type: tx.type, // 'income' (venta) o 'expense' (compra)
                    quantity: item.quantity,
                    totalValue: item.quantity * item.price
                });
            });
        }
    });

    // 2. Ordenar los movimientos por fecha, del más reciente al más antiguo
    historyEntries.sort((a, b) => new Date(b.date) - new Date(a.date));

    // 3. Renderizar la tabla
    tableBody.innerHTML = '';
    if (historyEntries.length === 0) {
        emptyState.style.display = 'block';
    } else {
        emptyState.style.display = 'none';
        historyEntries.forEach(entry => {
            const tr = document.createElement('tr');
            const typeText = entry.type === 'income' ? 'Venta' : 'Compra';
            const typeClass = entry.type === 'income' ? 'sale' : 'purchase';

            tr.innerHTML = `
                <td>${formatDateForDisplay(entry.date)}</td>
                <td>${entry.productName}</td>
                <td><span class="history-type ${typeClass}">${typeText}</span></td>
                <td>${entry.quantity}</td>
                <td>${formatCurrency(entry.totalValue)}</td>
            `;
            tableBody.appendChild(tr);
        });
    }

    // 4. Mostrar el modal
    modal.style.display = 'flex';

    // 5. Configurar el botón de cierre
    const closeBtn = document.getElementById('inventory-history-modal-close-btn');
    if (closeBtn) {
        closeBtn.onclick = () => {
            modal.style.display = 'none';
        };
    }
}