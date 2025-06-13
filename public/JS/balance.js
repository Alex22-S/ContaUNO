// ===================================================================
// =================== LÓGICA VISTA DE BALANCE =======================
// ===================================================================

let monthlyChartInstance = null;
let weeklyBarChartInstance = null;

function populateBalanceSelectors() {
    const monthSelect = document.getElementById('balance-month-select');
    const yearSelect = document.getElementById('balance-year-select');
    
    // Evitar repoblar si ya tiene opciones
    if (monthSelect.options.length > 1) return;

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

    // Aquí iría la lógica para mostrar/ocultar vistas anuales/mensuales si se implementan
    document.getElementById('weekly-content').style.display = 'none';

    if (viewToShow === 'weekly') {
        document.getElementById('weekly-content').style.display = 'block';
    }
}

async function updateBalanceView() {
    const month = parseInt(document.getElementById('balance-month-select').value);
    const year = parseInt(document.getElementById('balance-year-select').value);

    // Simulamos la obtención de datos. Reemplaza con tu lógica de localStorage o fetch.
    const allTransactions = await getTransactionsForBalance();
    
    const monthlyTransactions = allTransactions.filter(t => {
        // CORREGIDO: Interpretar la fecha 'YYYY-MM-DD' como UTC para evitar errores de zona horaria.
        const transactionDate = new Date(t.date); 
        return transactionDate.getUTCMonth() === month && transactionDate.getUTCFullYear() === year;
    });

    const monthlySummary = calculateSummary(monthlyTransactions);
    document.getElementById('total-month-income').textContent = formatCurrency(monthlySummary.income);
    document.getElementById('total-month-expenses').textContent = formatCurrency(monthlySummary.expense);
    document.getElementById('total-month-balance').textContent = formatCurrency(monthlySummary.balance);

    const weeklyData = groupTransactionsByWeek(monthlyTransactions, month, year);

    const container = document.getElementById('weekly-breakdown-container');
    container.innerHTML = '';
    
    // Se mantiene esta lógica: si no hay transacciones en todo el mes, muestra un mensaje.
    if (weeklyData.length === 0 || weeklyData.every(w => w.transactions.length === 0)) {
        container.innerHTML = '<p class="no-data-msg" style="text-align:center; padding: 2rem; color: var(--text-secondary);">No hay transacciones registradas para este mes.</p>';
    } else {
        // CORREGIDO: Se eliminó el `if (week.transactions.length > 0)` para renderizar todas las tarjetas de la semana,
        // incluso si no tienen transacciones, para una vista mensual completa.
        weeklyData.forEach((week, index) => {
            const weekCard = createWeekCardHTML(week, index + 1, month, year);
            container.innerHTML += weekCard;
        });
    }

    renderMonthlyChart(monthlySummary);
    renderWeeklyBarChart(weeklyData);

    // Asignar evento al botón de descarga de PDF mensual
    document.getElementById('download-month-summary-pdf').onclick = () => {
        generateMonthlyPDF(monthlySummary, monthlyTransactions, month, year);
    };
    
    // Configurar el botón para generar el reporte completo
    const generateReportBtn = document.getElementById('btn-generate-full-report');
    
    if (monthlyTransactions.length === 0) {
        generateReportBtn.disabled = true;
        generateReportBtn.title = "No hay datos para generar un reporte.";
    } else {
        generateReportBtn.disabled = false;
        generateReportBtn.title = "Generar un análisis detallado del mes";
    }

    // Lógica clave para mostrar el nuevo reporte
    generateReportBtn.onclick = () => {
        if (monthlyTransactions.length > 0) {
            const analysisData = {
                monthlySummary,
                monthlyTransactions,
                month,
                year
            };
            // Llamamos a las funciones del nuevo motor de análisis
            if (typeof renderFullAnalysisReport === 'function') {
                renderFullAnalysisReport(analysisData);
                showFullAnalysisReportView();
            }
        }
    };
}

async function getTransactionsForBalance() {
    try {
        const savedTransactions = localStorage.getItem('contauno_transactions');
        if (!savedTransactions) return []; 
        const transactionsByDate = JSON.parse(savedTransactions);
        // `Object.values(transactionsByDate).flat()` combina todas las transacciones de todos los días en un solo array.
        return Object.values(transactionsByDate).flat();
    } catch (error) {
        console.error("Error al obtener las transacciones desde localStorage:", error);
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

function renderMonthlyChart(summary) {
    const ctx = document.getElementById('monthly-summary-chart').getContext('2d');
    if (monthlyChartInstance) monthlyChartInstance.destroy();

    const isLightMode = document.body.classList.contains('light-mode');
    const textColor = isLightMode ? '#1e293b' : '#ffffff';
    const borderColor = isLightMode ? '#fff' : '#1e1e48'; // Coincide con el nuevo fondo

    monthlyChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Ingresos', 'Gastos'],
            datasets: [{
                // Usar un valor muy pequeño si es 0 para que el gráfico no se rompa
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
                // Las etiquetas están desactivadas por defecto aquí, no se necesita cambio
                datalabels: {
                    display: false
                }
            }
        }
    });
}

