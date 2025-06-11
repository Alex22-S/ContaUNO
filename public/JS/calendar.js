// === SISTEMA DE CALENDARIO Y FORMULARIO PARA CONTAUNO ===

// Variables globales
let currentDate = new Date();
let selectedDate = null;
let transactions = {};
let categories = {};
let transactionTemplates = []; // Para guardar plantillas

// Inicialización cuando el DOM esté listo
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
            income: ['Ventas', 'Servicios', 'Inversiones', 'Freelance', 'Otros Ingresos'],
            expense: ['Suministros', 'Alquiler', 'Servicios Públicos', 'Alimentación', 'Transporte', 'Otros Gastos']
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
    document.getElementById('form-type')?.addEventListener('change', renderCategories);
    document.getElementById('add-category-btn')?.addEventListener('click', addCategory);
    document.getElementById('edit-category-btn')?.addEventListener('click', editCategory);
    document.getElementById('delete-category-btn')?.addEventListener('click', deleteCategory);
    document.getElementById('download-pdf-btn')?.addEventListener('click', generateDailyPdf);
    
    // Event listeners para plantillas
    document.getElementById('save-template-btn')?.addEventListener('click', saveAsTemplate);
    document.getElementById('template-select')?.addEventListener('change', applyTemplate);

    // === NUEVO: Event listeners para los botones de gestión de plantillas ===
    document.getElementById('edit-template-btn')?.addEventListener('click', editTemplate);
    document.getElementById('delete-template-btn')?.addEventListener('click', deleteTemplate);


    // Atajo de teclado para salir de la vista de formulario
    document.addEventListener('keydown', (e) => {
        const formView = document.getElementById('form-view');
        if (e.key === 'Escape' && formView.classList.contains('active')) {
            clearFormAndReturn();
        }
    });
}


// === FUNCIONES DEL CALENDARIO (VISTA) ===

function populateYearSelect() {
    const yearSelect = document.getElementById('year-select');
    if (!yearSelect) return;
    const currentYear = new Date().getFullYear();
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


// === GESTIÓN DEL FORMULARIO DE TRANSACCIÓN ===

function showTransactionForm(dateKey) {
    hideAllViews();
    const formView = document.getElementById('form-view');
    formView.classList.add('active');
    
    selectedDate = dateKey;
    clearForm(false);
    
    document.getElementById('form-date-display').value = formatDateForDisplay(selectedDate);
    document.getElementById('form-title').textContent = `Movimiento para el ${formatDateForDisplay(selectedDate)}`;
    
    renderCategories();
    renderDailyTransactions(selectedDate);
    populateTemplateSelect();
    
    document.getElementById('form-amount').focus();
    document.getElementById('calendar-view').dataset.context = 'true';
}

function handleTransactionSubmit(e) {
    e.preventDefault();
    const editingId = parseInt(document.getElementById('editing-transaction-id').value);

    const transactionData = {
        date: selectedDate,
        type: document.getElementById('form-type').value,
        amount: parseFloat(document.getElementById('form-amount').value),
        description: document.getElementById('form-description').value.trim(),
        category: document.getElementById('form-category').value,
        provider: document.getElementById('form-provider').value.trim(),
        providerId: document.getElementById('form-provider-id').value.trim(),
        notes: document.getElementById('form-notes').value.trim()
    };

    if (!transactionData.amount || transactionData.amount <= 0 || !transactionData.description) {
        alert("Por favor, completa al menos el monto y la descripción.");
        return;
    }

    if (editingId) {
        const index = transactions[selectedDate].findIndex(t => t.id === editingId);
        if (index > -1) {
            transactions[selectedDate][index] = { ...transactions[selectedDate][index], ...transactionData };
        }
    } else {
        if (!transactions[selectedDate]) {
            transactions[selectedDate] = [];
        }
        transactions[selectedDate].push({ ...transactionData, id: Date.now() });
    }

    localStorage.setItem('contauno_transactions', JSON.stringify(transactions));
    
    clearForm(true); 
    updateCalendar(); 
    renderDailyTransactions(selectedDate);
    
    document.getElementById('form-amount').focus();
}

// === Lógica de edición y eliminación ===

function editTransaction(id, dateKey) {
    const transaction = transactions[dateKey]?.find(t => t.id === id);
    if (!transaction) return;

    document.getElementById('editing-transaction-id').value = transaction.id;
    document.getElementById('form-type').value = transaction.type;
    renderCategories();
    document.getElementById('form-category').value = transaction.category;
    document.getElementById('form-amount').value = transaction.amount;
    document.getElementById('form-description').value = transaction.description;
    document.getElementById('form-provider').value = transaction.provider;
    document.getElementById('form-provider-id').value = transaction.providerId;
    document.getElementById('form-notes').value = transaction.notes;

    document.getElementById('save-transaction-btn').textContent = '💾 Actualizar Transacción';
    document.getElementById('form-amount').focus();
}

function deleteTransaction(id, dateKey) {
    if (confirm("¿Estás seguro de que quieres eliminar esta transacción?")) {
        transactions[dateKey] = transactions[dateKey].filter(t => t.id !== id);
        if (transactions[dateKey].length === 0) {
            delete transactions[dateKey];
        }
        localStorage.setItem('contauno_transactions', JSON.stringify(transactions));
        
        updateCalendar();
        renderDailyTransactions(dateKey);
    }
}


// === GESTIÓN DE LA LISTA DE TRANSACCIONES DIARIAS ===
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
    balanceEl.classList.add(balance >= 0 ? 'positive-value' : 'negative-value');
}


