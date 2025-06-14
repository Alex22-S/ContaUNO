// ===================================================================
// ============ MOTOR DE ANÁLISIS FINANCIERO COMPLETO ================
// ===================================================================

Chart.register(ChartDataLabels);

let flowChartInstance = null;
let expenseDistributionChartInstance = null;
let incomeDistributionChartInstance = null;
// La constante FULL_MONTH_NAMES se usa desde balance.js

/**
 * Función principal para renderizar todo el reporte en la vista de análisis.
 * @param {object} data - Contiene todos los datos necesarios para el reporte.
 */
function renderFullAnalysisReport(data) {
    const { monthlySummary, monthlyTransactions, month, year, viewType, historicalMonthlySummaries, historicalMonthlyTransactions } = data;

    // --- Adaptación de Títulos y Componentes ---
    const analysisPeriodEl = document.getElementById('analysis-period');
    const flowChartTitleEl = document.getElementById('flow-chart-title');
    const flowChartContainer = document.getElementById('daily-flow-chart').parentElement.parentElement;
    const bestDayKpiCard = document.getElementById('kpi-best-day').parentElement;
    const chartsGrid = document.querySelector('.analysis-charts-grid');

    // Resetear visibilidad y clases
    flowChartContainer.style.display = 'flex';
    bestDayKpiCard.style.display = 'block';
    chartsGrid.classList.remove('two-column-layout');
    
    // --- Lógica de Renderizado por Tipo de Vista ---
    if (viewType === 'weekly') { // ANÁLISIS DE UN MES
        const monthName = new Date(year, month).toLocaleString('es-CO', { month: 'long' });
        analysisPeriodEl.textContent = `${monthName.charAt(0).toUpperCase() + monthName.slice(1)} de ${year}`;
        flowChartTitleEl.textContent = "Flujo de Dinero Diario";
        
        renderDailyFlowChart(monthlyTransactions, month, year);
        renderKPIs(monthlySummary, monthlyTransactions, true);
        renderCategoryTable(monthlyTransactions, 'income');
        renderCategoryTable(monthlyTransactions, 'expense');
        renderDistributionChartByCategory(monthlyTransactions, 'income');
        renderDistributionChartByCategory(monthlyTransactions, 'expense');

    } else if (viewType === 'monthly') { // ANÁLISIS DE UN AÑO
        analysisPeriodEl.textContent = `Año ${year}`;
        flowChartTitleEl.textContent = "Flujo de Dinero Mensual";
        bestDayKpiCard.style.display = 'none';
        
        renderMonthlyFlowChart(monthlyTransactions, year);
        renderKPIs(monthlySummary, monthlyTransactions, false);
        renderMonthlyBreakdownTable(monthlyTransactions, 'income');
        renderMonthlyBreakdownTable(monthlyTransactions, 'expense');
        renderDistributionChartByMonth(monthlyTransactions, 'income');
        renderDistributionChartByMonth(monthlyTransactions, 'expense');
    
    } else { // ANÁLISIS DE TODOS LOS TIEMPOS (GLOBAL)
        analysisPeriodEl.textContent = 'Histórico Global';
        flowChartTitleEl.textContent = "Flujo de Dinero Anual";
        bestDayKpiCard.style.display = 'none';
        
        renderYearlyFlowChart(monthlyTransactions); // Nuevo gráfico por años
        renderKPIs(monthlySummary, monthlyTransactions, false);
        renderYearlyBreakdownTable(monthlyTransactions, 'income'); // Nueva tabla por años
        renderYearlyBreakdownTable(monthlyTransactions, 'expense'); // Nueva tabla por años
        renderDistributionChartByYear(monthlyTransactions, 'income'); // Nuevo gráfico de dona por años
        renderDistributionChartByYear(monthlyTransactions, 'expense'); // Nuevo gráfico de dona por años
    }

    // --- Renderizado de Insights ---
    renderEnhancedInsights(monthlySummary, monthlyTransactions, { 
        historicalSummaries: historicalMonthlySummaries, 
        historicalTransactions: historicalMonthlyTransactions,
        viewType: viewType
    });
}


