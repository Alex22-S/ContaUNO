// === SISTEMA DE CALENDARIO Y FORMULARIO PARA CONTAUNO (ACTUALIZADO CON INVENTARIO MÚLTIPLE) ===

// Variables globales
let currentDate = new Date();
let selectedDate = null;
let transactions = {};
let categories = {};
let transactionTemplates = [];
let currentTransactionItems = []; // Array para los ítems de inventario de la transacción actual

// Constantes para las categorías especiales de inventario
const INVENTORY_SALE_CATEGORY = 'inv-sale';
const INVENTORY_PURCHASE_CATEGORY = 'inv-purchase';


document.addEventListener('DOMContentLoaded', () => {
    loadSavedData();
    initializeCalendar();
    setupEventListeners();
});

// === FUNCIONES PRINCIPALES DE INICIALIZACIÓN ===

function loadSavedData() {
    // Cargar transacciones
    const savedTransactions = localStorage.getItem('contauno_transactions');
    if (savedTransactions) {
        transactions = JSON.parse(savedTransactions);
    }
    // Cargar categorías o establecer por defecto
    const savedCategories = localStorage.getItem('contauno_categories');
    if (savedCategories) {
        categories = JSON.parse(savedCategories);
    } else {
        categories = {
            income: ['Ventas', 'Servicios', 'Otros Ingresos'],
            expense: ['Suministros', 'Alquiler', 'Servicios Públicos', 'Marketing', 'Otros Gastos']
        };
    }
    // Cargar plantillas
    const savedTemplates = localStorage.getItem('contauno_templates');
    if (savedTemplates) {
        transactionTemplates = JSON.parse(savedTemplates);
    }
}

function initializeCalendar() {
    populateYearSelect();
    updateCalendar();
    updateSummary();
}

function setupEventListeners() {
    document.getElementById('transaction-form-full')?.addEventListener('submit', handleTransactionSubmit);
    document.getElementById('form-type')?.addEventListener('change', handleFormTypeChange);
    document.getElementById('form-category')?.addEventListener('change', handleCategoryChange);
    document.getElementById('add-category-btn')?.addEventListener('click', addCategory);
    document.getElementById('edit-category-btn')?.addEventListener('click', editCategory);
    document.getElementById('delete-category-btn')?.addEventListener('click', deleteCategory);
    document.getElementById('download-pdf-btn')?.addEventListener('click', generateDailyPdf);
    
    // Event listeners para plantillas
    document.getElementById('save-template-btn')?.addEventListener('click', saveAsTemplate);
    document.getElementById('template-select')?.addEventListener('change', applyTemplate);
    document.getElementById('edit-template-btn')?.addEventListener('click', editTemplate);
    document.getElementById('delete-template-btn')?.addEventListener('click', deleteTemplate);

    // Listeners para la sección de inventario múltiple
    document.getElementById('add-inventory-item-btn')?.addEventListener('click', addInventoryItemToTransaction);
    document.getElementById('inventory-product-select')?.addEventListener('change', handleProductSelectionForUnitPrice);

    // Atajo de teclado para salir de la vista de formulario
    document.addEventListener('keydown', (e) => {
        const formView = document.getElementById('form-view');
        if (formView.style.display !== 'none' && formView.classList.contains('active')) {
            if (e.key === 'Escape') {
               clearFormAndReturn();
            }
        }
    });
}


// === FUNCIONES DEL CALENDARIO (VISTA) ===

function populateYearSelect() {
    const yearSelect = document.getElementById('year-select');
    if (!yearSelect) return;
    const currentYear = new Date().getFullYear();
    yearSelect.innerHTML = '';
    for (let year = 2020; year <= 2030; year++) {
        yearSelect.innerHTML += `<option value="${year}" ${year === currentYear ? 'selected' : ''}>${year}</option>`;
    }
}

function updateCalendar() {
    const month = parseInt(document.getElementById('month-select').value);
    const year = parseInt(document.getElementById('year-select').value);
    const calendarGrid = document.getElementById('calendar-grid');
    if (!calendarGrid) return;
    
    const dayHeaders = Array.from(calendarGrid.querySelectorAll('.calendar-day-header'));
    calendarGrid.innerHTML = '';
    dayHeaders.forEach(header => calendarGrid.appendChild(header));

    generateCalendarDays(month, year);
    updateSummary();
}

