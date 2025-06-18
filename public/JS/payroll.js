// JS/payroll.js

// Almacena los resultados de los cálculos para la liquidación actual
let payrollResults = {}; 
// Almacena los datos de una liquidación histórica seleccionada para mostrar en detalle
let historicPayrollData = null;
// Almacena los datos del período histórico actual para la búsqueda
let currentHistoricPayroll = null; 
let companySettings = {}; // Almacenará la info de la empresa para los PDFs
let legalSettings = {}; // ✅ Almacenará los valores legales de la nómina desde Firestore

document.addEventListener('DOMContentLoaded', () => {
    // Cargar todas las configuraciones al inicio
    fetchCompanySettings();
    fetchLegalSettings(); // ✅ Cargar valores legales

    // --- Selectores de Vistas ---
    const employeesView = document.getElementById('employees-view');
    const payrollRunView = document.getElementById('payroll-run-view');
    const registeredView = document.getElementById('registered-liquidations-view');
    const detailView = document.getElementById('liquidation-detail-view');
    
    // --- Selectores de Botones y Entradas ---
    const goToPayrollBtn = document.getElementById('btn-go-to-payroll-run');
    const goToRegisteredBtn = document.getElementById('btn-go-to-registered');
    const backToEmployeesFromRunBtn = document.getElementById('btn-back-to-employees-from-run');
    const backToEmployeesFromRegisteredBtn = document.getElementById('btn-back-to-employees-from-registered');
    const backToRegisteredFromDetailBtn = document.getElementById('btn-back-to-registered-view');
    const loadEmployeesBtn = document.getElementById('btn-load-employees-for-payroll');
    const finalizeBtn = document.getElementById('btn-finalize-payroll');
    const downloadPayslipFromViewBtn = document.getElementById('btn-download-payslip-from-view');
    const historicSearchInput = document.getElementById('historic-search-input');
    
    // ✅ Selectores para el modal de configuración de nómina
    const openPayrollSettingsBtn = document.getElementById('btn-open-payroll-settings');
    const payrollSettingsModal = document.getElementById('payroll-settings-modal');
    const closePayrollSettingsBtn = document.getElementById('payroll-settings-modal-close-btn');
    const payrollSettingsForm = document.getElementById('payroll-settings-form');


    // --- Navegación entre vistas ---
    const switchView = (viewToShow) => {
        [employeesView, payrollRunView, registeredView, detailView].forEach(view => {
            view.style.display = (view === viewToShow) ? 'block' : 'none';
        });
    };

    goToPayrollBtn.addEventListener('click', () => {
        if (Object.keys(legalSettings).length === 0) {
            showNotification('Los valores de configuración de nómina no se han cargado. Revisa la consola o la configuración.', 'error');
            return;
        }
        switchView(payrollRunView);
        populatePeriodSelectors();
    });

    goToRegisteredBtn.addEventListener('click', () => {
        switchView(registeredView);
        loadRegisteredPayrolls();
    });

    backToEmployeesFromRunBtn.addEventListener('click', () => switchView(employeesView));
    backToEmployeesFromRegisteredBtn.addEventListener('click', () => switchView(employeesView));
    backToRegisteredFromDetailBtn.addEventListener('click', () => {
        switchView(registeredView);
        historicSearchInput.value = ''; // Limpiar la búsqueda al volver
    });


    // --- Eventos de Funcionalidad ---
    loadEmployeesBtn.addEventListener('click', loadEmployeesForPayrollRun);
    finalizeBtn.addEventListener('click', finalizeAndSavePayroll);
    downloadPayslipFromViewBtn.addEventListener('click', () => {
        if(historicPayrollData) {
            generatePayslip(historicPayrollData.employeeId, historicPayrollData.periodId);
        }
    });

    historicSearchInput.addEventListener('input', (e) => {
        filterHistoricEmployees(e.target.value);
    });

    // ✅ Eventos para el modal de configuración de nómina
    openPayrollSettingsBtn.addEventListener('click', () => {
        populatePayrollSettingsForm();
        payrollSettingsModal.style.display = 'flex';
        // Re-inicializar iconos por si no se cargaron antes
        if (window.lucide) {
            lucide.createIcons();
        }
    });
    closePayrollSettingsBtn.addEventListener('click', () => payrollSettingsModal.style.display = 'none');
    payrollSettingsForm.addEventListener('submit', savePayrollSettings);


    // --- Modal de Detalle (para liquidación en curso) ---
    const detailModal = document.getElementById('payroll-detail-modal');
    const closeDetailBtn = document.getElementById('payroll-detail-modal-close-btn');
    if(closeDetailBtn) closeDetailBtn.addEventListener('click', () => detailModal.style.display = 'none');
    window.addEventListener('click', (event) => {
        if (event.target == detailModal || event.target == payrollSettingsModal) {
            detailModal.style.display = 'none';
            payrollSettingsModal.style.display = 'none';
        }
    });
});