function formatCurrencyForAnalysis(value) {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(value);
}

// --- SECCIÓN DE RENDERIZADO DE KPIs ---

function renderKPIs(summary, transactions, showBestDay) {
    document.getElementById('kpi-total-income').textContent = formatCurrencyForAnalysis(summary.income);
    document.getElementById('kpi-total-expense').textContent = formatCurrencyForAnalysis(summary.expense);
    document.getElementById('kpi-net-balance').textContent = formatCurrencyForAnalysis(summary.balance);

    if (showBestDay) {
        const dailyBalances = {};
        transactions.forEach(t => {
            const dateKey = t.date;
            if (!dailyBalances[dateKey]) dailyBalances[dateKey] = 0;
            dailyBalances[dateKey] += (t.type === 'income' ? t.amount : -t.amount);
        });

        let bestDay = { date: null, balance: -Infinity };
        for (const date in dailyBalances) {
            if (dailyBalances[date] > bestDay.balance) {
                bestDay = { date, balance: dailyBalances[date] };
            }
        }

        const bestDayEl = document.getElementById('kpi-best-day');
        if (bestDay.date) {
            const dateObj = new Date(bestDay.date + 'T00:00:00');
            bestDayEl.textContent = dateObj.toLocaleDateString('es-CO', { month: 'short', day: 'numeric' });
        } else {
            bestDayEl.textContent = 'N/A';
        }
    }
}


// --- SECCIÓN DE GRÁFICOS DE FLUJO ---

function renderDailyFlowChart(transactions, month, year) {
    const ctx = document.getElementById('daily-flow-chart').getContext('2d');
    if (flowChartInstance) flowChartInstance.destroy();

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const labels = Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1));

    const dailyData = {};
    labels.forEach(label => { dailyData[label.toISOString().split('T')[0]] = { income: 0, expense: 0 }; });
    transactions.forEach(t => {
        if (dailyData[t.date]) {
            if (t.type === 'income') dailyData[t.date].income += t.amount; else dailyData[t.date].expense += t.amount;
        }
    });

    const incomePoints = Object.values(dailyData).map(d => d.income);
    const expensePoints = Object.values(dailyData).map(d => d.expense);
    const isLightMode = document.body.classList.contains('light-mode');
    const textColor = isLightMode ? '#334155' : '#e2e8f0';
    const gridColor = isLightMode ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)';

    flowChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                { label: 'Ingresos', data: incomePoints, borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.1)', fill: true, tension: 0.4, pointBackgroundColor: '#10b981' },
                { label: 'Gastos', data: expensePoints, borderColor: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.1)', fill: true, tension: 0.4, pointBackgroundColor: '#ef4444' }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: {
                y: { ticks: { color: textColor }, grid: { color: gridColor } },
                x: { type: 'time', time: { unit: 'day', displayFormats: { day: 'd MMM' } }, ticks: { color: textColor, source: 'labels' }, grid: { color: 'transparent' } }
            },
            plugins: {
                legend: { position: 'top', labels: { color: textColor } },
                tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${formatCurrencyForAnalysis(c.raw)}` } },
                datalabels: { display: false }
            }
        }
    });
}

function renderMonthlyFlowChart(transactions, year) {
    const ctx = document.getElementById('daily-flow-chart').getContext('2d');
    if (flowChartInstance) flowChartInstance.destroy();
    const MONTH_NAMES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
    const monthlyData = Array.from({ length: 12 }, () => ({ income: 0, expense: 0 }));
    transactions.forEach(t => {
        const transactionDate = new Date(t.date);
        if (transactionDate.getUTCFullYear() === year) {
            const monthIndex = transactionDate.getUTCMonth();
            if (t.type === 'income') monthlyData[monthIndex].income += t.amount; else monthlyData[monthIndex].expense += t.amount;
        }
    });
    const incomePoints = monthlyData.map(d => d.income);
    const expensePoints = monthlyData.map(d => d.expense);
    const isLightMode = document.body.classList.contains('light-mode');
    const textColor = isLightMode ? '#334155' : '#e2e8f0';
    const gridColor = isLightMode ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)';

    flowChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: MONTH_NAMES,
            datasets: [
                { label: 'Ingresos', data: incomePoints, borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.1)', fill: true, tension: 0.4 },
                { label: 'Gastos', data: expensePoints, borderColor: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.1)', fill: true, tension: 0.4 }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: {
                y: { ticks: { color: textColor }, grid: { color: gridColor } },
                x: { ticks: { color: textColor }, grid: { color: 'transparent' } }
            },
            plugins: {
                legend: { position: 'top', labels: { color: textColor } },
                tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${formatCurrencyForAnalysis(c.raw)}` } },
                datalabels: { display: false }
            }
        }
    });
}