function generateCalendarDays(month, year) {
    const calendarGrid = document.getElementById('calendar-grid');
    const firstDayOfMonth = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const startingDayOfWeek = (firstDayOfMonth.getDay() === 0) ? 6 : firstDayOfMonth.getDay() - 1;

    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startingDayOfWeek; i > 0; i--) {
        const day = prevMonthLastDay - i + 1;
        calendarGrid.appendChild(createDayElement(day, month - 1, year, true));
    }

    for (let day = 1; day <= daysInMonth; day++) {
        calendarGrid.appendChild(createDayElement(day, month, year, false));
    }

    const totalCells = calendarGrid.children.length - 7;
    const remainingCells = Math.ceil(totalCells / 7) * 7 - totalCells;
    for (let day = 1; day <= remainingCells; day++) {
        calendarGrid.appendChild(createDayElement(day, month + 1, year, true));
    }
}

function createDayElement(day, month, year, isOtherMonth) {
    const dayElement = document.createElement('div');
    dayElement.className = 'calendar-day';
    
    const date = new Date(year, month, day);
    const dateKey = formatDate(date);

    dayElement.innerHTML = `<div class="day-number">${day}</div><div class="day-transactions"></div>`;
    
    if (isOtherMonth) {
        dayElement.classList.add('other-month');
    } else {
        dayElement.onclick = () => showTransactionForm(dateKey);
    }

    if (date.toDateString() === new Date().toDateString()) {
        dayElement.classList.add('today');
    }

    if (transactions[dateKey]) {
        let incomeTotal = 0;
        let expenseTotal = 0;
        
        transactions[dateKey].forEach(t => {
            if (t.type === 'income') incomeTotal += t.amount;
            else expenseTotal += t.amount;
        });

        const balance = incomeTotal - expenseTotal;
        const transactionsDiv = dayElement.querySelector('.day-transactions');

        if (balance !== 0) {
            transactionsDiv.textContent = formatCurrency(balance);
            transactionsDiv.classList.add(balance > 0 ? 'positive' : 'negative');
        }

        if (incomeTotal > expenseTotal) {
            dayElement.classList.add('day-positive-balance');
        } else if (expenseTotal > incomeTotal) {
            dayElement.classList.add('day-negative-balance');
        }
    }
    return dayElement;
}


// === GESTIÓN DEL FORMULARIO DE TRANSACCIÓN (LÓGICA PRINCIPAL) ===

function showTransactionForm(dateKey) {
    hideAllViews();
    const formView = document.getElementById('form-view');
    formView.classList.add('active');
    
    selectedDate = dateKey;
    clearForm(true); 
    
    document.getElementById('form-date-display').value = formatDateForDisplay(selectedDate);
    document.getElementById('form-title').textContent = `Movimiento para el ${formatDateForDisplay(selectedDate)}`;
    
    handleFormTypeChange();
    renderDailyTransactions(selectedDate);
    populateTemplateSelect();
    
    document.getElementById('form-description').focus();
    document.getElementById('calendar-view').dataset.context = 'true';
}

