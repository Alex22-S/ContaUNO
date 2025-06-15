document.addEventListener('DOMContentLoaded', () => {
    // --- LÓGICA PARA CERRAR EL MODAL DE DETALLES ---
    const modal = document.getElementById('cashflow-details-modal');
    const closeBtn = document.getElementById('modal-cashflow-close-btn');

    if (modal && closeBtn) {
        const closeModal = () => modal.style.display = 'none';
        closeBtn.onclick = closeModal;
        window.onclick = (event) => {
            if (event.target == modal) {
                closeModal();
            }
        };
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && modal.style.display === 'block') {
                closeModal();
            }
        });
    }
});


let cashflowEvolutionChart = null;

async function getTransactionsForCashflow() {
    try {
        const savedTransactions = localStorage.getItem('contauno_transactions');
        return savedTransactions ? Object.values(JSON.parse(savedTransactions)).flat() : [];
    } catch (error) {
        console.error("Error al obtener las transacciones para Flujo de Caja:", error);
        return [];
    }
}

async function updateCashflowView() {
    const yearSelect = document.getElementById('cashflow-year-select');
    const monthSelect = document.getElementById('cashflow-month-select');
    if (!yearSelect || !monthSelect || !yearSelect.value) return;

    const year = parseInt(yearSelect.value);
    const month = parseInt(monthSelect.value);

    const allTransactions = await getTransactionsForCashflow();

    const initialBalance = calculateInitialBalance(year, month, allTransactions);
    document.getElementById('cf-initial-balance').textContent = formatCurrency(initialBalance);
    
    const currentMonthTransactions = allTransactions.filter(t => {
        const tDate = new Date(t.date);
        return tDate.getUTCFullYear() === year && tDate.getUTCMonth() === month;
    });

    const { opActivities, invActivities, finActivities, totalInflows, totalOutflows } = classifyCashflowActivities(currentMonthTransactions);

    const netFlow = totalInflows - totalOutflows;
    const finalBalance = initialBalance + netFlow;

    document.getElementById('cf-total-inflows').textContent = formatCurrency(totalInflows);
    document.getElementById('cf-total-outflows').textContent = formatCurrency(totalOutflows);
    document.getElementById('cf-net-flow').textContent = formatCurrency(netFlow);
    document.getElementById('cf-final-balance').textContent = formatCurrency(finalBalance);

    renderActivitySection('operation-activities', opActivities, 'operation-total');
    renderActivitySection('investment-activities', invActivities, 'investment-total');
    renderActivitySection('financing-activities', finActivities, 'financing-total');

    updateCashflowChart(year, month, initialBalance, currentMonthTransactions);
}

function calculateInitialBalance(year, month, allTransactions) {
    const startDate = new Date(Date.UTC(year, month, 1));
    return allTransactions.reduce((balance, t) => {
        const tDate = new Date(t.date);
        if (tDate < startDate) {
            balance += (t.type === 'income' ? parseFloat(t.amount) : -parseFloat(t.amount));
        }
        return balance;
    }, 0);
}

/**
 * MODIFICADO: Ahora guarda el objeto de transacción completo para el drill-down.
 */
function classifyCashflowActivities(transactions) {
    const opActivities = [], invActivities = [], finActivities = [];
    let totalInflows = 0, totalOutflows = 0;

    transactions.forEach(t => {
        const amount = parseFloat(t.amount);
        const transactionValue = t.type === 'income' ? amount : -amount;
        const categoryName = t.category || 'Sin Categoría';
        
        totalInflows += (t.type === 'income' ? amount : 0);
        totalOutflows += (t.type === 'expense' ? amount : 0);

        const activityDetail = { transaction: t, value: transactionValue };

        if (/(pr[ée]stamo|cr[ée]dito|financiaci[oó]n|capital|socios)/i.test(categoryName)) {
            finActivities.push(activityDetail);
        } else if (/(activo|inversi[oó]n|equipo|maquinaria|propiedad|compra de inventario)/i.test(categoryName)) {
            invActivities.push(activityDetail);
        } else {
            opActivities.push(activityDetail);
        }
    });

    return { opActivities, invActivities, finActivities, totalInflows, totalOutflows };
}


/**
 * MODIFICADO: Agrupa por categoría y hace las filas "clicables" para mostrar detalles.
 */
function renderActivitySection(containerId, activities, totalElementId) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    
    const sectionTotal = activities.reduce((sum, act) => sum + act.value, 0);

    if (activities.length === 0) {
        container.innerHTML = '<p class="no-activity">No hay actividades de este tipo en el periodo.</p>';
        document.getElementById(totalElementId).textContent = formatCurrency(0);
        return;
    }

    const groupedActivities = activities.reduce((acc, activity) => {
        const key = activity.transaction.category || 'Sin Categoría';
        if (!acc[key]) {
            acc[key] = 0;
        }
        acc[key] += activity.value;
        return acc;
    }, {});
    
    const sortedGroupedActivities = Object.entries(groupedActivities)
        .sort(([, amountA], [, amountB]) => Math.abs(amountB) - Math.abs(amountA));

    sortedGroupedActivities.forEach(([categoryName, totalValue]) => {
        const row = document.createElement('div');
        row.className = 'activity-row';
        row.innerHTML = `
            <span class="activity-label">${categoryName}</span>
            <span class="activity-value ${totalValue >= 0 ? 'positive-value' : 'negative-value'}">${formatCurrency(totalValue)}</span>
        `;
        // Hacemos la fila clicable
        row.onclick = () => openCashflowDetailsModal(categoryName, activities);
        container.appendChild(row);
    });
    
    const totalElement = document.getElementById(totalElementId);
    totalElement.textContent = formatCurrency(sectionTotal);
    totalElement.className = `section-total ${sectionTotal >= 0 ? 'positive-value' : 'negative-value'}`;
}