/**
 * NUEVA FUNCIÓN: Renderiza el gráfico de flujo de dinero ANUAL.
 * @param {Array} transactions Todas las transacciones del historial.
 */
function renderYearlyFlowChart(transactions) {
    const ctx = document.getElementById('daily-flow-chart').getContext('2d');
    if (flowChartInstance) flowChartInstance.destroy();
    
    const yearlyData = groupDataByYear(transactions);
    const labels = yearlyData.map(d => d.year);
    const incomePoints = yearlyData.map(d => d.income);
    const expensePoints = yearlyData.map(d => d.expense);

    const isLightMode = document.body.classList.contains('light-mode');
    const textColor = isLightMode ? '#334155' : '#e2e8f0';
    const gridColor = isLightMode ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)';

    flowChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                { label: 'Ingresos', data: incomePoints, borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.1)', fill: true, tension: 0.4 },
                { label: 'Gastos', data: expensePoints, borderColor: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.1)', fill: true, tension: 0.4 }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: {
                y: { ticks: { color: textColor }, grid: { color: gridColor } },
                x: { ticks: { color: textColor }, grid: { color: 'transparent' } }
            },
            plugins: {
                legend: { position: 'top', labels: { color: textColor } },
                tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${formatCurrencyForAnalysis(c.raw)}` } },
                datalabels: { display: false }
            }
        }
    });
}


// --- SECCIÓN DE TABLAS DE DESGLOSE ---

function renderMonthlyBreakdownTable(transactions, type) {
    const tableId = type === 'income' ? 'category-income-table' : 'category-expense-table';
    const titleId = type === 'income' ? 'income-table-title' : 'expense-table-title';
    const tableBody = document.querySelector(`#${tableId} tbody`);
    const titleEl = document.getElementById(titleId);
    
    titleEl.textContent = type === 'income' ? 'Ingresos por Mes' : 'Gastos por Mes';
    document.querySelector(`#${tableId} thead th`).textContent = 'Mes';
    tableBody.innerHTML = '';

    const totalValue = transactions.filter(t => t.type === type).reduce((sum, t) => sum + t.amount, 0);
    if (totalValue === 0) {
        tableBody.innerHTML = `<tr><td colspan="3" style="text-align: center; padding: 2rem;">No hay ${type === 'income' ? 'ingresos' : 'gastos'}.</td></tr>`;
        return;
    }

    const monthlyData = Array.from({ length: 12 }, () => 0);
    transactions.filter(t => t.type === type).forEach(t => {
        monthlyData[new Date(t.date).getUTCMonth()] += t.amount;
    });

    const sortedMonths = monthlyData
        .map((amount, index) => ({ name: FULL_MONTH_NAMES[index], amount }))
        .filter(month => month.amount > 0)
        .sort((a, b) => b.amount - a.amount);

    sortedMonths.forEach(month => {
        const percentage = (month.amount / totalValue) * 100;
        tableBody.innerHTML += `<tr><td>${month.name}</td><td>${formatCurrencyForAnalysis(month.amount)}</td><td><div class="percentage-bar" title="${percentage.toFixed(1)}%"><div class="${type}-percentage-fill" style="width: ${percentage}%;"></div><span class="percentage-text">${percentage.toFixed(1)}%</span></div></td></tr>`;
    });
}

