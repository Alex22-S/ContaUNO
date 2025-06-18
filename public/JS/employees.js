// JS/employees.js (CORREGIDO Y MEJORADO)

// Almacenamos una copia local de los empleados para no tener que consultar a la BD en cada búsqueda
let allEmployees = [];
// Almacenamos una copia de los valores legales para usarlos en el frontend
let localLegalSettings = {}; 

document.addEventListener('DOMContentLoaded', () => {
    const employeeModal = document.getElementById('employee-modal');
    const addEmployeeBtn = document.getElementById('btn-add-employee');
    const closeBtn = document.getElementById('employee-modal-close-btn');
    const employeeForm = document.getElementById('employee-form');
    const searchInput = document.getElementById('employee-search-input');
    const setSmlmvBtn = document.getElementById('btn-set-smlmv');
    
    // Cargar empleados al iniciar si la vista de empleados es visible
    if(document.getElementById('employees-view').style.display !== 'none') {
        fetchAllEmployees();
        fetchLocalLegalSettings(); // Cargar valores para el botón SMLMV
    }

    // Evento para la búsqueda
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            const filteredEmployees = allEmployees.filter(emp => 
                emp.nombre.toLowerCase().includes(searchTerm) || 
                (emp.documento && emp.documento.includes(searchTerm))
            );
            renderEmployeesTable(filteredEmployees);
        });
    }

    // Abrir modal para añadir
    addEmployeeBtn.addEventListener('click', () => {
        employeeForm.reset();
        document.getElementById('editing-employee-id').value = '';
        document.getElementById('employee-modal-title').innerText = 'Añadir Nuevo Empleado';
        employeeModal.style.display = 'flex';
    });

    // Cerrar modal
    closeBtn.addEventListener('click', () => employeeModal.style.display = 'none');
    window.addEventListener('click', (event) => {
        if (event.target == employeeModal) {
            employeeModal.style.display = 'none';
        }
    });

    // Botón para autocompletar Salario Mínimo
    setSmlmvBtn.addEventListener('click', () => {
        if (localLegalSettings && localLegalSettings.SMLMV) {
            document.getElementById('employee-salary').value = localLegalSettings.SMLMV;
        } else {
            showNotification('Valores legales no cargados. Intenta de nuevo.', 'warning');
        }
    });

    // Guardar o editar empleado
    employeeForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const employeeId = document.getElementById('editing-employee-id').value;
        const employeeData = {
            nombre: document.getElementById('employee-name').value.trim(),
            documento: document.getElementById('employee-doc').value.trim(),
            fechaContratacion: document.getElementById('employee-hire-date').value,
            sueldo: parseFloat(document.getElementById('employee-salary').value),
            recibeAuxTransporte: document.getElementById('employee-transport-aid').value,
            arlLevel: parseInt(document.getElementById('employee-arl-level').value),
            contractType: document.getElementById('employee-contract-type').value,
            bank: document.getElementById('employee-bank').value,
            accountNumber: document.getElementById('employee-account-number').value.trim(),
            estado: 'activo' 
        };

        if (!employeeData.nombre || !employeeData.documento || !employeeData.fechaContratacion || isNaN(employeeData.sueldo)) {
            showNotification('Por favor, completa todos los campos requeridos.', 'error');
            return;
        }

        try {
            if (employeeId) {
                await db.collection('employees').doc(employeeId).update(employeeData);
                if(window.showNotification) showNotification('Empleado actualizado con éxito', 'success');
            } else {
                await db.collection('employees').add(employeeData);
                if(window.showNotification) showNotification('Empleado añadido con éxito', 'success');
            }
            
            employeeModal.style.display = 'none';
            fetchAllEmployees(); 
        } catch (error) {
            console.error("Error guardando empleado: ", error);
            if(window.showNotification) showNotification('Ocurrió un error al guardar el empleado.', 'error');
        }
    });
});

async function fetchLocalLegalSettings() {
    try {
        const doc = await db.collection('settings').doc('legalValues').get();
        if (doc.exists) {
            localLegalSettings = doc.data();
        } else {
            console.log("No legal settings found in Firestore.");
        }
    } catch(error) {
        console.error("Error fetching legal settings for frontend: ", error);
    }
}

async function fetchAllEmployees() {
    const container = document.getElementById('employees-table-container');
    container.innerHTML = '<p style="text-align:center; padding: 2rem;">Cargando empleados...</p>';
    try {
        const snapshot = await db.collection('employees').orderBy('nombre').get();
        allEmployees = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderEmployeesTable(allEmployees);
    } catch (error) {
        console.error("Error obteniendo empleados: ", error);
        container.innerHTML = `<div class="empty-state" style="padding: 2rem;"><p class="negative-value">Error al cargar los empleados. Es posible que necesites crear un índice en Firebase. Revisa la consola (F12) para más detalles.</p></div>`;
    }
}