/**
 * NUEVA FUNCIÓN: Abre el modal con los detalles de la categoría seleccionada.
 */
function openCashflowDetailsModal(categoryName, allSectionActivities) {
    const modal = document.getElementById('cashflow-details-modal');
    const titleEl = document.getElementById('modal-cashflow-category-title');
    const tableBody = document.getElementById('modal-cashflow-table-body');
    const finalTotalEl = document.getElementById('modal-cashflow-final-total');

    const transactionsToShow = allSectionActivities.filter(act => (act.transaction.category || 'Sin Categoría') === categoryName);

    titleEl.textContent = `Detalle de: ${categoryName}`;
    tableBody.innerHTML = '';

    let categoryTotal = 0;
    if (transactionsToShow.length > 0) {
        transactionsToShow.sort((a, b) => new Date(a.transaction.date) - new Date(b.transaction.date));
        
        transactionsToShow.forEach(act => {
            const t = act.transaction;
            categoryTotal += act.value;
            const isIncome = t.type === 'income';
            const row = tableBody.insertRow();
            row.innerHTML = `
                <td>${new Date(t.date).toLocaleDateString('es-CO', {timeZone: 'UTC'})}</td>
                <td>${t.description || 'N/A'}</td>
                <td style="text-align: right;" class="${isIncome ? 'positive-value' : 'negative-value'}">${isIncome ? 'Ingreso' : 'Gasto'}</td>
                <td style="text-align: right;" class="${isIncome ? 'positive-value' : 'negative-value'}">${formatCurrency(act.value)}</td>
            `;
        });
    } else {
        tableBody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 2rem;">No hay transacciones para mostrar.</td></tr>';
    }

    finalTotalEl.textContent = formatCurrency(categoryTotal);
    finalTotalEl.className = categoryTotal >= 0 ? 'positive-value' : 'negative-value';
    
    modal.style.display = 'flex';
}


function updateCashflowChart(year, month, initialBalance, transactions) {
    const ctx = document.getElementById('cashflow-evolution-chart')?.getContext('2d');
    if (!ctx) return;
    
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const labels = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    const dailyFlows = new Array(daysInMonth).fill(0);

    transactions.forEach(t => {
        const day = new Date(t.date).getUTCDate() - 1;
        dailyFlows[day] += (t.type === 'income' ? parseFloat(t.amount) : -parseFloat(t.amount));
    });

    let cumulativeBalance = initialBalance;
    const cumulativeData = dailyFlows.map(flow => cumulativeBalance += flow);
    
    const chartLabels = ["Inicio", ...labels];
    const chartData = [initialBalance, ...cumulativeData];

    if (cashflowEvolutionChart) cashflowEvolutionChart.destroy();

    cashflowEvolutionChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: chartLabels,
            datasets: [{
                label: 'Saldo de Efectivo',
                data: chartData,
                borderColor: '#0d6efd',
                backgroundColor: 'rgba(13, 110, 253, 0.1)',
                fill: true,
                tension: 0.2,
                pointBackgroundColor: '#0d6efd',
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { ticks: { callback: value => formatCurrency(value), color: getChartFontColor() } },
                x: { ticks: { color: getChartFontColor() } }
            },
            plugins: {
                legend: { display: false },
                tooltip: { 
                    callbacks: { 
                        label: context => `Saldo: ${formatCurrency(context.raw)}` 
                    } 
                },
                datalabels: { display: false }
            }
        }
    });
}

function populateYearSelector(selectId, defaultValueCallback) {
    const select = document.getElementById(selectId);
    if (!select) return;
    select.innerHTML = '';
    const currentYear = new Date().getFullYear();
    for (let i = currentYear + 1; i >= 2020; i--) {
        select.add(new Option(i, i));
    }
    if (defaultValueCallback) {
        select.value = defaultValueCallback();
    }
}

function populateMonthSelector(selectId, defaultValueCallback) {
    const select = document.getElementById(selectId);
    if (!select) return;
    select.innerHTML = '';
    const months = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    months.forEach((month, index) => select.add(new Option(month, index)));
    if (defaultValueCallback) {
        select.value = defaultValueCallback();
    }
}

function getChartFontColor() {
    return document.body.classList.contains('light-mode') ? '#333' : '#ddd';
}

function formatCurrency(value) {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0
    }).format(value);
}