async function fetchCompanySettings() {
    try {
        const doc = await db.collection('settings').doc('company').get();
        if (doc.exists) {
            companySettings = doc.data();
        } else {
            console.log("No company settings found.");
        }
    } catch(error) {
        console.error("Error fetching company settings: ", error);
    }
}

// ✅ Carga los valores legales desde Firestore
async function fetchLegalSettings() {
    try {
        const doc = await db.collection('settings').doc('legalValues').get();
        if (doc.exists) {
            legalSettings = doc.data();
            console.log("Legal payroll settings loaded successfully.");
        } else {
            console.error("CRITICAL: 'legalValues' document not found in 'settings' collection.");
            showNotification("Error: No se encontraron los parámetros de nómina.", "error");
        }
    } catch(error) {
        console.error("Error fetching legal payroll settings: ", error);
        showNotification("Error crítico al cargar configuración de nómina.", "error");
    }
}


function populatePeriodSelectors() {
    const monthSelect = document.getElementById('payroll-month-select');
    const yearSelect = document.getElementById('payroll-year-select');
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    if (monthSelect.options.length === 0) {
        const meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
        monthSelect.innerHTML = meses.map((mes, index) => `<option value="${index}" ${index === currentMonth ? 'selected' : ''}>${mes}</option>`).join('');
    }
    
    if (yearSelect.options.length === 0) {
        for (let i = 0; i < 5; i++) {
            yearSelect.innerHTML += `<option value="${currentYear - i}">${currentYear - i}</option>`;
        }
    }
}

async function loadEmployeesForPayrollRun() {
    const container = document.getElementById('payroll-run-table-container');
    container.innerHTML = '<p>Cargando empleados activos...</p>';
    payrollResults = {}; // Limpiar resultados anteriores

    try {
        const snapshot = await db.collection('employees').where('estado', '==', 'activo').orderBy('nombre').get();
        
        if (snapshot.empty) {
            container.innerHTML = '<p>No hay empleados activos para liquidar.</p>';
            return;
        }

        const employees = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        let tableHTML = `
            <table class="payroll-table" id="payroll-run-table">
                <thead>
                    <tr>
                        <th rowspan="2">Empleado</th>
                        <th rowspan="2">Sueldo Base</th>
                        <th colspan="3" class="novedad-header">Días Novedad</th>
                        <th colspan="3" class="novedad-header">Horas Extra / Recargos</th>
                        <th rowspan="2" class="novedad-header">Comisiones / Ded.</th>
                        <th rowspan="2">Neto a Pagar</th>
                        <th rowspan="2" class="actions">Acciones</th>
                    </tr>
                    <tr class="subheader">
                        <th title="Días Trabajados">Lab.</th>
                        <th title="Días de Incapacidad">Incap.</th>
                        <th title="Días de Licencia No Remunerada">LNR</th>
                        <th title="Horas Extra Diurnas">HED</th>
                        <th title="Horas Extra Nocturnas">HEN</th>
                        <th title="Horas Recargo Festivo/Dominical">HRF</th>
                    </tr>
                </thead>
                <tbody>
        `;

        employees.forEach(emp => {
            tableHTML += `
                <tr data-employee-id="${emp.id}">
                    <td>${emp.nombre}</td>
                    <td class="currency">${formatCOP(emp.sueldo, 0)}</td>
                    <td><input type="number" class="novelty-input dias" data-field="diasTrabajados" value="30" min="0" max="30"></td>
                    <td><input type="number" class="novelty-input dias" data-field="diasIncapacidad" placeholder="0"></td>
                    <td><input type="number" class="novelty-input dias" data-field="diasLicenciaNoRemunerada" placeholder="0"></td>
                    <td><input type="number" class="novelty-input" data-field="horasExtraDiurnas" placeholder="0"></td>
                    <td><input type="number" class="novelty-input" data-field="horasExtraNocturnas" placeholder="0"></td>
                    <td><input type="number" class="novelty-input" data-field="horasRecargoFestivo" placeholder="0"></td>
                    <td>
                        <input type="number" class="novelty-input-dual" data-field="comisiones" placeholder="Comis.">
                        <input type="number" class="novelty-input-dual" data-field="otrasDeducciones" placeholder="Deduc.">
                    </td>
                    <td class="currency" data-result="netoAPagar">-</td>
                    <td class="actions">
                        <button class="btn-calculate" onclick="runSingleCalculation('${emp.id}')" title="Calcular Fila"><i data-lucide="play"></i></button>
                        <button class="btn-details" style="display: none;" onclick="showPayrollDetailsModal('${emp.id}')" title="Ver Detalle"><i data-lucide="file-text"></i></button>
                        <button class="btn-download" style="display: none;" onclick="generatePayslip('${emp.id}')" title="Descargar Colilla"><i data-lucide="download"></i></button>
                    </td>
                </tr>
            `;
        });

        tableHTML += `</tbody></table>
            <div class="payroll-run-actions" style="justify-content: space-between; align-items: center; margin-top: 1rem;">
                <button class="btn-secondary" onclick="runAllCalculations()"><i data-lucide="fast-forward"></i> Calcular Todo</button>
                <span id="all-calculated-msg" style="color: var(--success-color); display: none;">¡Todos los empleados han sido calculados!</span>
            </div>
        `;
        container.innerHTML = tableHTML;
        document.getElementById('btn-finalize-payroll').style.display = 'inline-flex';
        lucide.createIcons();
    } catch(error) {
        console.error("Error al cargar empleados para liquidación:", error);
        container.innerHTML = `<p class="negative-value">Error: ${error.message}</p>`;
    }
}

