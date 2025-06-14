// ===================================================================
// =================== LÓGICA VISTA DE BALANCE =======================
// ===================================================================

let periodChartInstance = null;
let barChartInstance = null;
const MONTH_NAMES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const FULL_MONTH_NAMES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];


function populateBalanceSelectors() {
    const monthSelect = document.getElementById('balance-month-select');
    const yearSelect = document.getElementById('balance-year-select');
    
    if (monthSelect.options.length > 1) return;

    FULL_MONTH_NAMES.forEach((month, index) => {
        monthSelect.innerHTML += `<option value="${index}">${month}</option>`;
    });

    const currentYear = new Date().getFullYear();
    for (let year = currentYear + 1; year >= 2020; year--) {
        yearSelect.innerHTML += `<option value="${year}">${year}</option>`;
    }

    const now = new Date();
    monthSelect.value = now.getMonth();
    yearSelect.value = now.getFullYear();
}

function switchBalanceView(viewToShow) {
    const monthSelect = document.getElementById('balance-month-select');
    const yearSelect = document.getElementById('balance-year-select');

    if (viewToShow === 'weekly') {
        monthSelect.style.display = 'inline-block';
        yearSelect.style.display = 'inline-block';
    } else if (viewToShow === 'monthly') {
        monthSelect.style.display = 'none';
        yearSelect.style.display = 'inline-block';
    } else if (viewToShow === 'annual') {
        monthSelect.style.display = 'none';
        yearSelect.style.display = 'none';
    }

    document.querySelectorAll('.balance-view-toggle button').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`btn-${viewToShow}-view`).classList.add('active');
    
    updateBalanceView(); 
}

async function updateBalanceView() {
    const month = parseInt(document.getElementById('balance-month-select').value);
    const year = parseInt(document.getElementById('balance-year-select').value);
    const activeView = document.querySelector('.balance-view-toggle button.active').id.split('-')[1];

    const allTransactions = await getTransactionsForBalance();
    
    if (activeView === 'weekly') {
        renderWeeklyView(allTransactions, month, year);
    } else if (activeView === 'monthly') {
        renderMonthlyView(allTransactions, year);
    } else if (activeView === 'annual') {
        renderAnnualView(allTransactions);
    }
}

// ======================= RENDERIZADO DE VISTAS ========================

function renderWeeklyView(allTransactions, month, year) {
    const periodTitleEl = document.getElementById('summary-period-title');
    periodTitleEl.textContent = `Resumen Total de ${FULL_MONTH_NAMES[month]} ${year}`;

    const monthlyTransactions = allTransactions.filter(t => {
        const transactionDate = new Date(t.date); 
        return transactionDate.getUTCMonth() === month && transactionDate.getUTCFullYear() === year;
    });

    const summary = calculateSummary(monthlyTransactions);
    updatePeriodSummaryCards(summary);

    const weeklyData = groupTransactionsByWeek(monthlyTransactions, month, year);
    const container = document.getElementById('balance-breakdown-container');
    container.innerHTML = '';
    
    if (weeklyData.every(w => w.transactions.length === 0)) {
        container.innerHTML = '<p class="no-data-msg" style="text-align: center; color: var(--text-secondary); padding: 2rem;">No hay transacciones este mes.</p>';
    } else {
        weeklyData.forEach((week, index) => {
            container.innerHTML += createWeekCardHTML(week, index + 1, month, year);
        });
    }
    
    renderPeriodDoughnutChart(summary);
    renderBarChart(weeklyData.map(w => `Semana ${w.weekNumber}`), weeklyData.map(w => w.summary.income), weeklyData.map(w => w.summary.expense), 'Balance Semanal');
    setupActionButtons(summary, monthlyTransactions, month, year, 'weekly');
}

function renderMonthlyView(allTransactions, year) {
    document.getElementById('summary-period-title').textContent = `Resumen Total del Año ${year}`;

    const yearlyTransactions = allTransactions.filter(t => new Date(t.date).getUTCFullYear() === year);
    const summary = calculateSummary(yearlyTransactions);
    updatePeriodSummaryCards(summary);
    
    const monthlyData = groupTransactionsByMonth(yearlyTransactions, year);
    const container = document.getElementById('balance-breakdown-container');
    container.innerHTML = '';
    
    if (monthlyData.every(m => m.transactions.length === 0)) {
        container.innerHTML = `<p class="no-data-msg" style="text-align: center; color: var(--text-secondary); padding: 2rem;">No hay transacciones en ${year}.</p>`;
    } else {
        monthlyData.forEach(monthData => {
            container.innerHTML += createMonthCardHTML(monthData);
        });
    }

    renderPeriodDoughnutChart(summary);
    renderBarChart(MONTH_NAMES, monthlyData.map(m => m.summary.income), monthlyData.map(m => m.summary.expense), 'Balance Mensual');
    setupActionButtons(summary, yearlyTransactions, null, year, 'monthly');
}