function renderCategoryTable(transactions, type) {
    const tableId = type === 'income' ? 'category-income-table' : 'category-expense-table';
    const titleId = type === 'income' ? 'income-table-title' : 'expense-table-title';
    const tableBody = document.querySelector(`#${tableId} tbody`);
    const titleEl = document.getElementById(titleId);

    titleEl.textContent = type === 'income' ? 'Ingresos por Categoría' : 'Gastos por Categoría';
    document.querySelector(`#${tableId} thead th`).textContent = 'Categoría';
    tableBody.innerHTML = '';

    const totalValue = transactions.filter(t => t.type === type).reduce((sum, t) => sum + t.amount, 0);
    if (totalValue === 0) {
        tableBody.innerHTML = `<tr><td colspan="3" style="text-align: center; padding: 2rem;">No hay ${type === 'income' ? 'ingresos' : 'gastos'}.</td></tr>`;
        return;
    }

    const dataByCategory = {};
    transactions.filter(t => t.type === type).forEach(t => {
        const category = t.category || 'Sin Categoría';
        if (!dataByCategory[category]) dataByCategory[category] = 0;
        dataByCategory[category] += t.amount;
    });

    const sortedData = Object.entries(dataByCategory).sort(([, a], [, b]) => b - a);
    sortedData.forEach(([name, amount]) => {
        const percentage = (amount / totalValue) * 100;
        tableBody.innerHTML += `<tr><td>${name}</td><td>${formatCurrencyForAnalysis(amount)}</td><td><div class="percentage-bar" title="${percentage.toFixed(1)}%"><div class="${type}-percentage-fill" style="width: ${percentage}%;"></div><span class="percentage-text">${percentage.toFixed(1)}%</span></div></td></tr>`;
    });
}

/**
 * NUEVA FUNCIÓN: Renderiza la tabla de desglose por AÑO.
 * @param {Array} transactions Todas las transacciones.
 * @param {string} type 'income' o 'expense'.
 */
function renderYearlyBreakdownTable(transactions, type) {
    const tableId = type === 'income' ? 'category-income-table' : 'category-expense-table';
    const titleId = type === 'income' ? 'income-table-title' : 'expense-table-title';
    const tableBody = document.querySelector(`#${tableId} tbody`);
    const titleEl = document.getElementById(titleId);

    titleEl.textContent = type === 'income' ? 'Ingresos por Año' : 'Gastos por Año';
    document.querySelector(`#${tableId} thead th`).textContent = 'Año';
    tableBody.innerHTML = '';

    const totalValue = transactions.filter(t => t.type === type).reduce((sum, t) => sum + t.amount, 0);
    if (totalValue === 0) {
        tableBody.innerHTML = `<tr><td colspan="3" style="text-align: center; padding: 2rem;">No hay ${type === 'income' ? 'ingresos' : 'gastos'}.</td></tr>`;
        return;
    }

    const yearlyData = groupDataByYear(transactions).sort((a, b) => b[type] - a[type]);

    yearlyData.forEach(yearData => {
        const amount = yearData[type];
        if (amount > 0) {
            const percentage = (amount / totalValue) * 100;
            tableBody.innerHTML += `<tr><td>${yearData.year}</td><td>${formatCurrencyForAnalysis(amount)}</td><td><div class="percentage-bar" title="${percentage.toFixed(1)}%"><div class="${type}-percentage-fill" style="width: ${percentage}%;"></div><span class="percentage-text">${percentage.toFixed(1)}%</span></div></td></tr>`;
        }
    });
}


// --- SECCIÓN DE GRÁFICOS DE DISTRIBUCIÓN (DONA) ---