async function runSingleCalculation(employeeId) {
    const row = document.querySelector(`tr[data-employee-id="${employeeId}"]`);
    
    const employeeDoc = await db.collection('employees').doc(employeeId).get();
    if (!employeeDoc.exists) {
        showNotification("Error: No se encontró el empleado.", "error");
        return;
    }
    const employeeData = { id: employeeDoc.id, ...employeeDoc.data() };

    const diasIncapacidadInput = parseInt(row.querySelector('input[data-field="diasIncapacidad"]').value) || 0;
    const diasLicenciaInput = parseInt(row.querySelector('input[data-field="diasLicenciaNoRemunerada"]').value) || 0;
    row.querySelector('input[data-field="diasTrabajados"]').value = 30 - diasIncapacidadInput - diasLicenciaInput;

    const novelties = {
        diasTrabajados: parseInt(row.querySelector('input[data-field="diasTrabajados"]').value),
        diasIncapacidad: diasIncapacidadInput,
        diasLicenciaNoRemunerada: diasLicenciaInput,
        horasExtraDiurnas: parseInt(row.querySelector('input[data-field="horasExtraDiurnas"]').value) || 0,
        horasExtraNocturnas: parseInt(row.querySelector('input[data-field="horasExtraNocturnas"]').value) || 0,
        horasRecargoFestivo: parseInt(row.querySelector('input[data-field="horasRecargoFestivo"]').value) || 0,
        comisiones: parseFloat(row.querySelector('input[data-field="comisiones"]').value) || 0,
        otrasDeducciones: parseFloat(row.querySelector('input[data-field="otrasDeducciones"]').value) || 0
    };

    try {
        const result = calculatePayroll(employeeData, novelties, legalSettings);
        
        payrollResults[employeeId] = {
            employee: employeeData,
            result: result,
            novelties: novelties
        };

        row.querySelector('[data-result="netoAPagar"]').textContent = formatCOP(result.netoAPagar, 0);
        row.querySelector('.btn-details').style.display = 'inline-flex';
        row.querySelector('.btn-download').style.display = 'inline-flex';
        row.style.backgroundColor = 'var(--success-color-bg)';
        
        updateOverallSummary();
        lucide.createIcons();
    } catch (error) {
        showNotification(error.message, 'error');
        console.error(error);
    }
}


function runAllCalculations() {
    document.querySelectorAll('#payroll-run-table tbody tr').forEach(row => {
        const empId = row.dataset.employeeId;
        runSingleCalculation(empId);
    });
    const msg = document.getElementById('all-calculated-msg');
    if(msg) msg.style.display = 'inline';
}