function renderAnnualView(allTransactions) {
    document.getElementById('summary-period-title').textContent = `Resumen Histórico Global`;
    
    const summary = calculateSummary(allTransactions);
    updatePeriodSummaryCards(summary);

    const annualData = groupTransactionsByYear(allTransactions);
    const container = document.getElementById('balance-breakdown-container');
    container.innerHTML = '';

    if (annualData.length === 0) {
        container.innerHTML = '<p class="no-data-msg" style="text-align: center; color: var(--text-secondary); padding: 2rem;">No hay transacciones registradas.</p>';
    } else {
        annualData.forEach(yearData => {
            container.innerHTML += createYearCardHTML(yearData);
        });
    }
    
    renderPeriodDoughnutChart(summary);
    const sortedYears = annualData.sort((a,b) => a.year - b.year);
    renderBarChart(sortedYears.map(y => y.year), sortedYears.map(y => y.summary.income), sortedYears.map(y => y.summary.expense), 'Balance Anual');
    setupActionButtons(summary, allTransactions, null, null, 'annual');
}

// ======================= AGRUPACIÓN DE DATOS ========================

function groupTransactionsByWeek(transactions, month, year) {
    const weeks = [];
    const firstDayOfMonth = new Date(Date.UTC(year, month, 1));
    const lastDayOfMonth = new Date(Date.UTC(year, month + 1, 0));
    let weekStart = new Date(firstDayOfMonth);
    weekStart.setUTCDate(weekStart.getUTCDate() - (weekStart.getUTCDay() === 0 ? 6 : weekStart.getUTCDay() - 1));
    
    let weekCounter = 1;
    while (weekStart <= lastDayOfMonth) {
        const weekEnd = new Date(weekStart);
        weekEnd.setUTCDate(weekStart.getUTCDate() + 6);
        const weekTransactions = transactions.filter(t => {
            const tDate = new Date(t.date);
            return tDate >= weekStart && tDate <= weekEnd;
        });
        
        if (weekEnd >= firstDayOfMonth && weekStart <= lastDayOfMonth) {
             weeks.push({ 
                startDate: new Date(weekStart), 
                endDate: new Date(weekEnd), 
                transactions: weekTransactions, 
                summary: calculateSummary(weekTransactions),
                weekNumber: weekCounter
            });
        }
        weekCounter++;
        weekStart.setUTCDate(weekStart.getUTCDate() + 7);
    }
    return weeks;
}

function groupTransactionsByMonth(transactions, year) {
    const months = Array.from({ length: 12 }, (v, i) => ({
        monthIndex: i, year: year, transactions: [],
        summary: { income: 0, expense: 0, balance: 0 }
    }));
    transactions.forEach(t => {
        const date = new Date(t.date);
        if (date.getUTCFullYear() === year) {
            months[date.getUTCMonth()].transactions.push(t);
        }
    });
    months.forEach(month => { month.summary = calculateSummary(month.transactions); });
    return months;
}

function groupTransactionsByYear(transactions) {
    const years = {};
    transactions.forEach(t => {
        const year = new Date(t.date).getUTCFullYear();
        if (!years[year]) years[year] = { transactions: [], year: year };
        years[year].transactions.push(t);
    });

    return Object.values(years).map(yearData => ({
        ...yearData, summary: calculateSummary(yearData.transactions)
    })).sort((a,b) => b.year - a.year);
}


// ======================= CREACIÓN DE HTML DINÁMICO ========================

