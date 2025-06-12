// ===================================================================
// =================== LÓGICA VISTA DE BALANCE =======================
// ===================================================================

// Variables globales para las instancias de los gráficos
let monthlyChartInstance = null;
let weeklyBarChartInstance = null;

document.addEventListener('DOMContentLoaded', () => {
    // La inicialización se hace desde showBalanceView() en scripts.js
});

function populateBalanceSelectors() {
    const monthSelect = document.getElementById('balance-month-select');
    const yearSelect = document.getElementById('balance-year-select');
    
    if (monthSelect.options.length > 0) return;

    const months = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    
    months.forEach((month, index) => {
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
    document.querySelectorAll('.balance-view-toggle button').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`btn-${viewToShow}-view`).classList.add('active');

    document.getElementById('weekly-content').style.display = 'none';

    if (viewToShow === 'weekly') {
        document.getElementById('weekly-content').style.display = 'block';
    }
}

async function updateBalanceView() {
    const month = parseInt(document.getElementById('balance-month-select').value);
    const year = parseInt(document.getElementById('balance-year-select').value);

    const allTransactions = await getTransactionsForBalance();
    
    const monthlyTransactions = allTransactions.filter(t => {
        const transactionDate = new Date(t.date);
        return transactionDate.getMonth() === month && transactionDate.getFullYear() === year;
    });

    const monthlySummary = calculateSummary(monthlyTransactions);
    document.getElementById('total-month-income').textContent = formatCurrency(monthlySummary.income);
    document.getElementById('total-month-expenses').textContent = formatCurrency(monthlySummary.expense);
    document.getElementById('total-month-balance').textContent = formatCurrency(monthlySummary.balance);

    const weeklyData = groupTransactionsByWeek(monthlyTransactions, month, year);

    const container = document.getElementById('weekly-breakdown-container');
    container.innerHTML = '';
    
    if (weeklyData.length === 0) {
        container.innerHTML = '<p class="no-data-msg">No hay datos de transacciones para mostrar en este mes.</p>';
    } else {
        weeklyData.forEach((week, index) => {
            const weekCard = createWeekCardHTML(week, index + 1);
            container.innerHTML += weekCard;
        });
    }

    renderMonthlyChart(monthlySummary);
    renderWeeklyBarChart(weeklyData);

    document.getElementById('download-month-summary-pdf').onclick = () => {
        generateMonthlyPDF(monthlySummary, monthlyTransactions, month, year);
    };
}

/**
 * CORRECCIÓN 3: Funciones de gráficos ahora son conscientes del tema (modo oscuro/claro).
 */
function renderMonthlyChart(summary) {
    const ctx = document.getElementById('monthly-summary-chart').getContext('2d');
    if (monthlyChartInstance) monthlyChartInstance.destroy();

    const isLightMode = document.body.classList.contains('light-mode');
    const textColor = isLightMode ? '#1e293b' : '#ffffff';
    const borderColor = isLightMode ? '#fff' : '#1a1a3e';

    monthlyChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Ingresos', 'Gastos'],
            datasets: [{
                data: [summary.income, summary.expense],
                backgroundColor: ['#10b981', '#ef4444'],
                borderColor: borderColor,
                borderWidth: 2,
                hoverOffset: 8
            }]
        },
        options: {
            responsive: true,
            cutout: '70%',
            plugins: {
                legend: { position: 'bottom', labels: { color: textColor, font: { size: 14, weight: '600' }, padding: 20 }},
                tooltip: { callbacks: { label: (c) => `${c.label}: ${formatCurrency(c.parsed)}` }}
            }
        }
    });
}