// === GESTIÓN DINÁMICA DE CATEGORÍAS ===
function renderCategories() {
    const type = document.getElementById('form-type').value;
    const categorySelect = document.getElementById('form-category');
    categorySelect.innerHTML = '';
    
    if (categories[type] && categories[type].length > 0) {
        categories[type].forEach(cat => {
            categorySelect.innerHTML += `<option value="${cat}">${cat}</option>`;
        });
    } else {
        categorySelect.innerHTML = `<option value="">--Añade una categoría--</option>`;
    }
}

function saveCategories() {
    localStorage.setItem('contauno_categories', JSON.stringify(categories));
}

function addCategory() {
    const type = document.getElementById('form-type').value;
    const newCategory = prompt(`Añadir nueva categoría de ${type === 'income' ? 'Ingreso' : 'Gasto'}:`);
    if (newCategory && newCategory.trim() !== '') {
        if (!categories[type].includes(newCategory.trim())) {
            categories[type].push(newCategory.trim());
            saveCategories();
            renderCategories();
        } else {
            alert('Esa categoría ya existe.');
        }
    }
}

function editCategory() {
    const type = document.getElementById('form-type').value;
    const categorySelect = document.getElementById('form-category');
    const oldCategory = categorySelect.value;
    if (!oldCategory || oldCategory === "") {
        alert("Por favor, selecciona una categoría para editar.");
        return;
    }

    const newCategory = prompt(`Editar categoría "${oldCategory}":`, oldCategory);
    if (newCategory && newCategory.trim() !== '' && newCategory.trim() !== oldCategory) {
        const index = categories[type].indexOf(oldCategory);
        if (index > -1) {
            categories[type][index] = newCategory.trim();
            saveCategories();
            renderCategories();
            categorySelect.value = newCategory.trim();
        }
    }
}

function deleteCategory() {
    const type = document.getElementById('form-type').value;
    const categorySelect = document.getElementById('form-category');
    const categoryToDelete = categorySelect.value;
    if (!categoryToDelete || categoryToDelete === "") {
        alert("Por favor, selecciona una categoría para eliminar.");
        return;
    }
    
    if (confirm(`¿Estás seguro de que quieres eliminar la categoría "${categoryToDelete}"? Esta acción no se puede deshacer.`)) {
        categories[type] = categories[type].filter(cat => cat !== categoryToDelete);
        saveCategories();
        renderCategories();
    }
}


// === SISTEMA DE PLANTILLAS ===
function saveAsTemplate() {
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
    alert(`Plantilla "${templateData.name}" guardada.`);
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
    document.getElementById('form-amount').value = template.amount;
    document.getElementById('form-description').value = template.description;
    document.getElementById('form-provider').value = template.provider;
    document.getElementById('form-provider-id').value = template.providerId;
    document.getElementById('form-notes').value = template.notes;
}

// === NUEVO: GESTIÓN DE PLANTILLAS CON BOTONES ===
function editTemplate() {
    const select = document.getElementById('template-select');
    const templateIndex = select.value;

    if (templateIndex === '') {
        alert("Por favor, selecciona una plantilla para renombrar.");
        return;
    }

    const oldName = transactionTemplates[templateIndex].name;
    const newName = prompt(`Renombrar plantilla "${oldName}":`, oldName);

    if (newName && newName.trim() !== '' && newName.trim() !== oldName) {
        transactionTemplates[templateIndex].name = newName.trim();
        localStorage.setItem('contauno_templates', JSON.stringify(transactionTemplates));
        populateTemplateSelect();
        // Mantener la plantilla editada seleccionada
        select.value = templateIndex;
    }
}