function createWeekCardHTML(weekData, weekNumber, month, year) {
    const { startDate, endDate, summary, transactions } = weekData;
    const firstDayOfMonth = new Date(Date.UTC(year, month, 1));
    const lastDayOfMonth = new Date(Date.UTC(year, month + 1, 0));
    const displayStartDate = new Date(Math.max(startDate, firstDayOfMonth));
    const displayEndDate = new Date(Math.min(endDate, lastDayOfMonth));
    const formatDate = (date) => `${date.getUTCDate().toString().padStart(2, '0')} ${date.toLocaleString('es-CO', { month: 'short', timeZone: 'UTC' })}`;
    let dateLabel = '';
    if (displayStartDate.getTime() > displayEndDate.getTime()) return '';
    dateLabel = displayStartDate.getUTCDate() === displayEndDate.getUTCDate() ? `(${formatDate(displayStartDate)})` : `(${formatDate(displayStartDate)} - ${formatDate(displayEndDate)})`;
    const transactionCount = transactions.length;
    
    return `
        <div class="week-card">
            <div class="week-card-header">
                <h4>Semana ${weekNumber} <span class="week-card-date">${dateLabel}</span></h4>
                <div class="week-card-pills"><span class="week-tx-count">${transactionCount} ${transactionCount === 1 ? 'Transacción' : 'Transacciones'}</span></div>
            </div>
            <div class="week-card-body">
                <div class="week-stat"><span class="label">Ingresos</span><span class="value positive">${formatCurrency(summary.income)}</span></div>
                <div class="week-stat"><span class="label">Gastos</span><span class="value negative">${formatCurrency(summary.expense)}</span></div>
                <div class="week-stat"><span class="label">Balance</span><span class="value ${summary.balance >= 0 ? 'positive' : 'negative'}">${formatCurrency(summary.balance)}</span></div>
                <button class="view-details-btn" data-type="week" data-start-date="${startDate.toISOString()}" data-end-date="${endDate.toISOString()}" ${transactionCount === 0 ? 'disabled' : ''}>Ver Detalles</button>
            </div>
        </div>`;
}

function createMonthCardHTML(monthData) {
    const { monthIndex, year, summary, transactions } = monthData;
    const transactionCount = transactions.length;
    
    return `
        <div class="month-card">
            <div class="month-card-header">
                <h4>${FULL_MONTH_NAMES[monthIndex]} ${year}</h4>
                <div class="month-card-pills"><span class="month-tx-count">${transactionCount} ${transactionCount === 1 ? 'Transacción' : 'Transacciones'}</span></div>
            </div>
            <div class="month-card-body">
                <div class="month-stat"><span class="label">Ingresos</span><span class="value positive">${formatCurrency(summary.income)}</span></div>
                <div class="month-stat"><span class="label">Gastos</span><span class="value negative">${formatCurrency(summary.expense)}</span></div>
                <div class="month-stat"><span class="label">Balance</span><span class="value ${summary.balance >= 0 ? 'positive' : 'negative'}">${formatCurrency(summary.balance)}</span></div>
                <button class="view-details-btn" data-type="month" data-month="${monthIndex}" data-year="${year}" ${transactionCount === 0 ? 'disabled' : ''}>Ver Detalles</button>
            </div>
        </div>`;
}

function createYearCardHTML(yearData) {
    const { year, summary, transactions } = yearData;
    const transactionCount = transactions.length;

    return `
        <div class="year-card">
            <div class="year-card-header">
                <h4>Año ${year}</h4>
                 <div class="year-card-pills"><span class="year-tx-count">${transactionCount} ${transactionCount === 1 ? 'Transacción' : 'Transacciones'}</span></div>
            </div>
            <div class="year-card-body">
                <div class="year-stat"><span class="label">Ingresos Totales</span><span class="value positive">${formatCurrency(summary.income)}</span></div>
                <div class="year-stat"><span class="label">Gastos Totales</span><span class="value negative">${formatCurrency(summary.expense)}</span></div>
                <div class="year-stat"><span class="label">Balance Anual</span><span class="value ${summary.balance >= 0 ? 'positive' : 'negative'}">${formatCurrency(summary.balance)}</span></div>
                <button class="view-details-btn" data-type="year" data-year="${year}" ${transactionCount === 0 ? 'disabled' : ''}>Ver Detalles</button>
            </div>
        </div>`;
}

// ======================= FUNCIONES AUXILIARES Y GRÁFICOS ========================

function updatePeriodSummaryCards(summary) {
    document.getElementById('total-period-income').textContent = formatCurrency(summary.income);
    document.getElementById('total-period-expenses').textContent = formatCurrency(summary.expense);
    document.getElementById('total-period-balance').textContent = formatCurrency(summary.balance);
}