function updateOverallSummary() {
    const summaryContainer = document.getElementById('payroll-summary-container');
    let totalNeto = 0, totalCosto = 0, totalProvisiones = 0, totalSeguridad = 0;

    Object.values(payrollResults).forEach(data => {
        const res = data.result;
        totalNeto += res.netoAPagar;
        totalCosto += res.costoTotalEmpresa;
        totalProvisiones += res.desglose.provisiones.total;
        totalSeguridad += res.desglose.costosEmpleador.total;
    });

    document.getElementById('summary-neto-pagar').textContent = formatCOP(totalNeto, 0);
    document.getElementById('summary-costo-empresa').textContent = formatCOP(totalCosto, 0);
    document.getElementById('summary-provisiones').textContent = formatCOP(totalProvisiones, 0);
    document.getElementById('summary-seguridad-social').textContent = formatCOP(totalSeguridad, 0);

    summaryContainer.style.display = 'block';
}

function showPayrollDetailsModal(employeeId) {
    const data = payrollResults[employeeId];
    if (!data) return;
    const { employee, result } = data;

    const modal = document.getElementById('payroll-detail-modal');
    const modalBody = document.getElementById('payroll-detail-modal-body');
    document.getElementById('payroll-detail-modal-title').innerText = `Detalle de Liquidación - ${employee.nombre}`;
    
    modalBody.innerHTML = generateDetailHTML(result);
    modal.style.display = 'flex';
}

function generateDetailHTML(result) {
    const { devengados, deducciones, provisiones, costosEmpleador, bases } = result.desglose;
    return `
        <div class="payroll-detail-grid">
            <div class="detail-section">
                <h4 class="form-section-title-small">Devengados (Total: ${formatCOP(result.totalDevengado)})</h4>
                <div class="detail-item"><span>Sueldo del Periodo (${bases.diasTrabajados} días)</span><span>${formatCOP(devengados.sueldoPeriodo)}</span></div>
                <div class="detail-item"><span>Auxilio de Transporte</span><span>${formatCOP(devengados.auxTransportePeriodo)}</span></div>
                <div class="detail-item"><span>Pago Incapacidad (${bases.diasIncapacidad} días)</span><span>${formatCOP(devengados.pagoIncapacidad)}</span></div>
                <div class="detail-item"><span>Horas Extras y Recargos</span><span>${formatCOP(devengados.valorExtrasDiurnas + devengados.valorExtrasNocturnas + devengados.valorRecargosFestivos)}</span></div>
                <div class="detail-item"><span>Comisiones</span><span>${formatCOP(devengados.comisiones)}</span></div>
            </div>

            <div class="detail-section">
                <h4 class="form-section-title-small">Deducciones (Total: ${formatCOP(result.totalDeducciones)})</h4>
                <div class="detail-item"><span>Aporte Salud (4%)</span><span>${formatCOP(deducciones.aporteSalud)}</span></div>
                <div class="detail-item"><span>Aporte Pensión (4%)</span><span>${formatCOP(deducciones.aportePension)}</span></div>
                <div class="detail-item"><span>Fondo Solidaridad Pensional</span><span>${formatCOP(deducciones.fsp)}</span></div>
                <div class="detail-item"><span>Retención en la Fuente</span><span>${formatCOP(deducciones.retencionFuente)}</span></div>
                <div class="detail-item"><span>Otras Deducciones</span><span class="negative-value">-${formatCOP(deducciones.otrasDeducciones)}</span></div>
                <div class="detail-item total"><span>NETO A PAGAR</span><span>${formatCOP(result.netoAPagar)}</span></div>
            </div>

            <div class="detail-section">
                <h4 class="form-section-title-small">Seguridad Social y Parafiscales</h4>
                <div class="detail-item"><span>Salud Empresa (8.5% o 0%)</span><span>${formatCOP(costosEmpleador.saludEmpresa)}</span></div>
                <div class="detail-item"><span>Pensión Empresa (12%)</span><span>${formatCOP(costosEmpleador.pensionEmpresa)}</span></div>
                <div class="detail-item"><span>ARL</span><span>${formatCOP(costosEmpleador.arl)}</span></div>
                <div class="detail-item"><span>Caja de Compensación (4%)</span><span>${formatCOP(costosEmpleador.cajaCompensacion)}</span></div>
                <div class="detail-item"><span>ICBF (3% o 0%)</span><span>${formatCOP(costosEmpleador.icbf)}</span></div>
                <div class="detail-item"><span>SENA (2% o 0%)</span><span>${formatCOP(costosEmpleador.sena)}</span></div>
            </div>

            <div class="detail-section">
                <h4 class="form-section-title-small">Provisiones de Prestaciones</h4>
                <div class="detail-item"><span>Cesantías (8.33%)</span><span>${formatCOP(provisiones.provisionCesantias)}</span></div>
                <div class="detail-item"><span>Intereses a las Cesantías (1%)</span><span>${formatCOP(provisiones.provisionInteresesCesantias)}</span></div>
                <div class="detail-item"><span>Prima de Servicios (8.33%)</span><span>${formatCOP(provisiones.provisionPrima)}</span></div>
                <div class="detail-item"><span>Vacaciones (4.17%)</span><span>${formatCOP(provisiones.provisionVacaciones)}</span></div>
                <div class="detail-item total"><span>COSTO TOTAL EMPRESA</span><span>${formatCOP(result.costoTotalEmpresa)}</span></div>
            </div>
        </div>
        <div class="detail-section bases-info">
            <h4 class="form-section-title-small">Bases de Cálculo</h4>
            <span><strong>IBC:</strong> ${formatCOP(bases.ibc)}</span> | 
            <span><strong>Base Prestaciones:</strong> ${formatCOP(bases.basePrestaciones)}</span> | 
            <span><strong>Base Vacaciones:</strong> ${formatCOP(bases.baseVacaciones)}</span>
        </div>
    `;
}

