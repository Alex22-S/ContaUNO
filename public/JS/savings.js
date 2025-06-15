document.addEventListener('DOMContentLoaded', () => {
    // --- SELECTORES DE ELEMENTOS ---
    const savingsView = document.getElementById('savings-view');
    const btnAddGoal = document.getElementById('btn-add-goal');
    const savingsGoalsGrid = document.getElementById('savings-goals-grid');
    const savingsEmptyState = document.getElementById('savings-empty-state');

    // Goal Modal
    const goalModal = document.getElementById('savings-goal-modal');
    const closeGoalModalBtn = document.getElementById('savings-modal-close-btn');
    const cancelGoalBtn = document.getElementById('cancel-goal-btn');
    const goalForm = document.getElementById('savings-goal-form');
    const savingsModalTitle = document.getElementById('savings-modal-title');
    const editingGoalIdInput = document.getElementById('editing-goal-id');

    // Contribution/Withdrawal Modal
    const contributionModal = document.getElementById('add-contribution-modal');
    const closeContributionModalBtn = document.getElementById('contribution-modal-close-btn');
    const contributionForm = document.getElementById('add-contribution-form');
    const contributionModalTitle = document.getElementById('contribution-modal-title');
    const contributionGoalIdInput = document.getElementById('contribution-goal-id');
    const contributionGoalName = document.getElementById('contribution-goal-name');
    const saveContributionBtn = document.getElementById('save-contribution-btn');

    // History Modal
    const historyModal = document.getElementById('savings-history-modal');
    const closeHistoryModalBtn = document.getElementById('history-modal-close-btn');
    const historyModalTitle = document.getElementById('history-modal-title');
    const historyModalSubtitle = document.getElementById('history-modal-subtitle');
    const historyTableBody = document.getElementById('savings-history-body');
    const historyEmptyState = document.getElementById('savings-history-empty');
    
    // Category Management
    const addCategoryBtn = document.getElementById('add-savings-category-btn');
    const editCategoryBtn = document.getElementById('edit-savings-category-btn');
    const deleteCategoryBtn = document.getElementById('delete-savings-category-btn');

    // --- ESTADO Y DATOS (Simulando un Backend/DB) ---
    let goals = [];
    let categories = {
        add: ["Abono Extra", "Salario", "Bonificación", "Regalo"],
        withdraw: ["Compra", "Emergencia", "Ocio", "Retiro General"]
    };

    // --- FUNCIONES DE UTILIDAD ---
    const formatCurrency = (amount) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(amount);
    
    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        const date = new Date(dateString + 'T00:00:00');
        // Formato DD/MM/YYYY
        return date.toLocaleDateString('es-CO', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    };

    // --- GESTIÓN DE DATOS EN LOCALSTORAGE ---
    const saveData = () => {
        localStorage.setItem('contauno_savings_goals', JSON.stringify(goals));
        localStorage.setItem('contauno_savings_categories', JSON.stringify(categories));
    };

    const loadData = () => {
        const savedGoals = localStorage.getItem('contauno_savings_goals');
        const savedCategories = localStorage.getItem('contauno_savings_categories');
        goals = savedGoals ? JSON.parse(savedGoals) : [];
        if (savedCategories) {
            categories = JSON.parse(savedCategories);
        }
        renderSavingsGoals();
    };

    // --- MANEJO DE VISTAS ---
    window.showSavingsView = () => {
        hideAllViews(); 
        savingsView.style.display = 'block'; 
        loadData();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // --- MANEJO DE MODALES ---
    const openGoalModal = (goalId = null) => {
        goalForm.reset();
        editingGoalIdInput.value = '';
        document.getElementById('goal-initial-amount').disabled = false;
        
        if (goalId) {
            const goal = goals.find(g => g.id === goalId);
            if (goal) {
                savingsModalTitle.textContent = 'Editar Meta';
                editingGoalIdInput.value = goal.id;
                document.getElementById('goal-name').value = goal.name;
                document.getElementById('goal-target-amount').value = goal.target;
                document.getElementById('goal-target-date').value = goal.targetDate || '';
                document.getElementById('goal-initial-amount').disabled = true;
            }
        } else {
            savingsModalTitle.textContent = 'Crear Nueva Meta';
        }
        goalModal.style.display = 'flex';
    };

    const closeGoalModal = () => goalModal.style.display = 'none';

    const openContributionModal = (goalId) => {
        const goal = goals.find(g => g.id === goalId);
        if (!goal) return;

        contributionForm.reset();
        document.getElementById('type-add').checked = true;
        contributionGoalIdInput.value = goalId;
        contributionGoalName.textContent = goal.name;
        document.getElementById('contribution-date').valueAsDate = new Date();
        
        handleMovementTypeChange();
        contributionModal.style.display = 'flex';
    };

    const closeContributionModal = () => contributionModal.style.display = 'none';
    
    const openHistoryModal = (goalId) => {
        const goal = goals.find(g => g.id === goalId);
        if (!goal) return;

        historyModalTitle.textContent = `Historial de: ${goal.name}`;
        historyModalSubtitle.textContent = `Objetivo: ${formatCurrency(goal.target)}`;
        
        if (goal.history && goal.history.length > 0) {
            historyTableBody.innerHTML = goal.history
                .slice() 
                .sort((a, b) => new Date(b.date) - new Date(a.date)) 
                .map(item => {
                    const amountClass = item.type === 'add' ? 'positive-value' : 'negative-value';
                    
                    // ✅ CORRECCIÓN: Se añaden las clases a cada celda (<td>) para que coincidan
                    // con los anchos y estilos definidos en el CSS del index.html
                    return `
                        <tr class="movement-${item.type}">
                            <td class="col-fecha">${formatDate(item.date)}</td>
                            <td class="col-tipo">${item.type === 'add' ? 'Abono' : 'Retiro'}</td>
                            <td class="col-categoria">${item.category}</td>
                            <td class="col-monto ${amountClass}">
                                ${formatCurrency(item.amount)}
                            </td>
                        </tr>
                    `;
                }).join('');
            historyEmptyState.style.display = 'none';
            historyTableBody.parentElement.style.display = 'table';
        } else {
            historyTableBody.innerHTML = '';
            historyEmptyState.style.display = 'block';
            historyTableBody.parentElement.style.display = 'none';
        }
        historyModal.style.display = 'flex';
    };


    const closeHistoryModal = () => historyModal.style.display = 'none';

    // --- LÓGICA DE CATEGORÍAS ---
    const renderCategories = (type) => {
        const categorySelect = document.getElementById('contribution-category');
        if (!categories.add) categories.add = ["Abono Extra", "Salario"];
        if (!categories.withdraw) categories.withdraw = ["Compra", "Emergencia"];

        categorySelect.innerHTML = categories[type]
            .map(cat => `<option value="${cat}">${cat}</option>`)
            .join('');
    };
    
    const handleMovementTypeChange = () => {
        const type = document.querySelector('input[name="contribution-type"]:checked').value;
        contributionModalTitle.textContent = type === 'add' ? 'Añadir Abono' : 'Retirar Fondos';
        saveContributionBtn.innerHTML = type === 'add' ? '💸 Añadir Abono' : '🛍️ Confirmar Retiro';
        renderCategories(type);
    };

    const manageCategory = async (action) => {
        const type = document.querySelector('input[name="contribution-type"]:checked').value;
        const select = document.getElementById('contribution-category');
        const currentCategory = select.value;

        if (action === 'add') {
            const newCategory = prompt(`Nueva categoría para ${type === 'add' ? 'Abonos' : 'Retiros'}:`);
            if (newCategory && !categories[type].includes(newCategory)) {
                categories[type].push(newCategory);
            }
        } else if (action === 'edit') {
            if (!currentCategory) return alert('Selecciona una categoría para editar.');
            const updatedCategory = prompt('Editar categoría:', currentCategory);
            if (updatedCategory && updatedCategory !== currentCategory) {
                const index = categories[type].indexOf(currentCategory);
                categories[type][index] = updatedCategory;
            }
        } else if (action === 'delete') {
            if (!currentCategory) return alert('Selecciona una categoría para eliminar.');
            if (confirm(`¿Eliminar la categoría "${currentCategory}"?`)) {
                categories[type] = categories[type].filter(c => c !== currentCategory);
            }
        }
        saveData();
        renderCategories(type);
    };
    
    // --- LÓGICA PRINCIPAL (CRUD) ---
    const handleGoalSubmit = (e) => {
        e.preventDefault();
        const goalId = editingGoalIdInput.value;
        
        const goalData = {
            name: document.getElementById('goal-name').value,
            target: parseFloat(document.getElementById('goal-target-amount').value) || 0,
            targetDate: document.getElementById('goal-target-date').value,
        };

        if (!goalData.name || goalData.target <= 0) {
            return alert('Por favor, introduce un nombre válido y un objetivo mayor que cero.');
        }

        if (goalId) { // Editando
            const index = goals.findIndex(g => g.id === goalId);
            if (index > -1) {
                goals[index] = { ...goals[index], ...goalData };
            }
        } else { // Creando
            const newGoal = {
                id: `goal_${Date.now()}`,
                saved: parseFloat(document.getElementById('goal-initial-amount').value) || 0,
                history: [],
                ...goalData
            };
            if (newGoal.saved > 0) {
                newGoal.history.push({
                    type: 'add',
                    amount: newGoal.saved,
                    date: new Date().toISOString().split('T')[0],
                    category: 'Ahorro Inicial'
                });
            }
            goals.push(newGoal);
        }
        saveData();
        renderSavingsGoals();
        closeGoalModal();
    };

    const handleContributionSubmit = (e) => {
        e.preventDefault();
        const goalId = contributionGoalIdInput.value;
        const amount = parseFloat(document.getElementById('contribution-amount').value);
        const type = document.querySelector('input[name="contribution-type"]:checked').value;

        if (!amount || amount <= 0) return alert('El monto debe ser mayor a cero.');

        const index = goals.findIndex(g => g.id === goalId);
        if (index > -1) {
            const goal = goals[index];
            if (type === 'withdraw' && amount > goal.saved) {
                return alert('No puedes retirar más de lo que tienes ahorrado.');
            }

            goal.saved += (type === 'add' ? amount : -amount);
            goal.history.push({
                type: type,
                amount: amount,
                date: document.getElementById('contribution-date').value,
                category: document.getElementById('contribution-category').value
            });

            saveData();
            renderSavingsGoals();
            closeContributionModal();
        }
    };
    
    const handleDeleteGoal = (goalId) => {
        if (confirm('¿Estás seguro de que quieres eliminar esta meta y todo su historial?')) {
            goals = goals.filter(g => g.id !== goalId);
            saveData();
            renderSavingsGoals();
        }
    };

    // --- RENDERIZADO ---
    const renderSavingsGoals = () => {
        if (goals.length === 0) {
            savingsEmptyState.style.display = 'block';
            savingsGoalsGrid.style.display = 'none';
        } else {
            savingsEmptyState.style.display = 'none';
            savingsGoalsGrid.style.display = 'grid';
            
            savingsGoalsGrid.innerHTML = goals.map(goal => {
                const percentage = goal.target > 0 ? (goal.saved / goal.target) * 100 : (goal.saved > 0 ? 100 : 0);
                const isCompleted = goal.saved >= goal.target;
                
                return `
                <div class="savings-goal-card ${isCompleted ? 'completed' : ''}">
                    <div class="goal-card-header">
                        <h3 class="goal-card-title">${goal.name}</h3>
                        <div class="goal-card-actions">
                            <button class="goal-action-btn history-btn" data-id="${goal.id}" title="Ver Historial">📜</button>
                            <button class="goal-action-btn edit-btn" data-id="${goal.id}" title="Editar Meta">✏️</button>
                            <button class="goal-action-btn delete-btn" data-id="${goal.id}" title="Eliminar Meta">🗑️</button>
                        </div>
                    </div>
                    <div class="goal-card-body">
                        <div class="goal-card-progress">
                            <div class="progress-info">
                                <span>${formatCurrency(goal.saved)}</span>
                                <span>de ${formatCurrency(goal.target)}</span>
                            </div>
                            <div class="progress-bar-container">
                                <div class="progress-bar" style="width: ${Math.min(100, percentage)}%;"></div>
                            </div>
                            <div class="progress-percentage">${Math.round(percentage)}% completado</div>
                        </div>
                        <div class="goal-card-details">
                           <span>Fecha Objetivo:</span>
                           <span class="date">${formatDate(goal.targetDate)}</span>
                        </div>
                    </div>
                    <div class="goal-card-footer">
                        ${!isCompleted ? `<button class="btn-add-contribution" data-id="${goal.id}">Añadir / Retirar</button>` : `<div class="completed-badge">🏆 ¡Meta Alcanzada!</div>`}
                    </div>
                </div>`;
            }).join('');
        }

        // Asignar eventos después de renderizar
        document.querySelectorAll('.edit-btn').forEach(b => b.onclick = () => openGoalModal(b.dataset.id));
        document.querySelectorAll('.delete-btn').forEach(b => b.onclick = () => handleDeleteGoal(b.dataset.id));
        document.querySelectorAll('.history-btn').forEach(b => b.onclick = () => openHistoryModal(b.dataset.id));
        document.querySelectorAll('.btn-add-contribution').forEach(b => b.onclick = () => openContributionModal(b.dataset.id));
    };

    // --- EVENT LISTENERS ---
    btnAddGoal.addEventListener('click', () => openGoalModal());
    closeGoalModalBtn.addEventListener('click', closeGoalModal);
    cancelGoalBtn.addEventListener('click', closeGoalModal);
    goalForm.addEventListener('submit', handleGoalSubmit);

    closeContributionModalBtn.addEventListener('click', closeContributionModal);
    contributionForm.addEventListener('submit', handleContributionSubmit);
    document.querySelectorAll('input[name="contribution-type"]').forEach(radio => {
        radio.addEventListener('change', handleMovementTypeChange);
    });

    closeHistoryModalBtn.addEventListener('click', closeHistoryModal);

    addCategoryBtn.addEventListener('click', () => manageCategory('add'));
    editCategoryBtn.addEventListener('click', () => manageCategory('edit'));
    deleteCategoryBtn.addEventListener('click', () => manageCategory('delete'));

    // --- INICIALIZACIÓN ---
    loadData();
});