function renderEmployeesTable(employees) {
    const container = document.getElementById('employees-table-container');
    
    if (employees.length === 0) {
        container.innerHTML = '<div class="empty-state" style="text-align:center; padding: 2rem;"><p>No se encontraron empleados. ¡Añade el primero o ajusta tu búsqueda!</p></div>';
        return;
    }

    let tableHTML = `
        <table class="payroll-table">
            <thead>
                <tr>
                    <th>Nombre</th>
                    <th>Documento</th>
                    <th>Salario Base</th>
                    <th>Tipo de Contrato</th>
                    <th>Cuenta Bancaria</th>
                    <th>Estado</th>
                    <th class="actions">Acciones</th>
                </tr>
            </thead>
            <tbody>
    `;

    employees.forEach(emp => {
        const estadoClass = emp.estado === 'activo' ? 'activo' : 'inactivo';
        const contractTypeDisplay = emp.contractType ? emp.contractType.replace(/_/g, ' ') : 'No definido';
        const bankInfo = emp.bank && emp.accountNumber ? `${emp.bank} - ${emp.accountNumber}` : 'No definida';

        tableHTML += `
            <tr data-id="${emp.id}">
                <td>${emp.nombre}</td>
                <td>${emp.documento}</td>
                <td class="currency">${new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(emp.sueldo)}</td>
                <td style="text-transform: capitalize;">${contractTypeDisplay}</td>
                <td>${bankInfo}</td>
                <td><span class="status-badge ${estadoClass}">${emp.estado}</span></td>
                <td class="actions">
                    <button class="edit-btn" onclick="editEmployee('${emp.id}')" title="Editar"><i data-lucide="edit"></i></button>
                    <button class="status-btn" onclick="toggleEmployeeStatus('${emp.id}', '${emp.nombre}', '${emp.estado}')" title="${emp.estado === 'activo' ? 'Marcar como Inactivo' : 'Reactivar'}">
                        ${emp.estado === 'activo' ? '<i data-lucide="user-minus"></i>' : '<i data-lucide="user-plus"></i>'}
                    </button>
                    <button class="delete-btn" onclick="deleteEmployee('${emp.id}', '${emp.nombre}')" title="Eliminar Empleado"><i data-lucide="trash-2"></i></button>
                </td>
            </tr>
        `;
    });

    tableHTML += '</tbody></table>';
    container.innerHTML = tableHTML;
    if(window.lucide) lucide.createIcons();
}

function editEmployee(id) {
    const employee = allEmployees.find(emp => emp.id === id);
    if (employee) {
        document.getElementById('editing-employee-id').value = id;
        document.getElementById('employee-modal-title').innerText = 'Editar Empleado';
        document.getElementById('employee-name').value = employee.nombre || '';
        document.getElementById('employee-doc').value = employee.documento || '';
        document.getElementById('employee-hire-date').value = employee.fechaContratacion || '';
        document.getElementById('employee-salary').value = employee.sueldo || '';
        document.getElementById('employee-transport-aid').value = employee.recibeAuxTransporte || 'auto';
        document.getElementById('employee-arl-level').value = employee.arlLevel || '1';
        document.getElementById('employee-contract-type').value = employee.contractType || 'indefinido';
        document.getElementById('employee-bank').value = employee.bank || '';
        document.getElementById('employee-account-number').value = employee.accountNumber || '';
        
        document.getElementById('employee-modal').style.display = 'flex';
    }
}

function toggleEmployeeStatus(id, name, currentStatus) {
    const newStatus = currentStatus === 'activo' ? 'inactivo' : 'activo';
    const actionText = newStatus === 'inactivo' ? 'desactivar' : 'reactivar';

    if (confirm(`¿Estás seguro de que quieres ${actionText} a ${name}?`)) {
        db.collection('employees').doc(id).update({ estado: newStatus }).then(() => {
            if(window.showNotification) showNotification(`Empleado ${name} marcado como ${newStatus}.`, 'info');
            fetchAllEmployees();
        }).catch(error => {
            console.error(`Error al cambiar estado a ${newStatus}:`, error);
            if(window.showNotification) showNotification('No se pudo actualizar el estado del empleado.', 'error');
        });
    }
}

// ✅ NUEVA FUNCIÓN PARA ELIMINAR EMPLEADOS
async function deleteEmployee(id, name) {
    const confirmation = confirm(`¿Estás SEGURO de que quieres eliminar a ${name}?\n\n⚠️ ¡ESTA ACCIÓN ES PERMANENTE Y NO SE PUEDE DESHACER! ⚠️`);

    if (confirmation) {
        try {
            await db.collection('employees').doc(id).delete();
            if(window.showNotification) showNotification(`El empleado ${name} ha sido eliminado permanentemente.`, 'success');
            fetchAllEmployees(); // Recargar la lista para reflejar el cambio
        } catch (error) {
            console.error("Error al eliminar empleado:", error);
            if(window.showNotification) showNotification('Ocurrió un error al intentar eliminar el empleado.', 'error');
        }
    }
}