async function finalizeAndSavePayroll() {
    if (Object.keys(payrollResults).length === 0) {
        showNotification("No hay datos calculados para guardar.", "warning");
        return;
    }

    const year = document.getElementById('payroll-year-select').value;
    const monthValue = document.getElementById('payroll-month-select').value;
    const monthName = document.getElementById('payroll-month-select').options[monthValue].text;
    const periodId = `${year}-${String(parseInt(monthValue) + 1).padStart(2, '0')}`;

    if (!confirm(`¿Deseas finalizar y guardar la liquidación para ${monthName} de ${year}? Esta acción no se puede deshacer.`)) {
        return;
    }

    const payrollData = {
        period: {
            year: parseInt(year),
            month: parseInt(monthValue),
            name: `${monthName} ${year}`
        },
        createdAt: new Date(),
        results: payrollResults,
        summary: {
            totalNeto: Object.values(payrollResults).reduce((acc, curr) => acc + curr.result.netoAPagar, 0),
            totalCosto: Object.values(payrollResults).reduce((acc, curr) => acc + curr.result.costoTotalEmpresa, 0),
        }
    };
    
    try {
        const payrollDocRef = db.collection('payrolls').doc(periodId);
        await payrollDocRef.set(payrollData);
        showNotification(`Nómina de ${monthName} ${year} guardada exitosamente.`, 'success');
        
    } catch(error) {
        console.error("Error al guardar la nómina: ", error);
        showNotification("Error al guardar la nómina.", "error");
    }
}