async function handleTransactionSubmit(e) {
    e.preventDefault();
    const editingId = document.getElementById('editing-transaction-id').value ? parseInt(document.getElementById('editing-transaction-id').value, 10) : null;
    const category = document.getElementById('form-category').value;
    const isInventoryTransaction = category === INVENTORY_SALE_CATEGORY || category === INVENTORY_PURCHASE_CATEGORY;
    
    let transactionData = {
        id: editingId || Date.now(),
        date: selectedDate,
        type: document.getElementById('form-type').value,
        amount: parseFloat(document.getElementById('form-amount').value),
        provider: document.getElementById('form-provider').value.trim(),
        providerId: document.getElementById('form-provider-id').value.trim(),
        notes: document.getElementById('form-notes').value.trim(),
        isInventory: isInventoryTransaction,
        items: isInventoryTransaction ? [...currentTransactionItems] : []
    };
    
    if (isInventoryTransaction) {
        if (currentTransactionItems.length === 0) {
            showNotification("Debes añadir al menos un producto de inventario.", 'error');
            return;
        }
        transactionData.category = transactionData.type === 'income' ? 'Venta de Inventario' : 'Compra de Inventario';
        transactionData.description = `${transactionData.category} - ${currentTransactionItems.length} ítem(s)`;
    } else {
        transactionData.category = category;
        transactionData.description = document.getElementById('form-description').value.trim();
    }

    if (!transactionData.amount || transactionData.amount < 0 || !transactionData.description || !transactionData.category) {
        showNotification("Por favor, completa los campos requeridos: descripción, categoría y monto.", 'error');
        return;
    }
    
    // --- Lógica de actualización de stock ---
    if (isInventoryTransaction) {
        const originalTx = editingId ? transactions[selectedDate]?.find(t => t.id === editingId) : null;
        
        if (editingId && originalTx) {
            originalTx.items.forEach(item => {
                const revertQty = originalTx.type === 'income' ? item.quantity : -item.quantity;
                updateProductStock(item.productId, revertQty);
            });
        }

        let stockUpdatedItems = [];
        for (const item of currentTransactionItems) {
            const quantityChange = transactionData.type === 'income' ? -item.quantity : item.quantity;
            const unitCost = transactionData.type === 'expense' ? item.price : null;
            const success = updateProductStock(item.productId, quantityChange, unitCost);
            
            if (!success) { 
                stockUpdatedItems.forEach(updatedItem => {
                    const revertQty = transactionData.type === 'income' ? updatedItem.quantity : -updatedItem.quantity;
                    updateProductStock(updatedItem.productId, revertQty);
                });

                 if(originalTx) {
                    originalTx.items.forEach(item => {
                        const revertQty = originalTx.type === 'income' ? -item.quantity : item.quantity;
                        updateProductStock(item.productId, revertQty, originalTx.type === 'expense' ? item.price : null);
                    });
                }
                return; 
            }
            stockUpdatedItems.push(item);
        }
    }
    
    // --- Guardado de la transacción ---
    if (editingId) {
        const index = transactions[selectedDate].findIndex(t => t.id === editingId);
        if (index > -1) transactions[selectedDate][index] = transactionData;
    } else {
        if (!transactions[selectedDate]) transactions[selectedDate] = [];
        transactions[selectedDate].push(transactionData);
    }
    
    localStorage.setItem('contauno_transactions', JSON.stringify(transactions));
    clearForm(true);
    updateCalendar();
    renderDailyTransactions(selectedDate);
    showNotification('Transacción guardada con éxito.', 'success');
}


// === Lógica de edición y eliminación ===

async function editTransaction(id, dateKey) {
    const transaction = transactions[dateKey]?.find(t => t.id === id);
    if (!transaction) return;

    document.getElementById('editing-transaction-id').value = transaction.id;
    document.getElementById('form-type').value = transaction.type;
    document.getElementById('form-amount').value = transaction.amount;
    document.getElementById('form-provider').value = transaction.provider || '';
    document.getElementById('form-provider-id').value = transaction.providerId || '';
    document.getElementById('form-notes').value = transaction.notes || '';

    renderCategories();

    if (transaction.isInventory) {
        const categoryValue = transaction.type === 'income' ? INVENTORY_SALE_CATEGORY : INVENTORY_PURCHASE_CATEGORY;
        document.getElementById('form-category').value = categoryValue;
        handleCategoryChange(); 
        currentTransactionItems = JSON.parse(JSON.stringify(transaction.items));
        renderTransactionItemsList();
    } else {
        document.getElementById('form-category').value = transaction.category;
        handleCategoryChange();
        document.getElementById('form-description').value = transaction.description;
    }

    document.getElementById('save-transaction-btn').textContent = '💾 Actualizar Transacción';
    document.getElementById('form-description').focus();
}