function renderWeeklyBarChart(weeklyData) {
    const ctx = document.getElementById('weekly-bar-chart').getContext('2d');
    if (weeklyBarChartInstance) weeklyBarChartInstance.destroy();
    
    const isLightMode = document.body.classList.contains('light-mode');
    const textColor = isLightMode ? '#475569' : '#a0aec0';
    const legendColor = isLightMode ? '#1e293b' : '#ffffff';

    const labels = weeklyData.map((w, i) => `Semana ${i + 1}`);
    const incomeByWeek = weeklyData.map(w => w.summary.income);
    const expensesByWeek = weeklyData.map(w => w.summary.expense);

    weeklyBarChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Ingresos',
                    data: incomeByWeek,
                    backgroundColor: 'rgba(16, 185, 129, 0.6)',
                    borderColor: 'rgba(16, 185, 129, 1)',
                    borderWidth: 1
                },
                {
                    label: 'Gastos',
                    data: expensesByWeek,
                    backgroundColor: 'rgba(239, 68, 68, 0.6)',
                    borderColor: 'rgba(239, 68, 68, 1)',
                    borderWidth: 1
                }
            ]
        },
        options: {
            responsive: true,
            scales: {
                y: { beginAtZero: true, ticks: { color: textColor } },
                x: { ticks: { color: textColor } }
            },
            plugins: {
                legend: { labels: { color: legendColor }},
                tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${formatCurrency(c.raw)}` }}
            }
        }
    });
}


function generateMonthlyPDF(summary, transactions, month, year) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    const primaryColor = '#2d2d5f';
    const secondaryColor = '#4a6fa5';
    const textColor = '#1e293b';
    const headerColor = '#f1f5f9';
    const incomeColor = '#10b981';
    const expenseColor = '#ef4444';

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(primaryColor);
    doc.setFontSize(22);
    doc.text('ContaUNO', 14, 22);
    
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(textColor);
    doc.setFontSize(14);
    doc.text('Resumen Financiero Mensual', 200, 22, { align: 'right' });
    
    const monthName = new Date(year, month).toLocaleString('es-CO', { month: 'long' });
    doc.setFontSize(12);
    doc.text(`${monthName.charAt(0).toUpperCase() + monthName.slice(1)} de ${year}`, 200, 29, { align: 'right' });
    doc.setLineWidth(0.5);
    doc.line(14, 35, 200, 35);

    const drawSummaryCard = (x, y, title, value, color) => {
        doc.setFillColor(headerColor);
        doc.roundedRect(x, y, 62, 25, 3, 3, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(secondaryColor);
        doc.setFontSize(10);
        doc.text(title, x + 5, y + 8);
        doc.setFontSize(14);
        doc.setTextColor(color);
        doc.text(formatCurrency(value), x + 5, y + 18);
    };

    drawSummaryCard(14, 45, 'INGRESOS TOTALES', summary.income, incomeColor);
    drawSummaryCard(80, 45, 'GASTOS TOTALES', summary.expense, expenseColor);
    drawSummaryCard(146, 45, 'BALANCE FINAL', summary.balance, primaryColor);

    doc.autoTable({
        startY: 80,
        head: [['Fecha', 'Descripción', 'Categoría', 'Tipo', 'Monto']],
        body: transactions.map(t => [
            new Date(t.date).toLocaleDateString('es-CO'),
            t.description,
            t.category || 'N/A',
            t.type === 'income' ? 'Ingreso' : 'Gasto',
            formatCurrency(t.amount)
        ]),
        theme: 'grid',
        headStyles: { fillColor: primaryColor, textColor: '#ffffff', fontStyle: 'bold' },
        styles: { cellPadding: 2, fontSize: 9, textColor: textColor },
        columnStyles: { 4: { halign: 'right' } },
        didParseCell: function (data) {
            if (data.column.index === 4 && data.cell.section === 'body') {
                const type = transactions[data.row.index].type;
                data.cell.styles.textColor = type === 'income' ? incomeColor : expenseColor;
            }
        }
    });

    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(10);
        doc.setTextColor(secondaryColor);
        doc.text(`Página ${i} de ${pageCount}`, 200, 285, { align: 'right' });
    }

    doc.save(`Resumen_ContaUNO_${monthName}_${year}.pdf`);
}

/**
 * CORRECCIÓN 1: Lógica de semanas mejorada.
 * Ahora itera por las semanas del mes en lugar de por las transacciones.
 */
function groupTransactionsByWeek(transactions, month, year) {
    const weeks = [];
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    // Encontrar el lunes de la semana en que cae el primer día del mes.
    let weekStart = new Date(firstDayOfMonth);
    weekStart.setDate(weekStart.getDate() - (weekStart.getDay() === 0 ? 6 : weekStart.getDay() - 1));

    // Iterar semana por semana hasta que pasemos el último día del mes.
    while (weekStart <= lastDayOfMonth) {
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);

        // Filtrar transacciones que caen en el rango de esta semana.
        const weekTransactions = transactions.filter(t => {
            const tDate = new Date(t.date);
            return tDate >= weekStart && tDate <= weekEnd;
        });

        weeks.push({
            startDate: new Date(weekStart), // Clonar fecha
            endDate: new Date(weekEnd),     // Clonar fecha
            transactions: weekTransactions,
            summary: calculateSummary(weekTransactions)
        });

        // Moverse al inicio de la siguiente semana.
        weekStart.setDate(weekStart.getDate() + 7);
    }

    return weeks;
}


function createWeekCardHTML(weekData, weekNumber) {
    const { startDate, endDate, summary } = weekData;
    const formatDate = (date) => `${date.getDate().toString().padStart(2, '0')} ${date.toLocaleString('es-CO', { month: 'short' })}`;
    return `
        <div class="week-card">
            <div class="week-card-header">
                <h4>Semana ${weekNumber}: (${formatDate(startDate)} - ${formatDate(endDate)})</h4>
                <button class="pdf-btn-week" data-week="${weekNumber - 1}" title="Descargar Resumen Semanal">📄</button>
            </div>
            <div class="week-card-body">
                <div class="week-stat"><span class="label">Ingresos</span><span class="value positive">${formatCurrency(summary.income)}</span></div>
                <div class="week-stat"><span class="label">Gastos</span><span class="value negative">${formatCurrency(summary.expense)}</span></div>
                <div class="week-stat"><span class="label">Balance</span><span class="value">${formatCurrency(summary.balance)}</span></div>
            </div>
        </div>
    `;
}

function calculateSummary(transactions) {
    return transactions.reduce((acc, t) => {
        if (t.type === 'income') acc.income += t.amount;
        else if (t.type === 'expense') acc.expense += t.amount;
        acc.balance = acc.income - acc.expense;
        return acc;
    }, { income: 0, expense: 0, balance: 0 });
}

async function getTransactionsForBalance() {
    // Ejemplo para Junio 2025
    return [
        { date: '2025-06-01', type: 'expense', amount: 15000, description: 'Café Domingo', category: 'Ocio' },
        { date: '2025-06-02', type: 'income', amount: 1200000, description: 'Salario', category: 'Nómina' },
        { date: '2025-06-04', type: 'expense', amount: 85000, description: 'Mercado Éxito', category: 'Alimentación' },
        { date: '2025-06-10', type: 'expense', amount: 350000, description: 'Arriendo Apto', category: 'Vivienda' },
        { date: '2025-06-11', type: 'income', amount: 300000, description: 'Proyecto Freelance', category: 'Ingresos Extra' },
        { date: '2025-06-18', type: 'expense', amount: 50000, description: 'Transporte Metro', category: 'Transporte' },
        { date: '2025-06-25', type: 'income', amount: 500000, description: 'Venta producto', category: 'Ventas' },
        { date: '2025-06-28', type: 'expense', amount: 150000, description: 'Servicios EPM', category: 'Servicios' },
        { date: '2025-06-30', type: 'expense', amount: 70000, description: 'Cena Lunes', category: 'Restaurantes' },
    ];
}

function formatCurrency(value) {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(value);
}