function deleteTemplate() {
    const select = document.getElementById('template-select');
    const templateIndex = select.value;

    if (templateIndex === '') {
        alert("Por favor, selecciona una plantilla para eliminar.");
        return;
    }

    const templateName = transactionTemplates[templateIndex].name;

    if (confirm(`¿Estás seguro de que quieres eliminar la plantilla "${templateName}"?`)) {
        transactionTemplates.splice(templateIndex, 1);
        localStorage.setItem('contauno_templates', JSON.stringify(transactionTemplates));
        populateTemplateSelect(); // Esto actualiza la lista y la resetea
    }
}


// === RESUMEN MENSUAL (CALENDARIO) ===
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
    balanceEl.classList.add(balance >= 0 ? 'positive' : 'negative');
}

// === FUNCIÓN PARA GENERAR PDF (CORREGIDA Y MEJORADA) ===
function generateDailyPdf() {
    // 1. VERIFICACIÓN: Asegurarse de que las librerías jsPDF y autoTable estén cargadas.
    if (typeof window.jspdf === 'undefined' || typeof window.jspdf.jsPDF === 'undefined') {
        console.error("La librería jsPDF no se ha cargado correctamente.");
        alert("Error: No se pudo cargar la funcionalidad PDF. Revisa la conexión a internet o contacta a soporte.");
        return;
    }
    // La librería autoTable se añade al prototipo de jsPDF, por lo que no es necesario verificarla por separado.

    const { jsPDF } = window.jspdf;
    const dailyTransactions = transactions[selectedDate] || [];

    if (dailyTransactions.length === 0) {
        alert("No hay movimientos para generar un PDF en esta fecha.");
        return;
    }

    // 2. CREACIÓN DEL DOCUMENTO
    const doc = new jsPDF();
    
    // 3. DATOS PARA LA TABLA
    const head = [['Descripción', 'Categoría', 'Tipo', 'Monto']];
    const body = dailyTransactions.map(t => [
        t.description,
        t.category,
        t.type === 'income' ? 'Ingreso' : 'Gasto',
        formatCurrency(t.amount)
    ]);
    
    // 4. CÁLCULOS DEL RESUMEN
    let totalIncome = 0;
    let totalExpenses = 0;
    dailyTransactions.forEach(t => {
        if (t.type === 'income') totalIncome += t.amount;
        else totalExpenses += t.amount;
    });
    const totalBalance = totalIncome - totalExpenses;

    // 5. CONSTRUCCIÓN DEL PDF
    doc.setFontSize(20);
    doc.text("Resumen de Movimientos", 14, 22);
    doc.setFontSize(12);
    doc.text(`Fecha: ${formatDateForDisplay(selectedDate)}`, 14, 30);

    // autoTable generará la tabla
    doc.autoTable({
        startY: 40,
        head: head,
        body: body,
        theme: 'grid',
        headStyles: { fillColor: [41, 128, 186], textColor: 255 },
        styles: { halign: 'center' },
        columnStyles: { 3: { halign: 'right' } } // Alinear montos a la derecha
    });

    // Añadir el resumen final debajo de la tabla
    const finalY = doc.lastAutoTable.finalY || 80; // Usar la posición final de la tabla
    doc.setFontSize(14);
    doc.text("Resumen del Día", 14, finalY + 15);
    
    doc.setFontSize(10);
    doc.text(`Total Ingresos: ${formatCurrency(totalIncome)}`, 14, finalY + 23);
    doc.text(`Total Gastos: ${formatCurrency(totalExpenses)}`, 14, finalY + 31);
    
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text(`Balance del Día: ${formatCurrency(totalBalance)}`, 14, finalY + 40);

    // 6. GUARDAR EL DOCUMENTO
    doc.save(`Resumen_${selectedDate}.pdf`);
}


// === FUNCIONES DE UTILIDAD ===

function clearForm(fullReset) {
    if (fullReset) {
        document.getElementById('transaction-form-full').reset();
        document.getElementById('form-type').value = 'income';
    }
    document.getElementById('editing-transaction-id').value = '';
    document.getElementById('save-transaction-btn').textContent = '💾 Guardar Transacción';
    renderCategories();
}

function clearFormAndReturn() {
    clearForm(true);
    showCalendar();
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(amount);
}

function formatDate(date) {
    return date.toISOString().split('T')[0];
}

function formatDateForDisplay(dateString) {
    const [year, month, day] = dateString.split('-');
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}