async function deleteTransaction(id, dateKey) {
    const confirmed = await showConfirmation({
        title: '¿Eliminar Transacción?',
        message: 'Esta acción es irreversible y afectará el stock de tu inventario si está asociada a productos.',
        confirmText: 'Sí, Eliminar'
    });

    if (confirmed) {
        const txIndex = transactions[dateKey].findIndex(t => t.id === id);
        if (txIndex === -1) return;

        const txToDelete = transactions[dateKey][txIndex];

        if (txToDelete.isInventory && txToDelete.items && txToDelete.items.length > 0) {
            txToDelete.items.forEach(item => {
                const revertQty = txToDelete.type === 'income' ? item.quantity : -item.quantity;
                updateProductStock(item.productId, revertQty);
            });
        }

        transactions[dateKey].splice(txIndex, 1);
        if (transactions[dateKey].length === 0) {
            delete transactions[dateKey];
        }
        localStorage.setItem('contauno_transactions', JSON.stringify(transactions));
        
        updateCalendar();
        renderDailyTransactions(dateKey);
        showNotification('Transacción eliminada.', 'success');
    }
}


// === GESTIÓN DE LA INTERFAZ DEL FORMULARIO ===

function handleFormTypeChange() {
    renderCategories();
    handleCategoryChange(); 
}

/**
 * [FUNCIÓN CORREGIDA]
 * Muestra/oculta campos y gestiona el atributo 'required' dinámicamente.
 */
function handleCategoryChange() {
    const category = document.getElementById('form-category').value;
    const inventorySection = document.getElementById('inventory-section');
    const standardFields = document.getElementById('standard-fields-group');
    const amountInput = document.getElementById('form-amount');
    const descriptionInput = document.getElementById('form-description'); // Referencia al input

    const isInventory = category === INVENTORY_SALE_CATEGORY || category === INVENTORY_PURCHASE_CATEGORY;

    inventorySection.style.display = isInventory ? 'block' : 'none';
    standardFields.style.display = isInventory ? 'none' : 'block';
    amountInput.readOnly = isInventory;
    
    // --- CORRECCIÓN: Gestionar dinámicamente el atributo 'required' ---
    // Si es una transacción de inventario, la descripción no es requerida.
    // Si no, sí lo es.
    descriptionInput.required = !isInventory;
    
    if (isInventory) {
        populateProductSelect();
        if (document.getElementById('editing-transaction-id').value === '') {
            currentTransactionItems = [];
            renderTransactionItemsList();
        }
    }
}


function renderCategories() {
    const type = document.getElementById('form-type').value;
    const categorySelect = document.getElementById('form-category');
    const fragment = document.createDocumentFragment();
    
    if (categories[type] && categories[type].length > 0) {
        categories[type].forEach(cat => {
            const option = document.createElement('option');
            option.value = cat;
            option.textContent = cat;
            fragment.appendChild(option);
        });
    }

    const separator = document.createElement('option');
    separator.disabled = true;
    separator.textContent = '──────────';
    fragment.appendChild(separator);

    if (type === 'income') {
        const invOption = document.createElement('option');
        invOption.value = INVENTORY_SALE_CATEGORY;
        invOption.textContent = '📦 Venta de Inventario';
        fragment.appendChild(invOption);
    } else { 
        const invOption = document.createElement('option');
        invOption.value = INVENTORY_PURCHASE_CATEGORY;
        invOption.textContent = '📥 Compra de Inventario';
        fragment.appendChild(invOption);
    }
    
    categorySelect.innerHTML = '';
    categorySelect.appendChild(fragment);
}

function clearForm(fullReset) {
    if (fullReset) {
        document.getElementById('transaction-form-full').reset();
        document.getElementById('form-type').value = 'income';
        currentTransactionItems = [];
        renderTransactionItemsList();
        handleFormTypeChange();
    }
    document.getElementById('editing-transaction-id').value = '';
    document.getElementById('save-transaction-btn').textContent = '💾 Guardar Transacción';
}

function clearFormAndReturn() {
    clearForm(true);
    showCalendar();
}


// === LÓGICA DE INVENTARIO EN FORMULARIO (MÚLTIPLE) ===

