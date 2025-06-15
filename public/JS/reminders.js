document.addEventListener('DOMContentLoaded', () => {
    // Se estandariza el manejo de la URL base de la API
    const API_BASE_URL = '/api';
    const API_URL = `${API_BASE_URL}/reminders`;

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
    
    // --- ✅ CORREGIDO: Función para obtener Headers con el Token ---
    const getAuthHeaders = () => {
        // CORRECCIÓN: Se usa 'contaunoToken' que es el nombre correcto guardado durante el login.
        const token = localStorage.getItem('contaunoToken'); 
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };
    };

    const openModal = (reminder = null) => {
        reminderForm.reset();
        document.getElementById('editing-reminder-id').value = '';
        if (reminder) {
            modalTitle.textContent = 'Editar Recordatorio';
            document.getElementById('editing-reminder-id').value = reminder.id;
            document.getElementById('reminder-title').value = reminder.title;
            document.getElementById('reminder-due-date').value = reminder.dueDate;
            document.getElementById('reminder-amount').value = reminder.amount || '';
            document.getElementById('reminder-priority').value = reminder.priority;
        } else {
            modalTitle.textContent = 'Crear Nuevo Recordatorio';
        }
        if (reminderModal) reminderModal.style.display = 'flex';
    };

    const closeModal = () => {
        if (reminderModal) reminderModal.style.display = 'none';
    };

    const renderReminders = async () => {
        try {
            const response = await fetch(API_URL, { headers: getAuthHeaders() }); 
            if (response.status === 401 || response.status === 403) {
                 showNotification('Sesión inválida. Por favor, inicia sesión de nuevo.', 'error');
                 // Opcional: Redirigir al login
                 // window.location.href = '/login.html';
                 return;
            }
            if (!response.ok) throw new Error('No se pudo conectar con el servidor.');
            
            const reminders = await response.json();
            const filterValue = filterSelect.value;
            grid.innerHTML = '';

            const filteredReminders = reminders.filter(r => {
                const isPastDue = !r.completed && new Date(r.dueDate) < new Date().setHours(0, 0, 0, 0);
                if (filterValue === 'all') return true;
                if (filterValue === 'pending') return !r.completed && !isPastDue;
                if (filterValue === 'past-due') return isPastDue;
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
            showNotification(`Error: ${error.message}`, 'error');
        }
    };
    
    const createReminderCard = (reminder) => {
        const card = document.createElement('div');
        const today = new Date().setHours(0, 0, 0, 0);
        const dueDate = new Date(reminder.dueDate + 'T00:00:00-05:00').setHours(0, 0, 0, 0);
        let statusClass = 'status-pending', statusText = 'Pendiente';
        if (reminder.completed) {
            statusClass = 'status-completed'; statusText = 'Completado';
        } else if (dueDate < today) {
            statusClass = 'status-past-due'; statusText = 'Vencido';
        }
        const priorityClasses = { low: 'priority-low', medium: 'priority-medium', high: 'priority-high' };
        card.className = `reminder-card ${reminder.completed ? 'completed' : ''}`;
        card.dataset.id = reminder.id;
        card.innerHTML = `
            <div class="reminder-card-header">
                <h3 class="reminder-title">${reminder.title}</h3>
                <span class="reminder-priority ${priorityClasses[reminder.priority]}">${reminder.priority}</span>
            </div>
            <div class="reminder-body">
                <p>🗓️ Vence: ${new Date(reminder.dueDate + 'T00:00:00-05:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                ${reminder.amount ? `<p class="reminder-amount">💰 ${formatCurrency(reminder.amount)}</p>` : ''}
            </div>
            <div class="reminder-status ${statusClass}">${statusText}</div>
            <div class="reminder-actions">
                <div>
                    <button class="action-btn edit" title="Editar">✏️</button>
                    <button class="action-btn delete" title="Eliminar">🗑️</button>
                </div>
                ${!reminder.completed ? `<button class="action-btn complete" title="Marcar como Completado">✔️</button>` : ''}
            </div>`;
        card.querySelector('.edit').addEventListener('click', () => openModal(reminder));
        card.querySelector('.delete').addEventListener('click', () => handleDelete(reminder.id, reminder.title));
        const completeBtn = card.querySelector('.complete');
        if (completeBtn) completeBtn.addEventListener('click', () => handleToggleComplete(reminder));
        return card;
    };

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        const editingId = document.getElementById('editing-reminder-id').value;
        const reminderData = {
            title: document.getElementById('reminder-title').value.trim(),
            dueDate: document.getElementById('reminder-due-date').value,
            amount: parseFloat(document.getElementById('reminder-amount').value) || null,
            priority: document.getElementById('reminder-priority').value,
        };

        const url = editingId ? `${API_URL}/${editingId}` : API_URL;
        const method = editingId ? 'PUT' : 'POST';

        try {
            const response = await fetch(url, {
                method: method,
                headers: getAuthHeaders(),
                body: JSON.stringify(reminderData)
            });
            if (!response.ok) throw new Error('El servidor no pudo procesar la solicitud.');
            await renderReminders();
            closeModal();
            showNotification(`Recordatorio ${editingId ? 'actualizado' : 'guardado'}.`, 'success');
        } catch (error) {
            showNotification(`Error: ${error.message}`, 'error');
        }
    };
    
    const handleDelete = (id, title) => {
         showConfirmationDialog({
            title: '¿Estás seguro?',
            message: `Se eliminará el recordatorio "${title}".`,
            onConfirm: async () => {
                try {
                    const response = await fetch(`${API_URL}/${id}`, { 
                        method: 'DELETE',
                        headers: getAuthHeaders()
                    });
                    if (!response.ok && response.status !== 204) throw new Error('No se pudo eliminar.');
                    await renderReminders();
                    showNotification('Recordatorio eliminado.', 'success');
                } catch(error) {
                    showNotification(`Error: ${error.message}`, 'error');
                }
            }
        });
    };
    
    const handleToggleComplete = async (reminder) => {
        const updatedReminder = { ...reminder, completed: true };
        try {
            const response = await fetch(`${API_URL}/${reminder.id}`, {
                method: 'PUT',
                headers: getAuthHeaders(),
                body: JSON.stringify(updatedReminder)
            });
            if (!response.ok) throw new Error('No se pudo actualizar el estado.');
            await renderReminders();
            showNotification('¡Recordatorio completado!', 'success');
        } catch(error) {
             showNotification(`Error: ${error.message}`, 'error');
        }
    };

    // Event Listeners
    if (openModalBtn) openModalBtn.addEventListener('click', () => openModal());
    if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
    if (reminderForm) reminderForm.addEventListener('submit', handleFormSubmit);
    if (filterSelect) filterSelect.addEventListener('change', renderReminders);
    window.addEventListener('click', (e) => { if (e.target === reminderModal) closeModal(); });
    
    window.initializeRemindersView = renderReminders;
});