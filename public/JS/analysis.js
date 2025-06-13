// ===================================================================
// ============ MOTOR DE ANÁLISIS FINANCIERO COMPLETO ================
// ===================================================================

Chart.register(ChartDataLabels);

let dailyFlowChartInstance = null;
let expenseDistributionChartInstance = null;
let incomeDistributionChartInstance = null;

/**
 * Función principal para renderizar todo el reporte en la vista de análisis.
 * @param {object} data - Contiene monthlySummary, monthlyTransactions, month, year, y opcionalmente historical data.
 */
function renderFullAnalysisReport(data) {
    const { monthlySummary, monthlyTransactions, month, year, historicalMonthlySummaries, historicalMonthlyTransactions } = data;

    // 1. Establecer el período del reporte
    const monthName = new Date(year, month).toLocaleString('es-CO', { month: 'long' });
    document.getElementById('analysis-period').textContent = `${monthName.charAt(0).toUpperCase() + monthName.slice(1)} de ${year}`;

    // 2. Renderizar los Indicadores Clave de Rendimiento (KPIs)
    renderKPIs(monthlySummary, monthlyTransactions);

    // 3. Renderizar los gráficos
    renderDailyFlowChart(monthlyTransactions, month, year);
    renderIncomeDistributionChart(monthlyTransactions);
    renderExpenseDistributionChart(monthlyTransactions);

    // 4. Renderizar las tablas de categorías
    renderCategoryIncomeTable(monthlyTransactions);
    renderCategoryExpenseTable(monthlyTransactions);

    // 5. Generar y mostrar los insights de texto (ahora con análisis mejorado)
    renderEnhancedInsights(monthlySummary, monthlyTransactions, { historicalSummaries: historicalMonthlySummaries, historicalTransactions: historicalMonthlyTransactions });
}

function formatCurrencyForAnalysis(value) {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(value);
}