function addInventoryItemToTransaction() {
    const productSelect = document.getElementById('inventory-product-select');
    const quantityInput = document.getElementById('inventory-quantity');
    const priceInput = document.getElementById('inventory-unit-price');
    const type = document.getElementById('form-type').value;
    
    const productId = productSelect.value;
    const quantity = parseInt(quantityInput.value, 10);
    const price = parseFloat(priceInput.value);

    if (!productId || !quantity || quantity <= 0 || isNaN(price) || price < 0) {
        showNotification("Por favor, selecciona un producto y especifica cantidad y precio válidos.", 'error');
        return;
    }

    if (type === 'income') {
        const localProducts = JSON.parse(localStorage.getItem('contauno_products') || '[]');
        const product = localProducts.find(p => p.id === productId);
        
        if (product) {
            const itemInCart = currentTransactionItems.find(item => item.productId === productId);
            const quantityInCart = itemInCart ? itemInCart.quantity : 0;
            
            if (quantity + quantityInCart > product.stock) {
                showNotification(`Stock insuficiente para "${product.name}". Disponible: ${product.stock}`, 'warning');
                return;
            }
        }
    }

    const selectedOption = productSelect.options[productSelect.selectedIndex];
    const productName = selectedOption.text.split(' (Stock:')[0];

    const existingItemIndex = currentTransactionItems.findIndex(item => item.productId === productId);
    if (existingItemIndex > -1) {
        currentTransactionItems[existingItemIndex].quantity += quantity;
    } else {
        currentTransactionItems.push({ productId, productName, quantity, price });
    }
    
    renderTransactionItemsList();
    
    productSelect.selectedIndex = 0;
    quantityInput.value = '';
    priceInput.value = '';
    productSelect.focus();
}


function renderTransactionItemsList() {
    const container = document.getElementById('inventory-items-list-container');
    container.innerHTML = '';
    let totalAmount = 0;
    
    if (currentTransactionItems.length === 0) {
        container.innerHTML = '<p class="no-items-msg">No hay productos añadidos a la transacción.</p>';
    } else {
        const list = document.createElement('ul');
        list.className = 'inventory-items-list';
        currentTransactionItems.forEach((item, index) => {
            const itemTotal = item.quantity * item.price;
            totalAmount += itemTotal;
            const listItem = document.createElement('li');
            listItem.className = 'inventory-list-item';
            listItem.innerHTML = `
                <span class="item-name">${item.productName}</span>
                <span class="item-details">${item.quantity} x ${formatCurrency(item.price)}</span>
                <span class="item-total">${formatCurrency(itemTotal)}</span>
                <button type="button" class="btn-remove-item" data-index="${index}" title="Quitar item">&times;</button>
            `;
            list.appendChild(listItem);
        });
        container.appendChild(list);
    }
    
    document.getElementById('form-amount').value = totalAmount.toFixed(2);

    container.querySelectorAll('.btn-remove-item').forEach(button => {
        button.addEventListener('click', (e) => {
            const indexToRemove = parseInt(e.target.dataset.index, 10);
            currentTransactionItems.splice(indexToRemove, 1);
            renderTransactionItemsList();
        });
    });
}

function populateProductSelect() {
    const select = document.getElementById('inventory-product-select');
    const localProducts = JSON.parse(localStorage.getItem('contauno_products') || '[]');
    
    select.innerHTML = '<option value="">-- Selecciona un producto --</option>';
    localProducts.forEach(p => {
        const displayText = `${p.name} (Stock: ${p.stock})`;
        select.innerHTML += `<option value="${p.id}" data-price="${p.price}" data-cost="${p.weightedAverageCost}">${displayText}</option>`;
    });
}

function handleProductSelectionForUnitPrice() {
    const productSelect = document.getElementById('inventory-product-select');
    const priceInput = document.getElementById('inventory-unit-price');
    const type = document.getElementById('form-type').value;
    const selectedOption = productSelect.options[productSelect.selectedIndex];

    if (!selectedOption || !selectedOption.value) {
        priceInput.value = '';
        return;
    }
    
    const unitValue = (type === 'income') 
        ? parseFloat(selectedOption.dataset.price)
        : parseFloat(selectedOption.dataset.cost);
    
    priceInput.value = unitValue.toFixed(2);
}