function renderDistributionChartByMonth(transactions, type) {
    const chartId = type === 'income' ? 'income-distribution-chart' : 'expense-distribution-chart';
    let chartInstance = type === 'income' ? incomeDistributionChartInstance : expenseDistributionChartInstance;
    const ctx = document.getElementById(chartId).getContext('2d');
    if (chartInstance) chartInstance.destroy();

    const monthlyData = Array(12).fill(0);
    transactions.filter(t => t.type === type).forEach(t => {
        monthlyData[new Date(t.date).getUTCMonth()] += t.amount;
    });

    const labels = [], data = [];
    monthlyData.forEach((amount, index) => {
        if (amount > 0) {
            labels.push(FULL_MONTH_NAMES[index]);
            data.push(amount);
        }
    });
    
    const colors = type === 'income' ? 
        ['#10b981', '#22c55e', '#84cc16', '#34d399', '#6366f1', '#0ea5e9', '#06b6d4', '#2dd4bf', '#3b82f6', '#8b5cf6', '#a3e635', '#4ade80'] :
        ['#ef4444', '#f97316', '#f59e0b', '#eab308', '#d97706', '#facc15', '#f87171', '#fb923c', '#fbbf24', '#fca5a5', '#fdba74', '#fed7aa'];
    const isLightMode = document.body.classList.contains('light-mode');
    const textColor = isLightMode ? '#334155' : '#e2e8f0';
    const borderColor = isLightMode ? '#fff' : '#1e1e48';

    const newChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{ data: data.length > 0 ? data : [1], backgroundColor: data.length > 0 ? colors : ['#334155'], borderColor: borderColor, borderWidth: 4, hoverOffset: 8 }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { display: data.length > 0, position: 'bottom', labels: { color: textColor, padding: 15, boxWidth: 12 } },
                tooltip: { enabled: data.length > 0, callbacks: { label: (c) => ` ${c.label}: ${formatCurrencyForAnalysis(c.raw)}` } },
                title: { display: data.length === 0, text: `Sin ${type === 'income' ? 'ingresos' : 'gastos'}`, color: textColor, font: { size: 14 } },
                datalabels: {
                    formatter: (value, context) => { const sum = context.chart.data.datasets[0].data.reduce((a, b) => a + b, 0); const percentage = (value / sum * 100); return percentage > 5 ? percentage.toFixed(0) + '%' : ''; },
                    color: '#ffffff', font: { weight: 'bold', size: 12 }, textShadow: { strokeWidth: 2, color: 'rgba(0,0,0,0.5)' }
                }
            }
        }
    });

    if (type === 'income') incomeDistributionChartInstance = newChartInstance; else expenseDistributionChartInstance = newChartInstance;
}

function renderDistributionChartByCategory(transactions, type) {
    const chartId = type === 'income' ? 'income-distribution-chart' : 'expense-distribution-chart';
    let chartInstance = type === 'income' ? incomeDistributionChartInstance : expenseDistributionChartInstance;
    const ctx = document.getElementById(chartId).getContext('2d');
    if (chartInstance) chartInstance.destroy();

    const dataByCategory = {};
    transactions.filter(t => t.type === type).forEach(t => {
        const category = t.category || 'Sin Categoría';
        if (!dataByCategory[category]) dataByCategory[category] = 0;
        dataByCategory[category] += t.amount;
    });

    const labels = Object.keys(dataByCategory);
    const data = Object.values(dataByCategory);
    const colors = type === 'income' ? ['#10b981', '#22c55e', '#84cc16', '#34d399', '#6366f1', '#0ea5e9', '#06b6d4'] : ['#ef4444', '#f97316', '#f59e0b', '#eab308', '#d97706', '#facc15'];
    const isLightMode = document.body.classList.contains('light-mode');
    const textColor = isLightMode ? '#334155' : '#e2e8f0';
    const borderColor = isLightMode ? '#fff' : '#1e1e48';

    const newChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{ data: data.length > 0 ? data : [1], backgroundColor: data.length > 0 ? colors : ['#334155'], borderColor: borderColor, borderWidth: 4, hoverOffset: 8 }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { display: data.length > 0, position: 'bottom', labels: { color: textColor, padding: 15, boxWidth: 12 } },
                tooltip: { enabled: data.length > 0, callbacks: { label: (c) => ` ${c.label}: ${formatCurrencyForAnalysis(c.raw)}` } },
                title: { display: data.length === 0, text: `Sin ${type === 'income' ? 'ingresos' : 'gastos'}`, color: textColor, font: { size: 14 } },
                datalabels: {
                    formatter: (value, context) => { const sum = context.chart.data.datasets[0].data.reduce((a, b) => a + b, 0); const percentage = (value / sum * 100); return percentage > 5 ? percentage.toFixed(0) + '%' : ''; },
                    color: '#ffffff', font: { weight: 'bold', size: 12 }, textShadow: { strokeWidth: 2, color: 'rgba(0,0,0,0.5)' }
                }
            }
        }
    });

    if (type === 'income') incomeDistributionChartInstance = newChartInstance; else expenseDistributionChartInstance = newChartInstance;
}

