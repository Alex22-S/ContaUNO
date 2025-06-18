// --- SCRIPT DE NAVEGACIÓN Y ESTRUCTURA PARA CONTAUNO ---

// Se ejecuta cuando todo el HTML ha sido cargado
document.addEventListener('DOMContentLoaded', () => {
    // Lógica de inicio de la aplicación para usuarios logueados:
    // Oculta la vista 'hero' y muestra el dashboard principal por defecto.
    const heroView = document.getElementById('hero');
    if (heroView) {
        heroView.style.display = 'none';
    }
    showMainDashboard();
});

// 1. Función Central para Ocultar Todas las Vistas
// Esta función limpia la pantalla antes de mostrar una nueva vista.
function hideAllViews() {
    const views = [
        'hero', 'main-dashboard', 'calendar-view', 'form-view', 
        'balance-view', 'invoices-view', 'full-analysis-view', 
        'inventory-view', 'savings-view', 'cashflow-view', 'reminders-view'
    ];

    views.forEach(id => {
        const view = document.getElementById(id);
        if (view) {
            view.style.display = 'none';
        }
    });
}

// 2. Funciones Específicas para Mostrar Cada Vista
// Estas son las funciones que se llaman desde los `onclick` en tu HTML.

function showHero() {
    hideAllViews();
    // 'flex' para que el centrado de los elementos del hero funcione correctamente
    document.getElementById('hero').style.display = 'flex'; 
}

function showMainDashboard() {
    hideAllViews();
    // 'block' es el display por defecto para un div
    document.getElementById('main-dashboard').style.display = 'block'; 
}

function showCalendar() {
    hideAllViews();
    document.getElementById('calendar-view').style.display = 'block';
}

function showForm() {
    hideAllViews();
    document.getElementById('form-view').style.display = 'block';
}

function showBalanceView() {
    hideAllViews();
    document.getElementById('balance-view').style.display = 'block';
}

function showInvoicesView() {
    hideAllViews();
    document.getElementById('invoices-view').style.display = 'block';
}

function showInventoryView() {
    hideAllViews();
    document.getElementById('inventory-view').style.display = 'block';
}

function showSavingsView() {
    hideAllViews();
    document.getElementById('savings-view').style.display = 'block';
}

function showCashflowView() {
    hideAllViews();
    document.getElementById('cashflow-view').style.display = 'block';
}

function showRemindersView() {
    hideAllViews();
    document.getElementById('reminders-view').style.display = 'block';
}

// Nota: La función para el reporte de análisis completo ('full-analysis-view')
// probablemente ya la llamas desde tu 'balance.js', lo cual está perfecto.
// Si necesitas llamarla desde otro lugar, puedes crear aquí un showFullAnalysisView().