// === GESTIÓN DE LA LISTA DE TRANSACCIONES DIARIAS (PANEL DERECHO) ===
function renderDailyTransactions(dateKey) {
    const listContainer = document.getElementById('daily-transactions-list');
    const dailyTransactions = transactions[dateKey] || [];
    
    listContainer.innerHTML = ''; 

    if (dailyTransactions.length === 0) {
        listContainer.innerHTML = `<p class="no-transactions-msg">No hay movimientos registrados para este día.</p>`;
    } else {
        dailyTransactions.slice().reverse().forEach(t => {
            const item = document.createElement('div');
            item.className = `transaction-item ${t.type}`;
            
            item.innerHTML = `
                <div class="transaction-details">
                    <p class="transaction-description">${t.description}</p>
                    <p class="transaction-category">${t.category}</p>
                </div>
                <span class="transaction-amount">${t.type === 'expense' ? '-' : ''}${formatCurrency(t.amount)}</span>
                <div class="transaction-actions">
                    <button class="edit-btn" onclick="editTransaction(${t.id}, '${dateKey}')" title="Editar">✏️</button>
                    <button class="delete-btn" onclick="deleteTransaction(${t.id}, '${dateKey}')" title="Eliminar">🗑️</button>
                </div>
            `;
            listContainer.appendChild(item);
        });
    }
    updateDailySummary(dateKey);
}

function updateDailySummary(dateKey) {
    const dailyTransactions = transactions[dateKey] || [];
    let income = 0, expenses = 0;

    dailyTransactions.forEach(t => {
        if (t.type === 'income') income += t.amount;
        else expenses += t.amount;
    });

    const balance = income - expenses;

    document.getElementById('daily-income').textContent = formatCurrency(income);
    document.getElementById('daily-expenses').textContent = formatCurrency(expenses);
    const balanceEl = document.getElementById('daily-balance');
    balanceEl.textContent = formatCurrency(balance);

    balanceEl.classList.remove('positive-value', 'negative-value');
    if (balance !== 0) {
        balanceEl.classList.add(balance > 0 ? 'positive-value' : 'negative-value');
    }
}


// === GESTIÓN DINÁMICA DE CATEGORÍAS (MAESTRO) ===
function saveCategories() {
    localStorage.setItem('contauno_categories', JSON.stringify(categories));
}

async function addCategory() {
    const type = document.getElementById('form-type').value;
    const newCategory = prompt(`Añadir nueva categoría de ${type === 'income' ? 'Ingreso' : 'Gasto'}:`);
    if (newCategory && newCategory.trim() !== '') {
        if (!categories[type].includes(newCategory.trim())) {
            categories[type].push(newCategory.trim());
            saveCategories();
            renderCategories();
            showNotification('Categoría añadida.', 'success');
        } else {
            showNotification('Esa categoría ya existe.', 'warning');
        }
    }
}

async function editCategory() {
    const type = document.getElementById('form-type').value;
    const categorySelect = document.getElementById('form-category');
    const oldCategory = categorySelect.value;
    if (!oldCategory || oldCategory === INVENTORY_SALE_CATEGORY || oldCategory === INVENTORY_PURCHASE_CATEGORY) {
        showNotification("Selecciona una categoría válida para editar.", 'error');
        return;
    }

    const newCategory = prompt(`Editar categoría "${oldCategory}":`, oldCategory);
    if (newCategory && newCategory.trim() !== '' && newCategory.trim() !== oldCategory) {
        const index = categories[type].indexOf(oldCategory);
        if (index > -1) {
            categories[type][index] = newCategory.trim();
        }
        Object.keys(transactions).forEach(dateKey => {
            transactions[dateKey].forEach(tx => {
                if (tx.category === oldCategory) {
                    tx.category = newCategory.trim();
                }
            });
        });
        saveCategories();
        localStorage.setItem('contauno_transactions', JSON.stringify(transactions));
        renderCategories();
        categorySelect.value = newCategory.trim();
        showNotification('Categoría actualizada.', 'success');
    }
}