/**
 * NUEVA FUNCIÓN: Renderiza el gráfico de distribución por AÑO.
 * @param {Array} transactions Todas las transacciones.
 * @param {string} type 'income' o 'expense'.
 */
function renderDistributionChartByYear(transactions, type) {
    const chartId = type === 'income' ? 'income-distribution-chart' : 'expense-distribution-chart';
    let chartInstance = type === 'income' ? incomeDistributionChartInstance : expenseDistributionChartInstance;
    const ctx = document.getElementById(chartId).getContext('2d');
    if (chartInstance) chartInstance.destroy();

    const yearlyData = groupDataByYear(transactions);
    const labels = yearlyData.map(d => d.year);
    const data = yearlyData.map(d => d[type]);

    const colors = type === 'income' ? 
        ['#10b981', '#22c55e', '#84cc16', '#34d399', '#6366f1', '#0ea5e9', '#06b6d4', '#2dd4bf'] :
        ['#ef4444', '#f97316', '#f59e0b', '#eab308', '#d97706', '#facc15', '#f87171', '#fb923c'];
    const isLightMode = document.body.classList.contains('light-mode');
    const textColor = isLightMode ? '#334155' : '#e2e8f0';
    const borderColor = isLightMode ? '#fff' : '#1e1e48';

    const newChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{ data: data.length > 0 ? data : [1], backgroundColor: data.length > 0 ? colors : ['#334155'], borderColor: borderColor, borderWidth: 4, hoverOffset: 8 }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { display: data.length > 0, position: 'bottom', labels: { color: textColor, padding: 15, boxWidth: 12 } },
                tooltip: { enabled: data.length > 0, callbacks: { label: (c) => ` ${c.label}: ${formatCurrencyForAnalysis(c.raw)}` } },
                title: { display: data.length === 0, text: `Sin ${type === 'income' ? 'ingresos' : 'gastos'}`, color: textColor, font: { size: 14 } },
                datalabels: {
                    formatter: (value, context) => { const sum = context.chart.data.datasets[0].data.reduce((a, b) => a + b, 0); const percentage = (value / sum * 100); return percentage > 5 ? percentage.toFixed(0) + '%' : ''; },
                    color: '#ffffff', font: { weight: 'bold', size: 12 }, textShadow: { strokeWidth: 2, color: 'rgba(0,0,0,0.5)' }
                }
            }
        }
    });

    if (type === 'income') incomeDistributionChartInstance = newChartInstance; else expenseDistributionChartInstance = newChartInstance;
}


// --- SECCIÓN DE INSIGHTS ESTRATÉGICOS ---

