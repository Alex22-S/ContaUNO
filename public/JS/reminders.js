document.addEventListener('DOMContentLoaded', () => {
    // Se estandariza el manejo de la URL base de la API
    const API_BASE_URL = '/api';
    const REMINDERS_API_URL = `${API_BASE_URL}/reminders`;
    const TRANSACTIONS_API_URL = `${API_BASE_URL}/transactions`;

    // DOM Elements
    const reminderModal = document.getElementById('reminder-modal');
    const reminderForm = document.getElementById('reminder-form');
    const modalTitle = document.getElementById('reminder-modal-title');
    const grid = document.getElementById('reminders-grid');
    const emptyState = document.getElementById('reminders-empty-state');
    const filterSelect = document.getElementById('reminders-filter');
    const openModalBtn = document.getElementById('btn-add-reminder');
    const closeModalBtn = document.getElementById('reminder-modal-close-btn');
    const cancelBtn = document.getElementById('cancel-reminder-btn');
    const reminderTypeSelect = document.getElementById('reminder-type');
    const financialFields = document.getElementById('financial-fields');
    const recurrenceSelect = document.getElementById('reminder-recurrence');
    const accumulationToggleGroup = document.getElementById('accumulation-toggle-group');
    const shouldAccumulateCheckbox = document.getElementById('reminder-should-accumulate');

    const getAuthHeaders = () => ({ 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('contaunoToken')}` });

    const toggleAccumulationOption = () => {
        if (!recurrenceSelect || !accumulationToggleGroup) return;
        const isRecurrent = recurrenceSelect.value !== 'none';
        accumulationToggleGroup.classList.toggle('hidden', !isRecurrent);
    };

    const openModal = (reminder = null) => {
        reminderForm.reset();
        document.getElementById('editing-reminder-id').value = '';
        if (reminder) {
            modalTitle.textContent = 'Editar Recordatorio';
            document.getElementById('editing-reminder-id').value = reminder.id;
            document.getElementById('reminder-title').value = reminder.title.replace('[ACUMULADO] ', '');
            // CAMBIO: Cargar la descripción al editar
            document.getElementById('reminder-description').value = reminder.description || '';
            document.getElementById('reminder-due-date').value = reminder.dueDate;
            document.getElementById('reminder-type').value = reminder.type || 'payment';
            document.getElementById('reminder-amount').value = reminder.originalAmount || reminder.amount || '';
            document.getElementById('reminder-priority').value = reminder.priority;
            recurrenceSelect.value = reminder.recurrence || 'none';
            shouldAccumulateCheckbox.checked = reminder.shouldAccumulate !== false;
        } else {
            modalTitle.textContent = 'Crear Nuevo Recordatorio';
            shouldAccumulateCheckbox.checked = true;
        }
        toggleFinancialFields();
        toggleAccumulationOption();
        if (reminderModal) reminderModal.style.display = 'flex';
    };

    const closeModal = () => { if (reminderModal) reminderModal.style.display = 'none'; };

    const toggleFinancialFields = () => {
        if (!financialFields || !reminderTypeSelect) return;
        financialFields.classList.toggle('hidden', reminderTypeSelect.value === 'task');
    };

    const calculateNextDueDate = (currentDueDate, recurrence) => {
        const date = new Date(currentDueDate + 'T00:00:00-05:00');
        switch (recurrence) {
            case 'daily': date.setDate(date.getDate() + 1); break;
            case 'weekly': date.setDate(date.getDate() + 7); break;
            case 'monthly': date.setMonth(date.getMonth() + 1); break;
            case 'annually': date.setFullYear(date.getFullYear() + 1); break;
        }
        return date.toISOString().split('T')[0];
    };

    const processOverdueReminders = () => {
        let reminders = getMockReminders();
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const processedReminders = [];
        let hasChanges = false;

        reminders.forEach(r => {
            if (r.recurrence !== 'none' && !r.completed && !r.isAccumulated && r.shouldAccumulate !== false) {
                let dueDate = new Date(r.dueDate + 'T00:00:00-05:00');
                dueDate.setHours(0, 0, 0, 0);

                if (dueDate < today) {
                    hasChanges = true;
                    let missedOccurrences = 0;
                    let accumulatedAmount = 0;
                    let firstMissedDate = r.dueDate;

                    while (dueDate < today) {
                        missedOccurrences++;
                        if (r.amount) {
                            accumulatedAmount += r.amount;
                        }
                        dueDate = new Date(calculateNextDueDate(dueDate.toISOString().split('T')[0], r.recurrence) + 'T00:00:00-05:00');
                    }

                    const accumulatedReminder = {
                        ...r,
                        id: Date.now(),
                        title: `[ACUMULADO] ${r.title}`,
                        amount: accumulatedAmount,
                        originalAmount: r.amount,
                        dueDate: firstMissedDate,
                        priority: 'high',
                        recurrence: 'none',
                        isAccumulated: true,
                        missedOccurrences: missedOccurrences,
                        shouldAccumulate: false
                    };
                    processedReminders.push(accumulatedReminder);

                    const updatedOriginal = { ...r, dueDate: dueDate.toISOString().split('T')[0] };
                    processedReminders.push(updatedOriginal);
                    
                    if (typeof showNotification === 'function') {
                        showNotification(`Se acumuló el recordatorio "${r.title}" (${missedOccurrences} veces).`, 'info');
                    }

                } else {
                    processedReminders.push(r);
                }
            } else {
                processedReminders.push(r);
            }
        });

        if (hasChanges) {
            localStorage.setItem('contaunoReminders', JSON.stringify(processedReminders));
        }
    };

    const renderReminders = async () => {
        try {
            const reminders = getMockReminders();
            const filterValue = filterSelect.value;
            grid.innerHTML = '';

            const filteredReminders = reminders.filter(r => {
                const statusInfo = getStatus(r);
                if (filterValue === 'all') return true;
                if (filterValue === 'pending') return !r.completed && statusInfo.key !== 'past-due';
                if (filterValue === 'past-due') return !r.completed && statusInfo.key === 'past-due';
                if (filterValue === 'completed') return r.completed;
                return true;
            }).sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

            if (filteredReminders.length === 0) {
                emptyState.style.display = 'block';
                grid.style.display = 'none';
            } else {
                emptyState.style.display = 'none';
                grid.style.display = 'grid';
                filteredReminders.forEach(reminder => grid.appendChild(createReminderCard(reminder)));
            }
        } catch (error) {
            if (typeof showNotification === 'function') {
                showNotification(`Error al cargar recordatorios: ${error.message}`, 'error');
            }
        }
    };
    
    const getStatus = (reminder) => {
        if (reminder.completed) return { text: 'Completado', class: 'status-completed', key: 'completed' };
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const dueDate = new Date(reminder.dueDate + 'T00:00:00-05:00');
        dueDate.setHours(0,0,0,0);

        const diffTime = dueDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays < 0) return { text: 'Vencido', class: 'status-past-due', key: 'past-due' };
        if (diffDays === 0) return { text: 'Vence Hoy', class: 'status-due-today', key: 'due-today' };
        if (diffDays <= 7) return { text: `Vence en ${diffDays} días`, class: 'status-due-soon', key: 'due-soon' };
        return { text: 'Pendiente', class: 'status-pending', key: 'pending' };
    };

    const createReminderCard = (reminder) => {
        const card = document.createElement('div');
        const status = getStatus(reminder);
        const priorityClasses = { low: 'priority-low', medium: 'priority-medium', high: 'priority-high' };
        
        const priorityTranslations = {
            low: 'Baja',
            medium: 'Media',
            high: 'Alta'
        };

        card.className = `reminder-card ${reminder.completed ? 'completed' : ''} type-${reminder.type} ${reminder.isAccumulated ? 'accumulated' : ''}`;
        card.dataset.id = reminder.id;

        const typeInfo = { 
            payment: { text: 'Pago', icon: '🔴' }, 
            collection: { text: 'Cobro', icon: '🟢' }, 
            task: { text: 'Tarea', icon: '🔵' }
        };
        
        const accumulatedInfo = reminder.isAccumulated 
            ? `<p class="accumulated-info">⚠️ Acumulado de ${reminder.missedOccurrences} ocurrencias vencidas.</p>`
            : '';
        
        // CAMBIO: Crear HTML para la descripción si existe
        const descriptionInfo = reminder.description
            ? `<p class="reminder-description">${reminder.description}</p>`
            : '';

        const formatCurrency = (value) => {
            return value ? new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(value) : '';
        };

        card.innerHTML = `
            <div class="reminder-card-header">
                <h3 class="reminder-title">${reminder.title}</h3>
                <div class="reminder-tags">
                    <span class="reminder-priority ${priorityClasses[reminder.priority]}">${priorityTranslations[reminder.priority] || reminder.priority}</span>
                    ${reminder.recurrence !== 'none' ? `<span class="reminder-recurrence-icon" title="Recordatorio Recurrente">🔄</span>` : ''}
                </div>
            </div>
            <div class="reminder-body">
                <p class="reminder-type-text type-${reminder.type}">
                    <span class="type-icon">${typeInfo[reminder.type].icon}</span>
                    ${typeInfo[reminder.type].text}
                </p>
                ${accumulatedInfo}
                ${descriptionInfo} <p>🗓️ Vence: ${new Date(reminder.dueDate + 'T00:00:00-05:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                ${reminder.amount ? `<p class="reminder-amount">💰 ${formatCurrency(reminder.amount)}</p>` : ''}
            </div>
            <div class="reminder-footer">
                <div class="reminder-status ${status.class}">${status.text}</div>
                <div class="reminder-actions">
                    <button class="action-btn edit" title="Editar">✏️</button>
                    <button class="action-btn delete" title="Eliminar">🗑️</button>
                    ${!reminder.completed ? `<button class="action-btn complete" title="Marcar como Completado">✔️</button>` : ''}
                </div>
            </div>
        `;
        card.querySelector('.edit').addEventListener('click', () => openModal(reminder));
        card.querySelector('.delete').addEventListener('click', () => handleDelete(reminder.id, reminder.title));
        const completeBtn = card.querySelector('.complete');
        if (completeBtn) completeBtn.addEventListener('click', () => handleComplete(reminder));
        return card;
    };

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        const editingId = document.getElementById('editing-reminder-id').value;
        const recurrenceValue = document.getElementById('reminder-recurrence').value;

        const reminderData = {
            title: document.getElementById('reminder-title').value.trim(),
            // CAMBIO: Guardar la descripción
            description: document.getElementById('reminder-description').value.trim(),
            dueDate: document.getElementById('reminder-due-date').value,
            type: document.getElementById('reminder-type').value,
            amount: parseFloat(document.getElementById('reminder-amount').value) || null,
            priority: document.getElementById('reminder-priority').value,
            recurrence: recurrenceValue,
            shouldAccumulate: recurrenceValue !== 'none' && document.getElementById('reminder-should-accumulate').checked,
            completed: false,
        };
        
        if (!reminderData.title || !reminderData.dueDate) {
            if (typeof showNotification === 'function') showNotification('El título y la fecha de vencimiento son obligatorios.', 'error');
            return;
        }
        if (reminderData.type === 'task') reminderData.amount = null;

        try {
            saveMockReminder(reminderData, editingId);
            await renderReminders();
            closeModal();
            if (typeof showNotification === 'function') showNotification(`Recordatorio ${editingId ? 'actualizado' : 'guardado'} con éxito.`, 'success');
        } catch (error) {
            if (typeof showNotification === 'function') showNotification(`Error: ${error.message}`, 'error');
        }
    };
    
    const handleDelete = (id, title) => {
        if (typeof showConfirmationDialog === 'function') {
            showConfirmationDialog({
                title: '¿Estás seguro?',
                message: `Esto eliminará permanentemente el recordatorio "${title}".`,
                onConfirm: async () => {
                    try {
                        deleteMockReminder(id);
                        await renderReminders();
                        if (typeof showNotification === 'function') showNotification('Recordatorio eliminado.', 'success');
                    } catch(error) {
                        if (typeof showNotification === 'function') showNotification(`Error al eliminar: ${error.message}`, 'error');
                    }
                }
            });
        }
    };
    
    const handleComplete = async (reminder) => {
        const formatCurrency = (value) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(value);
        if (!reminder.isAccumulated && (reminder.type === 'payment' || reminder.type === 'collection')) {
            const transactionType = reminder.type === 'payment' ? 'gasto' : 'ingreso';
            if (typeof showConfirmationDialog === 'function') {
                showConfirmationDialog({
                    title: '¿Crear Transacción?',
                    message: `Este es un recordatorio de ${transactionType}. ¿Deseas crear la transacción correspondiente por ${formatCurrency(reminder.amount)}?`,
                    confirmText: 'Sí, crear',
                    cancelText: 'No, solo marcar',
                    onConfirm: async () => {
                        await createTransactionFromReminder(reminder);
                        await completeAndRecur(reminder);
                    },
                    onCancel: async () => {
                        await completeAndRecur(reminder);
                    }
                });
            }
        } else {
            await completeAndRecur(reminder);
        }
    };

    const createTransactionFromReminder = async (reminder) => {
        const transactionData = {
            date: new Date().toISOString().split('T')[0],
            type: reminder.type === 'payment' ? 'expense' : 'income',
            description: `Transacción desde recordatorio: ${reminder.title}`,
            amount: reminder.amount,
            category: 'Desde Recordatorios'
        };
        try {
            console.log(`Simulando POST a ${TRANSACTIONS_API_URL}`, transactionData);
            if (typeof showNotification === 'function') showNotification('Transacción creada automáticamente.', 'success');
        } catch(error) {
             if (typeof showNotification === 'function') showNotification(`Error al crear transacción: ${error.message}`, 'error');
        }
    };

    const completeAndRecur = async (reminder) => {
        try {
            if (reminder.isAccumulated) {
                deleteMockReminder(reminder.id);
                if (typeof showNotification === 'function') showNotification(`Deuda acumulada "${reminder.title}" saldada.`, 'success');
            } else {
                const updatedReminder = { ...reminder, completed: true };
                saveMockReminder(updatedReminder, reminder.id);

                if (reminder.recurrence !== 'none') {
                    const nextDueDate = calculateNextDueDate(reminder.dueDate, reminder.recurrence);
                    const newReminder = { ...reminder, dueDate: nextDueDate, completed: false };
                    delete newReminder.id;
                    saveMockReminder(newReminder);
                    if (typeof showNotification === 'function') showNotification(`Recordatorio completado. Se creó la siguiente ocurrencia para el ${nextDueDate}.`, 'info');
                } else {
                    if (typeof showNotification === 'function') showNotification('¡Recordatorio completado!', 'success');
                }
            }
            await renderReminders();
        } catch(error) {
             if (typeof showNotification === 'function') showNotification(`Error al completar: ${error.message}`, 'error');
        }
    };

    if (openModalBtn) openModalBtn.addEventListener('click', () => openModal());
    if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
    if (reminderForm) reminderForm.addEventListener('submit', handleFormSubmit);
    if (filterSelect) filterSelect.addEventListener('change', renderReminders);
    if (reminderTypeSelect) reminderTypeSelect.addEventListener('change', toggleFinancialFields);
    if (recurrenceSelect) recurrenceSelect.addEventListener('change', toggleAccumulationOption);
    window.addEventListener('click', (e) => { if (e.target === reminderModal) closeModal(); });
    
    function getMockReminders() {
        const reminders = localStorage.getItem('contaunoReminders');
        return reminders ? JSON.parse(reminders) : [];
    }

    function saveMockReminder(reminderData, editingId = null) {
        let reminders = getMockReminders();
        if (editingId) {
            const index = reminders.findIndex(r => r.id == editingId);
            if (index > -1) {
                reminders[index] = { ...reminders[index], ...reminderData, id: reminders[index].id };
            }
        } else {
            const newId = Date.now() + Math.random();
            reminders.push({ id: newId, ...reminderData });
        }
        localStorage.setItem('contaunoReminders', JSON.stringify(reminders));
    }
    
    function deleteMockReminder(id) {
        let reminders = getMockReminders().filter(r => r.id != id);
        localStorage.setItem('contaunoReminders', JSON.stringify(reminders));
    }

    window.initializeRemindersView = () => {
        processOverdueReminders(); 
        renderReminders();
    };
});