async function deleteCategory() {
    const type = document.getElementById('form-type').value;
    const categorySelect = document.getElementById('form-category');
    const categoryToDelete = categorySelect.value;

    if (!categoryToDelete || categoryToDelete === INVENTORY_SALE_CATEGORY || categoryToDelete === INVENTORY_PURCHASE_CATEGORY) {
        showNotification("Selecciona una categoría válida para eliminar.", 'error');
        return;
    }
    
    const isCategoryInUse = Object.values(transactions).flat().some(tx => !tx.isInventory && tx.category === categoryToDelete);
    if (isCategoryInUse) {
        showNotification(`No se puede eliminar "${categoryToDelete}" porque está en uso.`, 'error');
        return;
    }

    const confirmed = await showConfirmation({
        title: '¿Eliminar Categoría?',
        message: `¿Seguro que quieres eliminar la categoría "${categoryToDelete}"?`,
        confirmText: 'Sí, Eliminar'
    });

    if (confirmed) {
        categories[type] = categories[type].filter(cat => cat !== categoryToDelete);
        saveCategories();
        renderCategories();
        showNotification('Categoría eliminada.', 'success');
    }
}


// === SISTEMA DE PLANTILLAS ===
function saveAsTemplate() {
    const category = document.getElementById('form-category').value;
    if (category === INVENTORY_SALE_CATEGORY || category === INVENTORY_PURCHASE_CATEGORY) {
        showNotification("No se pueden guardar transacciones de inventario como plantillas.", 'error');
        return;
    }

    const templateName = prompt("Ingresa un nombre para esta plantilla (ej: 'Pago de arriendo'):");
    if (!templateName || templateName.trim() === '') return;

    const templateData = {
        name: templateName.trim(),
        type: document.getElementById('form-type').value,
        amount: parseFloat(document.getElementById('form-amount').value) || 0,
        description: document.getElementById('form-description').value.trim(),
        category: document.getElementById('form-category').value,
        provider: document.getElementById('form-provider').value.trim(),
        providerId: document.getElementById('form-provider-id').value.trim(),
        notes: document.getElementById('form-notes').value.trim()
    };

    transactionTemplates.push(templateData);
    localStorage.setItem('contauno_templates', JSON.stringify(transactionTemplates));
    showNotification(`Plantilla "${templateData.name}" guardada.`, 'success');
    populateTemplateSelect();
}

function populateTemplateSelect() {
    const select = document.getElementById('template-select');
    select.innerHTML = '<option value="">-- Selecciona una plantilla --</option>';
    transactionTemplates.forEach((template, index) => {
        select.innerHTML += `<option value="${index}">${template.name}</option>`;
    });
}

function applyTemplate() {
    const select = document.getElementById('template-select');
    const templateIndex = select.value;
    if (templateIndex === '') return;

    const template = transactionTemplates[parseInt(templateIndex)];
    if (!template) return;

    document.getElementById('form-type').value = template.type;
    renderCategories();
    document.getElementById('form-category').value = template.category;
    handleCategoryChange();

    document.getElementById('form-amount').value = template.amount;
    document.getElementById('form-description').value = template.description;
    document.getElementById('form-provider').value = template.provider;
    document.getElementById('form-provider-id').value = template.providerId;
    document.getElementById('form-notes').value = template.notes;
}

async function editTemplate() {
    const select = document.getElementById('template-select');
    const templateIndex = select.value;
    if (templateIndex === '') {
        showNotification("Selecciona una plantilla para renombrar.", 'error');
        return;
    }
    const oldName = transactionTemplates[templateIndex].name;
    const newName = prompt(`Renombrar plantilla "${oldName}":`, oldName);
    if (newName && newName.trim() !== '' && newName.trim() !== oldName) {
        transactionTemplates[templateIndex].name = newName.trim();
        localStorage.setItem('contauno_templates', JSON.stringify(transactionTemplates));
        populateTemplateSelect();
        select.value = templateIndex;
        showNotification('Plantilla renombrada.', 'success');
    }
}