async function generatePayslip(employeeId, periodId = null) {
    let data;
    let periodName;

    if (periodId) {
        const payrollDoc = await db.collection('payrolls').doc(periodId).get();
        if (!payrollDoc.exists) return;
        const payrollData = payrollDoc.data();
        data = payrollData.results[employeeId];
        periodName = payrollData.period.name;
    } else {
        data = payrollResults[employeeId];
        periodName = document.getElementById('payroll-month-select').options[document.getElementById('payroll-month-select').value].text + ' ' + document.getElementById('payroll-year-select').value;
    }

    if (!data) {
        showNotification("No se encontraron datos para generar la colilla.", "error");
        return;
    }

    const { employee, result } = data;
    const { devengados, deducciones, bases } = result.desglose;

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(companySettings.myCompanyName || 'Mi Empresa', 15, 20);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`NIT: ${companySettings.myCompanyNit || 'N/A'}`, 15, 26);
    doc.text('COMPROBANTE DE PAGO DE NÓMINA', 105, 35, { align: 'center' });
    
    doc.autoTable({
        startY: 40,
        body: [
            ['PERIODO LIQUIDADO:', periodName, 'EMPLEADO:', employee.nombre],
            ['FECHA DE CONTRATACIÓN:', employee.fechaContratacion, 'DOCUMENTO:', employee.documento],
            ['SALARIO BASE:', formatCOP(employee.sueldo, 0), 'CARGO:', employee.contractType ? employee.contractType.replace(/_/g, ' ') : 'No especificado'],
            ['DÍAS LIQUIDADOS:', bases.diasLiquidar, 'DÍAS INCAPACIDAD:', bases.diasIncapacidad],
        ],
        theme: 'plain', styles: { fontSize: 9, cellPadding: 1 }, columnStyles: { 0: { fontStyle: 'bold' }, 2: { fontStyle: 'bold' } }
    });

    const devengadosData = [['Sueldo del Periodo', formatCOP(devengados.sueldoPeriodo)], ['Auxilio de Transporte', formatCOP(devengados.auxTransportePeriodo)], ['Pago Incapacidad', formatCOP(devengados.pagoIncapacidad)], ['Horas Extras y Recargos', formatCOP(devengados.valorExtrasDiurnas + devengados.valorExtrasNocturnas + devengados.valorRecargosFestivos)], ['Comisiones / Bonos', formatCOP(devengados.comisiones)]].filter(item => parseFloat(item[1].replace(/[^0-9,-]+/g,"")) !== 0);
    const deduccionesData = [['Aporte Salud (4%)', formatCOP(deducciones.aporteSalud)], ['Aporte Pensión (4%)', formatCOP(deducciones.aportePension)], ['Fondo Solidaridad Pensional', formatCOP(deducciones.fsp)], ['Retención en la Fuente', formatCOP(deducciones.retencionFuente)], ['Otras Deducciones', formatCOP(deducciones.otrasDeducciones)]].filter(item => parseFloat(item[1].replace(/[^0-9,-]+/g,"")) !== 0);

    doc.autoTable({
        startY: doc.lastAutoTable.finalY + 5,
        head: [['DEVENGADOS', 'VALOR'], ['DEDUCCIONES', 'VALOR']],
        body: devengadosData.map((d, i) => [d[0], d[1], deduccionesData[i]?.[0] || '', deduccionesData[i]?.[1] || '']),
        theme: 'grid', headStyles: { fillColor: [220, 220, 220], textColor: 40, fontStyle: 'bold' }, columnStyles: { 1: { halign: 'right' }, 3: { halign: 'right' } }
    });

    doc.autoTable({
        startY: doc.lastAutoTable.finalY,
        body: [['TOTAL DEVENGADO:', formatCOP(result.totalDevengado), 'TOTAL DEDUCCIONES:', formatCOP(result.totalDeducciones)]],
        theme: 'grid', styles: { fontStyle: 'bold' }, columnStyles: { 1: { halign: 'right' }, 3: { halign: 'right' } }
    });

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('NETO A PAGAR:', 15, doc.lastAutoTable.finalY + 15);
    doc.text(formatCOP(result.netoAPagar), 200, doc.lastAutoTable.finalY + 15, { align: 'right' });

    doc.setLineWidth(0.5);
    doc.line(15, doc.internal.pageSize.height - 40, 85, doc.internal.pageSize.height - 40);
    doc.text('Firma Empleador', 50, doc.internal.pageSize.height - 35, { align: 'center' });
    doc.line(125, doc.internal.pageSize.height - 40, 195, doc.internal.pageSize.height - 40);
    doc.text('Firma Empleado', 160, doc.internal.pageSize.height - 35, { align: 'center' });

    doc.save(`Colilla_${employee.nombre.replace(/ /g, '_')}_${periodName.replace(/ /g, '_')}.pdf`);
}


// --- ✅ Funciones para la Vista de Historial ---

async function loadRegisteredPayrolls() {
    const listContainer = document.getElementById('periods-list');
    listContainer.innerHTML = `<p>Cargando períodos...</p>`;
    currentHistoricPayroll = null;
    document.getElementById('period-employees-list').innerHTML = `<p>Selecciona un período para ver los detalles.</p>`;
    document.getElementById('historic-search-input').value = '';

    try {
        const snapshot = await db.collection('payrolls').orderBy('createdAt', 'desc').get();
        if (snapshot.empty) {
            listContainer.innerHTML = `<p>No hay liquidaciones guardadas.</p>`;
            return;
        }
        
        let html = '';
        snapshot.forEach(doc => {
            const payroll = doc.data();
            html += `<div class="period-item" onclick="loadEmployeesForPeriod('${doc.id}')" id="period-${doc.id}">
                        <span>${payroll.period.name}</span>
                        <i data-lucide="chevron-right"></i>
                     </div>`;
        });
        listContainer.innerHTML = html;
        lucide.createIcons();

    } catch (error) {
        console.error("Error cargando liquidaciones registradas:", error);
        listContainer.innerHTML = `<p class="negative-value">Error al cargar el historial.</p>`;
    }
}