function setupActionButtons(summary, transactions, month, year, viewType) {
    const downloadPdfButton = document.getElementById('download-summary-pdf');
    const generateReportBtn = document.getElementById('btn-generate-full-report');
    const hasTransactions = transactions.length > 0;

    downloadPdfButton.disabled = !hasTransactions;
    downloadPdfButton.title = hasTransactions ? "Descargar Resumen en PDF" : "No hay datos para generar un PDF.";
    if (hasTransactions) {
        let title;
        if (viewType === 'weekly') title = `Reporte de ${FULL_MONTH_NAMES[month]} ${year}`;
        else if (viewType === 'monthly') title = `Reporte Anual ${year}`;
        else title = 'Reporte Histórico Global';
        downloadPdfButton.onclick = () => generateEnhancedMonthlyPDF(summary, transactions, title);
    }
    
    generateReportBtn.disabled = !hasTransactions;
    generateReportBtn.style.display = hasTransactions ? 'inline-flex' : 'none';
    generateReportBtn.title = hasTransactions ? "Generar un análisis financiero detallado del período" : "No hay datos para generar un reporte.";
    
    if (hasTransactions) {
        generateReportBtn.onclick = async () => {
            if (typeof renderFullAnalysisReport === 'function') {
                
                let historicalSummary = null;
                let historicalTransactions = [];

                if (viewType === 'weekly') {
                    const allDbTransactions = await getTransactionsForBalance();
                    const prevMonthDate = new Date(year, month - 1, 1);
                    const prevMonth = prevMonthDate.getMonth();
                    const prevYear = prevMonthDate.getFullYear();

                    historicalTransactions = allDbTransactions.filter(t => {
                        const transactionDate = new Date(t.date);
                        return transactionDate.getUTCMonth() === prevMonth && transactionDate.getUTCFullYear() === prevYear;
                    });
                    historicalSummary = calculateSummary(historicalTransactions);
                }

                const analysisData = {
                    monthlySummary: summary,
                    monthlyTransactions: transactions,
                    month: month,
                    year: year,
                    viewType: viewType,
                    historicalMonthlySummaries: historicalSummary ? [historicalSummary] : [],
                    historicalMonthlyTransactions: historicalTransactions ? [historicalTransactions] : []
                };

                renderFullAnalysisReport(analysisData);
                showFullAnalysisReportView();
            }
        };
    }
}


async function getTransactionsForBalance() {
    try {
        const savedTransactions = localStorage.getItem('contauno_transactions');
        return savedTransactions ? Object.values(JSON.parse(savedTransactions)).flat() : [];
    } catch (error) {
        console.error("Error al obtener las transacciones:", error);
        return [];
    }
}

function formatCurrency(value) {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0
    }).format(value);
}

function calculateSummary(transactions) {
    return transactions.reduce((acc, t) => {
        if (t.type === 'income') acc.income += t.amount;
        else if (t.type === 'expense') acc.expense += t.amount;
        acc.balance = acc.income - acc.expense;
        return acc;
    }, { income: 0, expense: 0, balance: 0 });
}

function renderPeriodDoughnutChart(summary) {
    const ctx = document.getElementById('period-summary-chart').getContext('2d');
    if (periodChartInstance) periodChartInstance.destroy();

    const isLightMode = document.body.classList.contains('light-mode');
    const textColor = isLightMode ? '#1e293b' : '#ffffff';
    const borderColor = isLightMode ? '#fff' : '#1e1e48';

    periodChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Ingresos', 'Gastos'],
            datasets: [{
                data: [summary.income || 0.001, summary.expense || 0.001], 
                backgroundColor: ['#10b981', '#ef4444'],
                borderColor: borderColor, borderWidth: 4, hoverOffset: 8
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false, cutout: '70%',
            plugins: {
                legend: { position: 'bottom', labels: { color: textColor, font: { size: 14, weight: '600' }, padding: 20 }},
                tooltip: { callbacks: { label: (c) => `${c.label}: ${formatCurrency(c.raw)}` } },
                datalabels: { display: false }
            }
        }
    });
}