function renderEnhancedInsights(currentSummary, currentTransactions, context) {
    const { viewType, historicalSummaries } = context;
    const positiveContainer = document.getElementById('positive-insights-content');
    const attentionContainer = document.getElementById('attention-insights-content');
    const recommendationContainer = document.getElementById('recommendation-insights-content');

    positiveContainer.innerHTML = ''; attentionContainer.innerHTML = ''; recommendationContainer.innerHTML = '';
    const positiveInsights = [], attentionInsights = [], recommendationInsights = [];
    const { income, expense, balance } = currentSummary;

    if (income === 0 && expense === 0) {
        attentionContainer.innerHTML = `<p class="no-insights-msg">No hay datos suficientes para un análisis profundo.</p>`; return;
    }

    if (balance > 0) positiveInsights.push({ icon: '✅', text: `Balance positivo de <strong>${formatCurrencyForAnalysis(balance)}</strong>. ¡Excelente!` });
    else attentionInsights.push({ icon: '⚠️', text: `Balance negativo de <strong>${formatCurrencyForAnalysis(balance)}</strong>. Urge revisar gastos e ingresos.` });

    if (viewType === 'annual') { // INSIGHTS POR AÑO
        const yearlyData = groupDataByYear(currentTransactions);
        const bestIncomeYear = yearlyData.reduce((max, year) => year.income > max.income ? year : max, { income: -1 });
        if (bestIncomeYear.income > 0) recommendationInsights.push({ icon: '🎉', text: `El año con mayores ingresos fue <strong>${bestIncomeYear.year}</strong>.` });

        const highestExpenseYear = yearlyData.reduce((max, year) => year.expense > max.expense ? year : max, { expense: -1 });
        if (highestExpenseYear.expense > 0) attentionInsights.push({ icon: '💸', text: `El año con el gasto más elevado fue <strong>${highestExpenseYear.year}</strong>.` });

    } else if (viewType === 'monthly') { // INSIGHTS POR MES
        const topIncomeMonths = getTopMonths(currentTransactions, 'income', income, 1);
        if (topIncomeMonths.length > 0) recommendationInsights.push({ icon: '🗓️', text: `El mes con mayores ingresos fue <strong>${topIncomeMonths[0].name}</strong>.` });
        
        const topExpenseMonths = getTopMonths(currentTransactions, 'expense', expense, 1);
        if (topExpenseMonths.length > 0) attentionInsights.push({ icon: '💸', text: `El mes con mayor gasto fue <strong>${topExpenseMonths[0].name}</strong>.` });

    } else { // INSIGHTS POR CATEGORÍA
        const topIncomes = getTopCategories(currentTransactions, 'income', income, 1);
        if (topIncomes.length > 0) recommendationInsights.push({ icon: '💰', text: `Tu principal fuente de ingresos es <strong>${topIncomes[0].name}</strong>.` });

        const topExpenses = getTopCategories(currentTransactions, 'expense', expense, 1);
        if (topExpenses.length > 0) attentionInsights.push({ icon: '💸', text: `Tu mayor gasto es en <strong>${topExpenses[0].name}</strong>.` });
    }

    if (income > 0) {
        const ratio = (expense / income) * 100;
        if (ratio < 50) positiveInsights.push({ icon: '🏆', text: `Gastos bajos: <strong>${ratio.toFixed(1)}%</strong> de los ingresos. ¡Excelente gestión!` });
        else if (ratio <= 80) recommendationInsights.push({ icon: '👍', text: `Proporción de gastos saludable del <strong>${ratio.toFixed(1)}%</strong>.` });
        else attentionInsights.push({ icon: '🔍', text: `Proporción de gastos alta: <strong>${ratio.toFixed(1)}%</strong>.` });
    }

    if (viewType === 'weekly') {
        const previousMonthData = historicalSummaries.length > 0 ? historicalSummaries[0] : null;
        generateTrendInsights(currentSummary, previousMonthData, positiveInsights, attentionInsights);
    }
    
    buildInsightsHTML(positiveInsights, positiveContainer, "Sin puntos positivos destacados.");
    buildInsightsHTML(attentionInsights, attentionContainer, "No se identificaron áreas críticas.");
    buildInsightsHTML(recommendationInsights, recommendationContainer, "Sin sugerencias por ahora.");
}

// --- SECCIÓN DE FUNCIONES AUXILIARES DE DATOS ---