function renderWeeklyBarChart(weeklyData) {
    const ctx = document.getElementById('weekly-bar-chart').getContext('2d');
    if (weeklyBarChartInstance) weeklyBarChartInstance.destroy();
    
    const isLightMode = document.body.classList.contains('light-mode');
    const gridColor = isLightMode ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)';
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
                { label: 'Ingresos', data: incomeByWeek, backgroundColor: 'rgba(16, 185, 129, 0.7)', borderColor: 'rgba(16, 185, 129, 1)', borderWidth: 1 },
                { label: 'Gastos', data: expensesByWeek, backgroundColor: 'rgba(239, 68, 68, 0.7)', borderColor: 'rgba(239, 68, 68, 1)', borderWidth: 1 }
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
                // CAMBIO: Desactivar etiquetas en este gráfico
                datalabels: {
                    display: false
                }
            }
        }
    });
}

function generateMonthlyPDF(summary, transactions, month, year) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const primaryColor = '#2d2d5f', secondaryColor = '#4a6fa5', textColor = '#1e293b';
    const headerColor = '#f1f5f9', incomeColor = '#10b981', expenseColor = '#ef4444';

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
            // CORREGIDO: Interpretar la fecha como UTC para mostrarla correctamente.
            new Date(t.date).toLocaleDateString('es-CO', {timeZone: 'UTC'}),
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
                data.cell.styles.textColor = transactions[data.row.index].type === 'income' ? incomeColor : expenseColor;
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

function groupTransactionsByWeek(transactions, month, year) {
    const weeks = [];
    if (!transactions) return weeks;
    
    const firstDayOfMonth = new Date(Date.UTC(year, month, 1));
    const lastDayOfMonth = new Date(Date.UTC(year, month + 1, 0));
    
    let weekStart = new Date(firstDayOfMonth);
    // Ajustar al Lunes de la primera semana del mes
    weekStart.setUTCDate(weekStart.getUTCDate() - (weekStart.getUTCDay() === 0 ? 6 : weekStart.getUTCDay() - 1));

    // Itera mientras el inicio de la semana sea antes de que termine el mes.
    while (weekStart <= lastDayOfMonth) {
        const weekEnd = new Date(weekStart);
        // El fin de la semana es 6 días después del inicio (Lunes a Domingo)
        weekEnd.setUTCDate(weekStart.getUTCDate() + 6);

        const weekTransactions = transactions.filter(t => {
            // CORREGIDO: Interpretar la fecha 'YYYY-MM-DD' como UTC para una comparación precisa.
            const tDate = new Date(t.date);
            // La comparación ahora es entre dos fechas UTC, lo que soluciona el error.
            return tDate >= weekStart && tDate <= weekEnd;
        });
        
        // Se crea la semana independientemente de si tiene transacciones.
        // La lógica en updateBalanceView decide si mostrar el mensaje de "No hay datos".
        weeks.push({
            startDate: new Date(weekStart),
            endDate: new Date(weekEnd),
            transactions: weekTransactions,
            summary: calculateSummary(weekTransactions)
        });
       
        // Avanza al siguiente Lunes.
        weekStart.setUTCDate(weekStart.getUTCDate() + 7);
    }
    return weeks;
}

function createWeekCardHTML(weekData, weekNumber, month, year) {
    const { startDate, endDate, summary, transactions } = weekData;
    const firstDayOfMonth = new Date(Date.UTC(year, month, 1));
    const lastDayOfMonth = new Date(Date.UTC(year, month + 1, 0));
    
    const displayStartDate = new Date(Math.max(startDate, firstDayOfMonth));
    const displayEndDate = new Date(Math.min(endDate, lastDayOfMonth));
    
    const formatDate = (date) => `${date.getUTCDate().toString().padStart(2, '0')} ${date.toLocaleString('es-CO', { month: 'short', timeZone: 'UTC' })}`;
    
    let dateLabel = '';
    // Esta comprobación previene que se renderice una tarjeta si la semana no pertenece al mes.
    if (displayStartDate.getTime() > displayEndDate.getTime()) return '';
    
    if (displayStartDate.getUTCDate() === displayEndDate.getUTCDate()) {
        dateLabel = `(${formatDate(displayStartDate)})`;
    } else {
        dateLabel = `(${formatDate(displayStartDate)} - ${formatDate(displayEndDate)})`;
    }
    
    return `
        <div class="week-card">
            <div class="week-card-header">
                <h4>Semana ${weekNumber} <span style="font-weight:400; color: var(--text-secondary); font-size: 0.9em;">${dateLabel}</span></h4>
                <button class="pdf-btn-week" data-week="${weekNumber - 1}" title="Descargar Resumen Semanal" ${transactions.length === 0 ? 'disabled' : ''}>📄</button>
            </div>
            <div class="week-card-body">
                <div class="week-stat"><span class="label">Ingresos</span><span class="value positive">${formatCurrency(summary.income)}</span></div>
                <div class="week-stat"><span class="label">Gastos</span><span class="value negative">${formatCurrency(summary.expense)}</span></div>
                <div class="week-stat"><span class="label">Balance</span><span class="value ${summary.balance >= 0 ? 'positive' : 'negative'}">${formatCurrency(summary.balance)}</span></div>
            </div>
        </div>
    `;
}