async function loadEmployeesForPeriod(periodId) {
    document.querySelectorAll('#periods-list .period-item').forEach(item => item.classList.remove('active'));
    document.getElementById(`period-${periodId}`).classList.add('active');
    document.getElementById('historic-search-input').value = '';

    const employeesContainer = document.getElementById('period-employees-list');
    employeesContainer.innerHTML = `<p>Cargando empleados...</p>`;
    document.getElementById('period-employees-title').innerText = `Empleados Liquidados`;

    try {
        const doc = await db.collection('payrolls').doc(periodId).get();
        if (!doc.exists) {
            employeesContainer.innerHTML = `<p>No se encontró el período.</p>`;
            return;
        }
        currentHistoricPayroll = doc.data();
        currentHistoricPayroll.id = doc.id; 

        document.getElementById('period-employees-title').innerText = `Empleados en ${currentHistoricPayroll.period.name}`;
        renderHistoricEmployees(currentHistoricPayroll.results);

    } catch (error) {
        console.error("Error cargando empleados del período:", error);
        employeesContainer.innerHTML = `<p class="negative-value">Error al cargar los empleados.</p>`;
    }
}

function renderHistoricEmployees(results) {
    const employeesContainer = document.getElementById('period-employees-list');
    const periodId = currentHistoricPayroll.id;

    if (!results || Object.keys(results).length === 0) {
        employeesContainer.innerHTML = `<p>No se encontraron empleados para el criterio de búsqueda.</p>`;
        return;
    }
    
    let html = '';
    for (const employeeId in results) {
        const data = results[employeeId];
        html += `<div class="employee-item" onclick="showHistoricLiquidationDetail('${employeeId}', '${periodId}')">
                    <div class="employee-info">
                        <span class="employee-name">${data.employee.nombre}</span>
                        <span class="employee-doc">CC: ${data.employee.documento}</span>
                    </div>
                    <span class="employee-net-pay">${formatCOP(data.result.netoAPagar, 0)}</span>
                 </div>`;
    }
    employeesContainer.innerHTML = html;
}

function filterHistoricEmployees(searchTerm) {
    if (!currentHistoricPayroll) return;

    const lowerCaseSearchTerm = searchTerm.toLowerCase();
    const allResults = currentHistoricPayroll.results;
    
    const filteredResults = Object.keys(allResults).reduce((acc, key) => {
        const employee = allResults[key].employee;
        if (employee.nombre.toLowerCase().includes(lowerCaseSearchTerm) || employee.documento.includes(lowerCaseSearchTerm)) {
            acc[key] = allResults[key];
        }
        return acc;
    }, {});

    renderHistoricEmployees(filteredResults);
}

async function showHistoricLiquidationDetail(employeeId, periodId) {
    const detailView = document.getElementById('liquidation-detail-view');
    const contentContainer = document.getElementById('liquidation-detail-content');
    contentContainer.innerHTML = `<p>Cargando detalle...</p>`;
    
    document.getElementById('employees-view').style.display = 'none';
    document.getElementById('payroll-run-view').style.display = 'none';
    document.getElementById('registered-liquidations-view').style.display = 'none';
    detailView.style.display = 'block';

    try {
        const doc = await db.collection('payrolls').doc(periodId).get();
        if (!doc.exists) {
            contentContainer.innerHTML = `<p>Error: No se encontró la liquidación.</p>`;
            return;
        }
        const payrollData = doc.data();
        const data = payrollData.results[employeeId];

        historicPayrollData = { employeeId, periodId };

        document.getElementById('detail-view-title').innerText = `Detalle de ${data.employee.nombre}`;
        document.getElementById('detail-view-subtitle').innerText = `Período: ${payrollData.period.name}`;

        contentContainer.innerHTML = generateDetailHTML(data.result);

    } catch (error) {
        console.error("Error al mostrar detalle histórico:", error);
        contentContainer.innerHTML = `<p class="negative-value">No se pudo cargar el detalle.</p>`;
    }
}