function getTopMonths(transactions, type, total, limit = 1) {
    if (total === 0) return [];
    const monthlyData = Array.from({ length: 12 }, () => 0);
    transactions.filter(t => t.type === type).forEach(t => {
        monthlyData[new Date(t.date).getUTCMonth()] += t.amount;
    });

    return monthlyData
        .map((amount, index) => ({ name: FULL_MONTH_NAMES[index], amount, percentage: (amount / total) * 100 }))
        .filter(month => month.amount > 0)
        .sort((a, b) => b.amount - a.amount)
        .slice(0, limit);
}

function getTopCategories(transactions, type, total, limit = 1) {
    if (total === 0) return [];
    const categoryMap = {};
    transactions.filter(t => t.type === type).forEach(t => {
        const category = t.category || 'Sin Categoría';
        if (!categoryMap[category]) categoryMap[category] = 0;
        categoryMap[category] += t.amount;
    });

    return Object.entries(categoryMap)
        .sort(([, a], [, b]) => b - a)
        .slice(0, limit)
        .map(([name, amount]) => ({ name, amount, percentage: (amount / total) * 100 }));
}

function generateTrendInsights(currentSummary, previousSummary, positiveInsights, attentionInsights) {
    if (!previousSummary) return;
    const incomeComparison = compareWithPrevious(currentSummary.income, previousSummary.income);
    if (incomeComparison.percentageChange > 10) positiveInsights.push({ icon: '📈', text: `Ingresos subieron un <strong>${incomeComparison.percentageChange.toFixed(0)}%</strong> vs. el mes anterior.` });
    else if (incomeComparison.percentageChange < -10) attentionInsights.push({ icon: '📉', text: `Ingresos bajaron un <strong>${Math.abs(incomeComparison.percentageChange).toFixed(0)}%</strong> vs. el mes anterior.` });

    const expenseComparison = compareWithPrevious(currentSummary.expense, previousSummary.expense);
    if (expenseComparison.percentageChange > 15) attentionInsights.push({ icon: '⚠️', text: `Gastos subieron un <strong>${expenseComparison.percentageChange.toFixed(0)}%</strong> vs. el mes anterior.` });
    else if (expenseComparison.percentageChange < -15) positiveInsights.push({ icon: '📉', text: `Gastos bajaron un <strong>${Math.abs(expenseComparison.percentageChange).toFixed(0)}%</strong>.` });
}

function compareWithPrevious(currentTotal, previousTotal) {
    if (previousTotal === 0) return { difference: currentTotal, percentageChange: Infinity };
    const difference = currentTotal - previousTotal;
    const percentageChange = (difference / previousTotal) * 100;
    return { difference, percentageChange };
}

/**
 * NUEVA FUNCIÓN: Agrupa todas las transacciones por año.
 * @param {Array} transactions Todas las transacciones.
 * @returns {Array} Un array de objetos, donde cada objeto es un año con sus totales.
 */
function groupDataByYear(transactions) {
    const dataByYear = {};
    transactions.forEach(t => {
        const year = new Date(t.date).getUTCFullYear();
        if (!dataByYear[year]) {
            dataByYear[year] = { year: year, income: 0, expense: 0, balance: 0 };
        }
        if (t.type === 'income') dataByYear[year].income += t.amount;
        else dataByYear[year].expense += t.amount;
    });

    Object.values(dataByYear).forEach(yearData => {
        yearData.balance = yearData.income - yearData.expense;
    });

    return Object.values(dataByYear).sort((a, b) => a.year - b.year);
}


function buildInsightsHTML(insights, container, emptyMessage) {
    if (!container) return;
    if (insights.length === 0) {
        container.innerHTML = `<p class="no-insights-msg">${emptyMessage}</p>`; return;
    }
    let html = '<ul class="insights-list">';
    insights.forEach(insight => {
        html += `<li class="insight-item"><span class="insight-icon">${insight.icon}</span><p>${insight.text}</p></li>`;
    });
    html += '</ul>';
    container.innerHTML = html;
}