/** Renderiza las 4 tarjetas de KPI principales */
function renderKPIs(summary, transactions) {
    document.getElementById('kpi-total-income').textContent = formatCurrencyForAnalysis(summary.income);
    document.getElementById('kpi-total-expense').textContent = formatCurrencyForAnalysis(summary.expense);
    document.getElementById('kpi-net-balance').textContent = formatCurrencyForAnalysis(summary.balance);

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

/** Renderiza el gráfico de líneas del flujo de dinero diario */
function renderDailyFlowChart(transactions, month, year) {
    const ctx = document.getElementById('daily-flow-chart').getContext('2d');
    if (dailyFlowChartInstance) dailyFlowChartInstance.destroy();

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const labels = Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1));

    const dailyData = {};
    labels.forEach(label => {
        const dateKey = label.toISOString().split('T')[0];
        dailyData[dateKey] = { income: 0, expense: 0 };
    });

    transactions.forEach(t => {
        if (dailyData[t.date]) {
            if (t.type === 'income') dailyData[t.date].income += t.amount;
            else dailyData[t.date].expense += t.amount;
        }
    });

    const incomePoints = Object.values(dailyData).map(d => d.income);
    const expensePoints = Object.values(dailyData).map(d => d.expense);

    const isLightMode = document.body.classList.contains('light-mode');
    const textColor = isLightMode ? '#334155' : '#e2e8f0';
    const gridColor = isLightMode ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)';

    dailyFlowChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Ingresos',
                    data: incomePoints,
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: '#10b981'
                },
                {
                    label: 'Gastos',
                    data: expensePoints,
                    borderColor: '#ef4444',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: '#ef4444'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { ticks: { color: textColor }, grid: { color: gridColor } },
                x: {
                    type: 'time',
                    time: { unit: 'day', displayFormats: { day: 'd MMM' } },
                    ticks: { color: textColor, source: 'labels' },
                    grid: { color: 'transparent' }
                }
            },
            plugins: {
                legend: { position: 'top', labels: { color: textColor } },
                tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${formatCurrencyForAnalysis(c.raw)}` } },
                datalabels: { display: false }
            }
        }
    });
}

/** Renderiza el gráfico de anillo de distribución de INGRESOS */
function renderIncomeDistributionChart(transactions) {
    const ctx = document.getElementById('income-distribution-chart').getContext('2d');
    if (incomeDistributionChartInstance) incomeDistributionChartInstance.destroy();

    const incomeByCategory = {};
    transactions.filter(t => t.type === 'income').forEach(t => {
        const category = t.category || 'Sin Categoría';
        if (!incomeByCategory[category]) incomeByCategory[category] = 0;
        incomeByCategory[category] += t.amount;
    });

    const labels = Object.keys(incomeByCategory);
    const data = Object.values(incomeByCategory);

    const isLightMode = document.body.classList.contains('light-mode');
    const textColor = isLightMode ? '#334155' : '#e2e8f0';
    const borderColor = isLightMode ? '#fff' : '#1e1e48';

    incomeDistributionChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data.length > 0 ? data : [1],
                backgroundColor: data.length > 0 ? ['#10b981', '#22c55e', '#84cc16', '#34d399', '#6366f1', '#0ea5e9', '#06b6d4'] : ['#334155'],
                borderColor: borderColor,
                borderWidth: 4,
                hoverOffset: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: data.length > 0, position: 'bottom', labels: { color: textColor, padding: 15, boxWidth: 12 } },
                tooltip: {
                    enabled: data.length > 0,
                    callbacks: { label: (c) => ` ${c.label}: ${formatCurrencyForAnalysis(c.raw)}` }
                },
                title: {
                    display: data.length === 0,
                    text: 'Sin ingresos para mostrar',
                    color: textColor,
                    font: { size: 14 }
                },
                datalabels: {
                    formatter: (value, ctx) => {
                        const sum = ctx.chart.data.datasets[0].data.reduce((a, b) => a + b, 0);
                        const percentage = (value / sum * 100);
                        return percentage > 5 ? percentage.toFixed(0) + '%' : '';
                    },
                    color: '#ffffff',
                    font: { weight: 'bold', size: 12 },
                    textShadow: { strokeWidth: 2, color: 'rgba(0,0,0,0.5)' }
                }
            }
        }
    });
}

/** Renderiza el gráfico de anillo de distribución de GASTOS */
function renderExpenseDistributionChart(transactions) {
    const ctx = document.getElementById('expense-distribution-chart').getContext('2d');
    if (expenseDistributionChartInstance) expenseDistributionChartInstance.destroy();

    const expenseByCategory = {};
    transactions.filter(t => t.type === 'expense').forEach(t => {
        const category = t.category || 'Sin Categoría';
        if (!expenseByCategory[category]) expenseByCategory[category] = 0;
        expenseByCategory[category] += t.amount;
    });

    const labels = Object.keys(expenseByCategory);
    const data = Object.values(expenseByCategory);

    const isLightMode = document.body.classList.contains('light-mode');
    const textColor = isLightMode ? '#334155' : '#e2e8f0';
    const borderColor = isLightMode ? '#fff' : '#1e1e48';

    expenseDistributionChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data.length > 0 ? data : [1],
                backgroundColor: data.length > 0 ? ['#ef4444', '#f97316', '#f59e0b', '#eab308', '#d97706', '#facc15'] : ['#334155'],
                borderColor: borderColor,
                borderWidth: 4,
                hoverOffset: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: data.length > 0, position: 'bottom', labels: { color: textColor, padding: 15, boxWidth: 12 } },
                tooltip: {
                    enabled: data.length > 0,
                    callbacks: { label: (c) => ` ${c.label}: ${formatCurrencyForAnalysis(c.raw)}` }
                },
                title: {
                    display: data.length === 0,
                    text: 'Sin gastos para mostrar',
                    color: textColor,
                    font: { size: 14 }
                },
                datalabels: {
                    formatter: (value, ctx) => {
                        const sum = ctx.chart.data.datasets[0].data.reduce((a, b) => a + b, 0);
                        const percentage = (value / sum * 100);
                        return percentage > 5 ? percentage.toFixed(0) + '%' : '';
                    },
                    color: '#ffffff',
                    font: { weight: 'bold', size: 12 },
                    textShadow: { strokeWidth: 2, color: 'rgba(0,0,0,0.5)' }
                }
            }
        }
    });
}

/** Renderiza la tabla de INGRESOS por categoría */
function renderCategoryIncomeTable(transactions) {
    const tableBody = document.querySelector('#category-income-table tbody');
    tableBody.innerHTML = '';

    const totalIncome = transactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);

    if (totalIncome === 0) {
        tableBody.innerHTML = '<tr><td colspan="3" style="text-align: center; padding: 2rem; color: var(--text-secondary);">No hay ingresos para mostrar.</td></tr>';
        return;
    }

    const incomeByCategory = {};
    transactions.filter(t => t.type === 'income').forEach(t => {
        const category = t.category || 'Sin Categoría';
        if (!incomeByCategory[category]) incomeByCategory[category] = 0;
        incomeByCategory[category] += t.amount;
    });

    const sortedCategories = Object.entries(incomeByCategory).sort(([, a], [, b]) => b - a);

    sortedCategories.forEach(([category, amount]) => {
        const percentage = totalIncome > 0 ? ((amount / totalIncome) * 100) : 0;
        const row = `
            <tr>
                <td>${category}</td>
                <td>${formatCurrencyForAnalysis(amount)}</td>
                <td>
                    <div class="percentage-bar" title="${percentage.toFixed(1)}%">
                        <div class="income-percentage-fill" style="width: ${percentage}%;"></div>
                        <span class="percentage-text">${percentage.toFixed(1)}%</span>
                    </div>
                </td>
            </tr>
        `;
        tableBody.innerHTML += row;
    });
}


/** Renderiza la tabla de GASTOS por categoría */
function renderCategoryExpenseTable(transactions) {
    const tableBody = document.querySelector('#category-expense-table tbody');
    tableBody.innerHTML = '';

    const totalExpense = transactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);

    if (totalExpense === 0) {
        tableBody.innerHTML = '<tr><td colspan="3" style="text-align: center; padding: 2rem; color: var(--text-secondary);">No hay gastos para mostrar.</td></tr>';
        return;
    }

    const expenseByCategory = {};
    transactions.filter(t => t.type === 'expense').forEach(t => {
        const category = t.category || 'Sin Categoría';
        if (!expenseByCategory[category]) expenseByCategory[category] = 0;
        expenseByCategory[category] += t.amount;
    });

    const sortedCategories = Object.entries(expenseByCategory).sort(([, a], [, b]) => b - a);

    sortedCategories.forEach(([category, amount]) => {
        const percentage = totalExpense > 0 ? ((amount / totalExpense) * 100) : 0;
        const row = `
            <tr>
                <td>${category}</td>
                <td>${formatCurrencyForAnalysis(amount)}</td>
                <td>
                    <div class="percentage-bar" title="${percentage.toFixed(1)}%">
                        <div class="expense-percentage-fill" style="width: ${percentage}%;"></div>
                        <span class="percentage-text">${percentage.toFixed(1)}%</span>
                    </div>
                </td>
            </tr>
        `;
        tableBody.innerHTML += row;
    });
}

// ===================================================================
// =================== MOTOR DE INSIGHTS (MEJORADO) =================
// ===================================================================

/**
 * Obtiene el total de ingresos o gastos para un mes dado.
 * @param {Array} transactions - Lista de transacciones.
 * @param {string} type - 'income' o 'expense'.
 * @returns {number} - El total.
 */
function getTotalByType(transactions, type) {
    return transactions.filter(t => t.type === type).reduce((sum, t) => sum + t.amount, 0);
}

/**
 * Compara el total actual con el total del período anterior.
 * @param {number} currentTotal - Total actual.
 * @param {number} previousTotal - Total del período anterior.
 * @returns {object} - Objeto con la diferencia y el porcentaje de cambio.
 */
function compareWithPrevious(currentTotal, previousTotal) {
    const difference = currentTotal - previousTotal;
    const percentageChange = previousTotal !== 0 ? (difference / previousTotal) * 100 : Infinity;
    return { difference, percentageChange };
}

/**
 * Genera insights basados en la comparación con el período anterior.
 * @param {object} currentSummary - Resumen del mes actual.
 * @param {object} previousSummary - Resumen del mes anterior.
 * @param {Array} generatedInsights - Array para agregar nuevos insights.
 */
function generateTrendInsights(currentSummary, previousSummary, generatedInsights) {
    if (!previousSummary) return;

    const incomeComparison = compareWithPrevious(currentSummary.income, previousSummary.income);
    if (incomeComparison.percentageChange > 10) {
        generatedInsights.push({ type: 'positive', icon: '📈', text: `Los ingresos aumentaron significativamente un <strong>${incomeComparison.percentageChange.toFixed(1)}%</strong> comparado con el mes anterior.` });
    } else if (incomeComparison.percentageChange < -10) {
        generatedInsights.push({ type: 'negative', icon: '📉', text: `Los ingresos disminuyeron notablemente un <strong>${Math.abs(incomeComparison.percentageChange).toFixed(1)}%</strong> respecto al mes anterior. Investiga las causas.` });
    }

    const expenseComparison = compareWithPrevious(currentSummary.expense, previousSummary.expense);
    if (expenseComparison.percentageChange > 15) {
        generatedInsights.push({ type: 'negative', icon: '⚠️', text: `Los gastos se incrementaron considerablemente en un <strong>${expenseComparison.percentageChange.toFixed(1)}%</strong> en comparación con el mes pasado.` });
    } else if (expenseComparison.percentageChange < -15) {
        generatedInsights.push({ type: 'positive', icon: '📉', text: `¡Buenas noticias! Los gastos disminuyeron significativamente en un <strong>${Math.abs(expenseComparison.percentageChange).toFixed(1)}%</strong>.` });
    }
}

/**
 * Analiza la composición de ingresos y gastos para generar insights.
 * @param {Array} currentTransactions - Transacciones del mes actual.
 * @param {Array} previousTransactions - Transacciones del mes anterior.
 * @param {number} currentIncomeTotal - Total de ingresos actual.
 * @param {number} previousIncomeTotal - Total de ingresos anterior.
 * @param {number} currentExpenseTotal - Total de gastos actual.
 * @param {number} previousExpenseTotal - Total de gastos anterior.
 * @param {Array} generatedInsights - Array para agregar nuevos insights.
 */
function analyzeComposition(currentTransactions, previousTransactions, currentIncomeTotal, previousIncomeTotal, currentExpenseTotal, previousExpenseTotal, generatedInsights) {
    const topCurrentIncomeCategories = getTopCategories(currentTransactions, 'income', currentIncomeTotal, 2);
    const topPreviousIncomeCategories = getTopCategories(previousTransactions, 'income', previousIncomeTotal, 2);

    if (topCurrentIncomeCategories.length > 0 && topPreviousIncomeCategories.length > 0 && topCurrentIncomeCategories.map(c => c.name).join(',') !== topPreviousIncomeCategories.map(c => c.name).join(',')) {
        generatedInsights.push({ type: 'neutral', icon: '🔄', text: `Se observan cambios en las principales fuentes de ingreso en comparación con el mes anterior. Revisa las nuevas tendencias.` });
    }

    const topCurrentExpenseCategories = getTopCategories(currentTransactions, 'expense', currentExpenseTotal, 2);
    const topPreviousExpenseCategories = getTopCategories(previousTransactions, 'expense', previousExpenseTotal, 2);

    if (topCurrentExpenseCategories.length > 0 && topPreviousExpenseCategories.length > 0 && topCurrentExpenseCategories.map(c => c.name).join(',') !== topPreviousExpenseCategories.map(c => c.name).join(',')) {
        generatedInsights.push({ type: 'neutral', icon: '🔄', text: `La distribución de los principales gastos ha variado respecto al mes pasado. Analiza si estos cambios son esperados.` });
    }
}

/**
 * Genera el texto de análisis mejorado, lo clasifica y lo renderiza en 3 columnas.
 */
function renderEnhancedInsights(currentSummary, currentTransactions, historicalData) {
    const positiveContainer = document.getElementById('positive-insights-content');
    const attentionContainer = document.getElementById('attention-insights-content');
    const recommendationContainer = document.getElementById('recommendation-insights-content');

    positiveContainer.innerHTML = '';
    attentionContainer.innerHTML = '';
    recommendationContainer.innerHTML = '';

    const positiveInsights = [];
    const attentionInsights = [];
    const recommendationInsights = [];
    const generatedInsightTopics = new Set(); // Para evitar repeticiones

    const { income, expense, balance } = currentSummary;
    const previousMonthData = historicalData && historicalData.historicalSummaries && historicalData.historicalSummaries.length > 0 ? historicalData.historicalSummaries.slice(-1)[0] : null;
    const previousMonthTransactions = historicalData && historicalData.historicalTransactions && historicalData.historicalTransactions.length > 0 ? historicalData.historicalTransactions.slice(-1)[0] : [];

    // Caso base: sin transacciones.
    if (income === 0 && expense === 0 && !generatedInsightTopics.has('no-data')) {
        attentionInsights.push({
            type: 'neutral',
            icon: '🚀',
            text: 'Aún no hay datos suficientes para un análisis profundo. ¡Registra más transacciones!'
        });
        generatedInsightTopics.add('no-data');
        buildInsightsHTML(positiveInsights, positiveContainer);
        buildInsightsHTML(attentionInsights, attentionContainer);
        buildInsightsHTML(recommendationInsights, recommendationContainer);
        return;
    }

    // Insight 1: Balance General
    const balanceTopic = balance > 0 ? 'positive-balance' : 'negative-balance';
    if (!generatedInsightTopics.has(balanceTopic)) {
        if (balance > 0) {
            positiveInsights.push({
                type: 'positive',
                icon: '✅',
                text: `Balance positivo de <strong>${formatCurrencyForAnalysis(balance)}</strong>. ¡Mantén este rumbo!`
            });
        } else {
            attentionInsights.push({
                type: 'negative',
                icon: '⚠️',
                text: `Balance negativo de <strong>${formatCurrencyForAnalysis(balance)}</strong>. Urge revisar gastos e ingresos.`
            });
        }
        generatedInsightTopics.add(balanceTopic);
    }

    // Insight 2: Proporción Gastos vs. Ingresos
    if (income > 0) {
        const ratio = (expense / income) * 100;
        const ratioTopic = ratio < 50 ? 'low-expense-ratio' : (ratio <= 80 ? 'healthy-expense-ratio' : 'high-expense-ratio');
        if (!generatedInsightTopics.has(ratioTopic)) {
            if (ratio < 50) {
                positiveInsights.push({ type: 'positive', icon: '🏆', text: `Gastos bajos: <strong>${ratio.toFixed(1)}%</strong> de los ingresos. ¡Excelente gestión!` });
            } else if (ratio <= 80) {
                // Se cambió a recommendationInsights para ofrecer una sugerencia proactiva
                recommendationInsights.push({ type: 'neutral', icon: '👍', text: `Proporción de gastos saludable del <strong>${ratio.toFixed(1)}%</strong>. Busca optimizar costos para mejorar aún más el margen.` });
            } else {
                attentionInsights.push({ type: 'negative', icon: '🔍', text: `Proporción de gastos alta: <strong>${ratio.toFixed(1)}%</strong> de los ingresos. Es crítico reducir costos no esenciales.` });
            }
            generatedInsightTopics.add(ratioTopic);
        }
    } else if (expense > 0 && !generatedInsightTopics.has('no-income-expense')) {
        attentionInsights.push({
            type: 'negative',
            icon: '❌',
            text: 'No se registraron ingresos este mes. Prioriza la generación de ventas o servicios de inmediato.'
        });
        generatedInsightTopics.add('no-income-expense');
    }

    // Insight 3: Principales Categorías de Gasto
    const topExpenses = getTopCategories(currentTransactions, 'expense', expense, 3);
    if (topExpenses.length > 0) {
        const topExpenseText = topExpenses.map(cat => `<strong>${cat.name} (${cat.percentage.toFixed(0)}%)</strong>`).join(', ');
        const topic = `expense-${topExpenses[0].name}`;
        if (!generatedInsightTopics.has(topic)) {
            attentionInsights.push({
                type: 'negative',
                icon: '💸',
                text: `Mayor gasto en: ${topExpenseText}. ¿Son estos gastos críticos para tu operación?`
            });
            generatedInsightTopics.add(topic);
        }
    }

    // Insight 4: Principales Fuentes de Ingreso
    const topIncomes = getTopCategories(currentTransactions, 'income', income, 3);
     if (topIncomes.length > 0) {
        const topIncomesText = topIncomes.map(cat => `<strong>${cat.name} (${cat.percentage.toFixed(0)}%)</strong>`).join(', ');
        const topic = `income-${topIncomes[0].name}`;
        if (!generatedInsightTopics.has(topic)) {
            recommendationInsights.push({
                type: 'recommendation',
                icon: '💰',
                text: `Principales ingresos de: ${topIncomesText}. Explora cómo fortalecer y diversificar estas fuentes.`
            });
            generatedInsightTopics.add(topic);
        }
    }
    
    // Insight 5: Sugerencia de ahorro/inversión
    if (balance > 0 && (income === 0 || (expense / income) < 0.7) && !generatedInsightTopics.has('savings-investment')) {
        recommendationInsights.push({
            type: 'recommendation',
            icon: '💡',
            text: `Con un margen saludable, considera invertir o crear un fondo de emergencia para asegurar la estabilidad futura.`
        });
        generatedInsightTopics.add('savings-investment');
    }

    // Insight 6: Análisis de Tendencias (si hay datos históricos)
    if (previousMonthData) {
        const allTrendInsights = [];
        generateTrendInsights(currentSummary, previousMonthData, allTrendInsights);
        allTrendInsights.forEach(insight => {
            if (insight.type === 'positive') positiveInsights.push(insight);
            else attentionInsights.push(insight);
        });
    }

    // Insight 7: Análisis de Composición (si hay datos históricos)
    if (previousMonthTransactions && previousMonthTransactions.length > 0) {
        const currentIncomeTotal = getTotalByType(currentTransactions, 'income');
        const previousIncomeTotal = getTotalByType(previousMonthTransactions, 'income');
        const currentExpenseTotal = getTotalByType(currentTransactions, 'expense');
        const previousExpenseTotal = getTotalByType(previousMonthTransactions, 'expense');
        const compositionInsights = [];
        analyzeComposition(currentTransactions, previousMonthTransactions, currentIncomeTotal, previousIncomeTotal, currentExpenseTotal, previousExpenseTotal, compositionInsights);
        compositionInsights.forEach(insight => recommendationInsights.push(insight));
    }

    // Renderizar todo en el DOM
    buildInsightsHTML(positiveInsights, positiveContainer);
    buildInsightsHTML(attentionInsights, attentionContainer);
    buildInsightsHTML(recommendationInsights, recommendationContainer);
}

/**
 * Obtiene el top N de categorías para un tipo de transacción.
 * @param {Array} transactions - Lista de transacciones.
 * @param {string} type - 'income' o 'expense'.
 * @param {number} total - El total de ingresos o gastos.
 * @param {number} limit - El número máximo de categorías a retornar.
 * @returns {Array} - Lista de las N categorías principales.
 */
function getTopCategories(transactions, type, total, limit = 3) {
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
        .map(([name, amount]) => ({
            name,
            amount,
            percentage: (amount / total) * 100
        }));
}

/**
 * Construye y renderiza el HTML para la lista de insights en un contenedor específico.
 * @param {Array} insights - Lista de objetos de insight.
 * @param {HTMLElement} container - El elemento donde se renderizará el HTML.
 */
function buildInsightsHTML(insights, container) {
    if (!container) return;

    if (insights.length === 0) {
        container.innerHTML = `<p class="no-insights-msg" style="color: var(--text-secondary); text-align: center; padding: 1rem;">Sin insights específicos por ahora.</p>`;
        return;
    }

    let html = '<ul class="insights-list">';
    insights.forEach(insight => {
        html += `
            <li class="insight-item ${insight.type}">
                <span class="insight-icon">${insight.icon}</span>
                <p>${insight.text}</p>
            </li>
        `;
    });
    html += '</ul>';
    container.innerHTML = html;
}