// ✅ Lógica para la configuración de nómina
function populatePayrollSettingsForm() {
    if (legalSettings) {
        document.getElementById('setting-smlmv').value = legalSettings.SMLMV || '';
        document.getElementById('setting-aux-transporte').value = legalSettings.AUX_TRANSPORTE || '';
        document.getElementById('setting-uvt').value = legalSettings.UVT || '';
        document.getElementById('setting-salud-empleado').value = (legalSettings.SALUD_EMPLEADO || 0) * 100;
        document.getElementById('setting-pension-empleado').value = (legalSettings.PENSION_EMPLEADO || 0) * 100;
        document.getElementById('setting-pension-empresa').value = (legalSettings.PENSION_EMPRESA || 0) * 100;
        document.getElementById('setting-caja-compensacion').value = (legalSettings.CAJA_COMPENSACION || 0) * 100;
        document.getElementById('setting-icbf').value = (legalSettings.ICBF || 0) * 100;
        document.getElementById('setting-sena').value = (legalSettings.SENA || 0) * 100;
    }
}

// ✅ FUNCIÓN MODIFICADA: Ahora muestra un diálogo de confirmación antes de guardar.
async function savePayrollSettings(e) {
    e.preventDefault();

    // Usar la función de confirmación
    const isConfirmed = await showConfirmation({
        title: 'Confirmación de Responsabilidad',
        message: 'Estás a punto de modificar los valores legales que afectan todos los cálculos de nómina. Es tu responsabilidad asegurar que estos valores cumplen con la normativa vigente. ¿Deseas continuar?',
        confirmText: 'Sí, entiendo y confirmo',
        cancelText: 'Cancelar'
    });

    if (!isConfirmed) {
        showNotification('Cambios cancelados por el usuario.', 'info');
        return;
    }

    // Si el usuario confirma, proceder a guardar
    const newSettings = {
        SMLMV: parseFloat(document.getElementById('setting-smlmv').value),
        AUX_TRANSPORTE: parseFloat(document.getElementById('setting-aux-transporte').value),
        UVT: parseFloat(document.getElementById('setting-uvt').value),
        SALUD_EMPLEADO: parseFloat(document.getElementById('setting-salud-empleado').value) / 100,
        PENSION_EMPLEADO: parseFloat(document.getElementById('setting-pension-empleado').value) / 100,
        PENSION_EMPRESA: parseFloat(document.getElementById('setting-pension-empresa').value) / 100,
        CAJA_COMPENSACION: parseFloat(document.getElementById('setting-caja-compensacion').value) / 100,
        ICBF: parseFloat(document.getElementById('setting-icbf').value) / 100,
        SENA: parseFloat(document.getElementById('setting-sena').value) / 100,
        // Mantener los valores que no están en el formulario para no borrarlos
        FACTOR_EXTRA_DIURNA: legalSettings.FACTOR_EXTRA_DIURNA,
        FACTOR_EXTRA_NOCTURNA: legalSettings.FACTOR_EXTRA_NOCTURNA,
        FACTOR_RECARGO_DOMINICAL_FESTIVO: legalSettings.FACTOR_RECARGO_DOMINICAL_FESTIVO,
        CESANTIAS: legalSettings.CESANTIAS,
        INTERESES_CESANTIAS: legalSettings.INTERESES_CESANTIAS,
        PRIMA: legalSettings.PRIMA,
        VACACIONES: legalSettings.VACACIONES,
    };

    try {
        await db.collection('settings').doc('legalValues').set(newSettings, { merge: true }); // Usar merge para no borrar campos no presentes
        legalSettings = {...legalSettings, ...newSettings}; // Actualizar localmente
        showNotification('Configuración de nómina actualizada con éxito.', 'success');
        document.getElementById('payroll-settings-modal').style.display = 'none';
    } catch (error) {
        console.error("Error guardando configuración de nómina:", error);
        showNotification('Error al guardar la configuración.', 'error');
    }
}


function formatCOP(value, digits = 0) {
    if (typeof value !== 'number' || isNaN(value)) return '$0';
    return new Intl.NumberFormat('es-CO', { 
        style: 'currency', 
        currency: 'COP', 
        minimumFractionDigits: digits,
        maximumFractionDigits: digits
    }).format(value);
}