async function deleteTemplate() {
    const select = document.getElementById('template-select');
    const templateIndex = select.value;
    if (templateIndex === '') {
        showNotification("Selecciona una plantilla para eliminar.", 'error');
        return;
    }
    
    const templateName = transactionTemplates[templateIndex].name;
    const confirmed = await showConfirmation({
        title: '¿Eliminar Plantilla?',
        message: `¿Seguro que quieres eliminar la plantilla "${templateName}"?`,
        confirmText: 'Sí, Eliminar'
    });

    if (confirmed) {
        transactionTemplates.splice(templateIndex, 1);
        localStorage.setItem('contauno_templates', JSON.stringify(transactionTemplates));
        populateTemplateSelect();
        showNotification('Plantilla eliminada.', 'success');
    }
}


// === RESUMEN MENSUAL Y PDF ===
function updateSummary() {
    const month = parseInt(document.getElementById('month-select').value);
    const year = parseInt(document.getElementById('year-select').value);
    let income = 0, expenses = 0;

    for (const dateKey in transactions) {
        const date = new Date(dateKey + 'T00:00:00'); 
        if (date.getFullYear() === year && date.getMonth() === month) {
            transactions[dateKey].forEach(t => {
                if (t.type === 'income') income += t.amount;
                else expenses += t.amount;
            });
        }
    }
    
    const balance = income - expenses;
    document.getElementById('monthly-income').textContent = formatCurrency(income);
    document.getElementById('monthly-expenses').textContent = formatCurrency(expenses);
    const balanceEl = document.getElementById('monthly-balance');
    balanceEl.textContent = formatCurrency(balance);
    balanceEl.className = 'summary-value';
    if(balance !== 0) balanceEl.classList.add(balance >= 0 ? 'positive' : 'negative');
}

function generateDailyPdf() {
    try {
        const { jsPDF } = window.jspdf;
        if (typeof jsPDF === 'undefined' || typeof window.jspdf.autoTable === 'undefined') {
            showNotification("Error: No se pudo cargar la funcionalidad PDF.", 'error');
            return;
        }
        
        const dailyTransactions = transactions[selectedDate] || [];
        if (dailyTransactions.length === 0) {
            showNotification("No hay movimientos para generar un PDF.", 'info');
            return;
        }

        const doc = new jsPDF();
        const head = [['Descripción', 'Categoría', 'Tipo', 'Monto']];
        const body = dailyTransactions.map(t => [
            t.description,
            t.category,
            t.type === 'income' ? 'Ingreso' : 'Gasto',
            formatCurrency(t.amount)
        ]);
        
        let totalIncome = 0;
        let totalExpenses = 0;
        dailyTransactions.forEach(t => {
            if (t.type === 'income') totalIncome += t.amount;
            else totalExpenses += t.amount;
        });
        const totalBalance = totalIncome - totalExpenses;

        doc.setFontSize(20);
        doc.text("Resumen de Movimientos", 14, 22);
        doc.setFontSize(12);
        doc.text(`Fecha: ${formatDateForDisplay(selectedDate)}`, 14, 30);

        doc.autoTable({
            startY: 40,
            head: head,
            body: body,
            theme: 'grid',
            headStyles: { fillColor: [41, 128, 186], textColor: 255 },
            styles: { halign: 'left' },
            columnStyles: { 3: { halign: 'right' } }
        });

        const finalY = doc.lastAutoTable.finalY || 80;
        doc.setFontSize(14);
        doc.text("Resumen del Día", 14, finalY + 15);
        
        doc.setFontSize(10);
        doc.text(`Total Ingresos: ${formatCurrency(totalIncome)}`, 14, finalY + 23);
        doc.text(`Total Gastos: ${formatCurrency(totalExpenses)}`, 14, finalY + 31);
        
        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        doc.text(`Balance del Día: ${formatCurrency(totalBalance)}`, 14, finalY + 40);

        doc.save(`Resumen_${selectedDate}.pdf`);
    } catch (error) {
        console.error("Error al generar el PDF diario:", error);
        showNotification("Ocurrió un error al generar el PDF.", 'error');
    }
}


// === FUNCIONES DE UTILIDAD ===
function formatCurrency(amount) {
    if (typeof amount !== 'number') amount = 0;
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(amount);
}

function formatDate(date) {
    return date.toISOString().split('T')[0];
}

function formatDateForDisplay(dateString) {
    const [year, month, day] = dateString.split('-');
    const date = new Date(year, parseInt(month, 10) - 1, parseInt(day, 10));
    return date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}