function renderBarChart(labels, incomeData, expenseData, title) {
    document.getElementById('bar-chart-title').textContent = title;
    const ctx = document.getElementById('balance-bar-chart').getContext('2d');
    if (barChartInstance) barChartInstance.destroy();
    
    const isLightMode = document.body.classList.contains('light-mode');
    const gridColor = isLightMode ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)';
    const textColor = isLightMode ? '#475569' : '#a0aec0';
    const legendColor = isLightMode ? '#1e293b' : '#ffffff';

    barChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                { label: 'Ingresos', data: incomeData, backgroundColor: 'rgba(16, 185, 129, 0.7)', borderColor: 'rgba(16, 185, 129, 1)', borderWidth: 1 },
                { label: 'Gastos', data: expenseData, backgroundColor: 'rgba(239, 68, 68, 0.7)', borderColor: 'rgba(239, 68, 68, 1)', borderWidth: 1 }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, ticks: { color: textColor }, grid: { color: gridColor } },
                x: { ticks: { color: textColor }, grid: { color: 'transparent' } }
            },
            plugins: {
                legend: { labels: { color: legendColor }},
                tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${formatCurrency(c.raw)}` }},
                datalabels: { display: false }
            }
        }
    });
}

function generateEnhancedMonthlyPDF(summary, transactions, reportTitle) {
    const { jsPDF } = window.jspdf;
    if (typeof jsPDF === 'undefined' || typeof window.jspdf.autoTable === 'undefined') {
        showNotification("Error: La librería PDF no se ha cargado.", 'error');
        return;
    }
    const doc = new jsPDF();
    doc.save(`${reportTitle.replace(/ /g, '_')}.pdf`);
}


// ======================= MODAL DE DETALLES (Genérico) ========================

document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('weekly-details-modal');
    const closeBtn = document.getElementById('modal-close-btn');
    const balanceContainer = document.getElementById('balance-breakdown-container');

    if (!modal || !closeBtn || !balanceContainer) return;

    const closeModal = () => modal.style.display = "none";
    closeBtn.onclick = closeModal;
    window.onclick = (event) => { if (event.target == modal) closeModal(); }
    document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && modal.style.display === 'block') closeModal();});

    balanceContainer.addEventListener('click', async (event) => {
        const button = event.target.closest('.view-details-btn');
        if (button && !button.disabled) {
            const type = button.dataset.type;
            const allTransactions = await getTransactionsForBalance();
            let transactionsToShow = [];
            let periodLabel = '';

            if (type === 'week') {
                const startDate = new Date(button.dataset.startDate);
                const endDate = new Date(button.dataset.endDate);
                transactionsToShow = allTransactions.filter(t => { const d = new Date(t.date); return d >= startDate && d <= endDate; });
                const options = { day: 'numeric', month: 'long', timeZone: 'UTC' };
                periodLabel = `Semana del ${startDate.toLocaleDateString('es-ES', options)} al ${endDate.toLocaleDateString('es-ES', options)}`;
            } else if (type === 'month') {
                const month = parseInt(button.dataset.month);
                const year = parseInt(button.dataset.year);
                transactionsToShow = allTransactions.filter(t => { const d = new Date(t.date); return d.getUTCMonth() === month && d.getUTCFullYear() === year; });
                periodLabel = `${FULL_MONTH_NAMES[month]} de ${year}`;
            } else if (type === 'year') {
                const year = parseInt(button.dataset.year);
                transactionsToShow = allTransactions.filter(t => new Date(t.date).getUTCFullYear() === year);
                periodLabel = `Año ${year}`;
            }
            
            openDetailsModal(transactionsToShow, periodLabel);
        }
    });
});

/**
 * [FUNCIÓN CORREGIDA]
 * Abre y puebla el modal de detalles con transacciones.
 * Se corrigió la asignación de clase para el color del total neto.
 */
function openDetailsModal(transactions, periodLabel) {
    const modal = document.getElementById('weekly-details-modal');
    const tableBody = document.getElementById('modal-table-body');
    const rangeDisplay = document.getElementById('modal-week-range');
    const subtotalIncomeEl = document.getElementById('modal-subtotal-income');
    const subtotalExpenseEl = document.getElementById('modal-subtotal-expense');
    const finalTotalEl = document.getElementById('modal-final-total');

    rangeDisplay.textContent = periodLabel;
    tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Cargando...</td></tr>';
    modal.style.display = 'block';

    transactions.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    tableBody.innerHTML = '';
    let periodIncome = 0;
    let periodExpense = 0;

    if (transactions.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No hay transacciones en este período.</td></tr>';
    } else {
        transactions.forEach(t => {
            const isIncome = t.type === 'income';
            if (isIncome) periodIncome += t.amount; else periodExpense += t.amount;
            const tipoClass = isIncome ? 'positive-value' : 'negative-value';
            tableBody.innerHTML += `
                <tr>
                    <td>${new Date(t.date).toLocaleDateString('es-CO', {timeZone: 'UTC'})}</td>
                    <td>${t.description || 'N/A'}</td>
                    <td>${t.category || 'N/A'}</td>
                    <td><span class="${tipoClass}">${isIncome ? 'Ingreso' : 'Egreso'}</span></td>
                    <td class="${tipoClass}">${isIncome ? '+' : '-'} ${formatCurrency(t.amount)}</td>
                </tr>`;
        });
    }
    
    const finalBalance = periodIncome - periodExpense;
    subtotalIncomeEl.textContent = formatCurrency(periodIncome);
    subtotalExpenseEl.textContent = formatCurrency(periodExpense);
    finalTotalEl.textContent = formatCurrency(finalBalance);
    
    // --- CORRECCIÓN: Asignar clase de color al elemento correcto ---
    finalTotalEl.className = finalBalance >= 0 ? 'positive-value' : 'negative-value';
}