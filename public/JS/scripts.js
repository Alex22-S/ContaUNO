// JS/scripts.js (VERSIÓN COMPLETA Y CORREGIDA FINAL)

// =============================================================
// === DECLARACIÓN DE VARIABLES GLOBALES DE LA APLICACIÓN ===
// =============================================================
// Se declaran aquí para que estén disponibles en todos los demás
// archivos (calendar.js, balance.js, inventory.js, etc.).
// Las variables de Firebase 'auth' y 'db' son declaradas globalmente
// en 'firebase-config.js' y no necesitan ser redeclaradas aquí.

// Variable de usuario de Firebase
let currentUser;

// Variables de datos (Caché local)
let transactions = {};
let categories = {};
let transactionTemplates = [];
let products = [];
let accounts = []; // ✅ NUEVO: Array global para cuentas de dinero (Caja/Bancos)


// Variable de estado global
let currentDate = new Date();


// =============================================================
// === OYENTE DE AUTENTICACIÓN Y CARGA DE DATOS CENTRALIZADA ===
// =============================================================
auth.onAuthStateChanged(async (user) => {
    const path = window.location.pathname;
    const onAuthPage = path.endsWith('/login.html') || path.endsWith('/signup.html');

    if (user) {
        currentUser = user; // Asignamos el usuario actual
        if (onAuthPage) {
            window.location.href = 'index.html';
        } else {
            console.log("Usuario autenticado. Cargando todos los datos del usuario desde Firestore...");
            // --- CAMBIO PRINCIPAL: Carga centralizada de datos ---
            await loadAllUserData(); 
            
            const userData = {
                uid: user.uid,
                username: user.displayName,
                email: user.email
            };
            sessionStorage.setItem('contaunoUser', JSON.stringify(userData));
            personalizeUI(userData);
            
            // Si hay una vista de calendario, la inicializamos después de cargar los datos
            if (document.getElementById('calendar-view')) {
                initializeCalendar(); 
            }
        }
    } else {
        currentUser = null;
        // ✅ Limpiar toda la caché local al cerrar sesión
        transactions = {};
        categories = {};
        transactionTemplates = [];
        products = [];
        accounts = []; // Limpiar también las cuentas
        sessionStorage.removeItem('contaunoUser');
        if (!onAuthPage) {
            window.location.href = 'login.html';
        }
    }
});


/**
 * ✅ FUNCIÓN CENTRALIZADA MEJORADA: Carga todos los datos del usuario.
 * Ahora también carga las cuentas de dinero. Si no existen, crea una por defecto.
 */
async function loadAllUserData() {
    if (!currentUser) return;
    try {
        const userRef = db.collection('users').doc(currentUser.uid);

        // Cargar Transacciones
        const transactionsSnapshot = await userRef.collection('transactions').get();
        transactions = {}; // Limpiar caché local
        transactionsSnapshot.forEach(doc => {
            const tx = doc.data();
            const dateKey = tx.date;
            if (!transactions[dateKey]) {
                transactions[dateKey] = [];
            }
            transactions[dateKey].push({ ...tx, id: doc.id });
        });

        // Cargar Categorías
        const categoriesDoc = await userRef.collection('settings').doc('categories').get();
        if (categoriesDoc.exists) {
            categories = categoriesDoc.data();
        } else {
            categories = {
                income: ['Ventas', 'Servicios', 'Otros Ingresos'],
                expense: ['Suministros', 'Alquiler', 'Servicios Públicos', 'Marketing', 'Otros Gastos']
            };
            if (typeof saveCategories === 'function') await saveCategories(); 
        }

        // Cargar Plantillas
        const templatesSnapshot = await userRef.collection('templates').get();
        transactionTemplates = [];
        templatesSnapshot.forEach(doc => {
            transactionTemplates.push({ ...doc.data(), id: doc.id });
        });

        // Cargar Productos de Inventario
        const productsSnapshot = await userRef.collection('products').orderBy('name').get();
        products = [];
        productsSnapshot.forEach(doc => {
            products.push({ ...doc.data(), id: doc.id });
        });
        
        // ✅ NUEVO: Cargar Cuentas de Dinero (Caja/Bancos)
        const accountsSnapshot = await userRef.collection('accounts').orderBy('name').get();
        accounts = []; // Limpiar caché
        accountsSnapshot.forEach(doc => {
            accounts.push({ ...doc.data(), id: doc.id });
        });

        // Si el usuario no tiene ninguna cuenta, crear una "Caja General" por defecto
        if (accounts.length === 0) {
            console.log("No se encontraron cuentas, creando 'Caja General' por defecto.");
            const defaultAccount = { name: 'Caja General', initialBalance: 0, type: 'Efectivo' };
            const docRef = await userRef.collection('accounts').add(defaultAccount);
            accounts.push({ ...defaultAccount, id: docRef.id }); // Añadir a la caché local
        }


        console.log("Todos los datos del usuario han sido cargados exitosamente.");

    } catch (error) {
        console.error("Error crítico al cargar datos desde Firestore: ", error);
        showNotification("No se pudieron cargar tus datos. Revisa tu conexión e intenta recargar la página.", 'error');
    }
}


/**
 * ✅ FUNCIÓN CORREGIDA: Ahora solo modifica el título grande del centro
 * y usa solo el primer nombre del usuario.
 * @param {object} userData - El objeto del usuario con 'username'.
 */
function personalizeUI(userData) {
    // Obtenemos el nombre completo o un valor por defecto
    const fullName = userData.username || 'Usuario';
    
    // Separamos el nombre por los espacios y tomamos solo la primera parte
    const firstName = fullName.split(' ')[0];

    // Seleccionamos únicamente el título grande del 'hero'
    const heroTitle = document.querySelector('.hero-title');

    // Actualizamos el texto del título grande
    if (heroTitle) {
        heroTitle.textContent = firstName;
    }
}

// =============================================================
// === LÓGICA ORIGINAL DEL DOM Y FUNCIONES GLOBALES (SIN CAMBIOS) ===
// =============================================================
document.addEventListener('DOMContentLoaded', () => {
    
    // --- LÓGICA MODO CLARO/OSCURO ---
    const themeToggle = document.getElementById('theme-toggle');
    const body = document.body;

    const setTheme = (isLight) => {
        if (isLight) {
            body.classList.add('light-mode');
            if(themeToggle) themeToggle.checked = true;
            localStorage.setItem('theme', 'light');
        } else {
            body.classList.remove('light-mode');
            if(themeToggle) themeToggle.checked = false;
            localStorage.setItem('theme', 'dark');
        }
    };

    if(themeToggle) {
        themeToggle.addEventListener('change', () => {
            setTheme(themeToggle.checked);
            
            if (document.getElementById('balance-view')?.classList.contains('active')) {
                updateBalanceView();
            }
            if (document.getElementById('full-analysis-view')?.style.display !== 'none') {
                 if(typeof updateBalanceView === 'function') {
                     showBalanceView();
                     setTimeout(() => document.getElementById('btn-generate-full-report').click(), 100);
                 }
            }
            if (document.getElementById('cashflow-view')?.style.display !== 'none') {
                if(typeof updateCashflowView === 'function') updateCashflowView();
            }
        });
    }

    const savedTheme = localStorage.getItem('theme');
    setTheme(savedTheme === 'light');
    
    // --- ELEMENTOS FLOTANTES ANIMADOS ---
    function createFloatingElements() {
        const container = document.getElementById('floatingElements');
        if (!container) return;
        container.innerHTML = '';
        const elementCount = window.innerWidth > 768 ? 50 : 20;
        for (let i = 0; i < elementCount; i++) {
            const element = document.createElement('div');
            element.className = 'floating-element';
            element.style.left = Math.random() * 100 + '%';
            const randomDelay = Math.random() * 15;
            const randomDuration = 15 + Math.random() * 10;
            element.style.animation = `float-particle ${randomDuration}s ${randomDelay}s infinite linear`;
            container.appendChild(element);
        }
    }
    createFloatingElements();
    
    // --- ANIMACIÓN DE ENTRADA PARA TARJETAS ---
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries, obs) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
                obs.unobserve(entry.target);
            }
        });
    }, observerOptions);

    document.querySelectorAll('.function-card, .level-card').forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(20px)';
        el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(el);
    });

    // --- Lógica del botón de Cerrar Sesión ---
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            auth.signOut().then(() => {
                sessionStorage.removeItem('contaunoUser');
                window.location.href = 'login.html';
            }).catch((error) => {
                console.error('Error al cerrar sesión:', error);
            });
        });
    }
});

// --- NAVEGACIÓN Y FILTROS (FUNCIONES GLOBALES) ---

function hideAllViews() {
    document.getElementById('hero').style.display = 'none';
    document.querySelectorAll('.dashboard').forEach(d => d.classList.remove('active'));
    document.getElementById('calendar-view').classList.remove('active');
    document.getElementById('form-view').classList.remove('active');
    document.getElementById('balance-view').classList.remove('active');
    
    const fullAnalysisView = document.getElementById('full-analysis-view');
    if (fullAnalysisView) fullAnalysisView.style.display = 'none';

    const invoicesView = document.getElementById('invoices-view');
    if (invoicesView) invoicesView.classList.remove('active');
    
    const inventoryView = document.getElementById('inventory-view');
    if (inventoryView) inventoryView.style.display = 'none';

    const savingsView = document.getElementById('savings-view');
    if (savingsView) savingsView.style.display = 'none';
    
    const cashflowView = document.getElementById('cashflow-view');
    if (cashflowView) cashflowView.style.display = 'none';

    const remindersView = document.getElementById('reminders-view');
    if (remindersView) remindersView.style.display = 'none';

    const payrollView = document.getElementById('payroll-view');
    if (payrollView) payrollView.style.display = 'none';
}

function showDashboard(level) {
    hideAllViews();
    const dashboard = document.getElementById(level + '-dashboard');
    if (dashboard) {
        dashboard.style.display = ''; 
        dashboard.classList.add('active');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showHero() {
    hideAllViews();
    const hero = document.getElementById('hero');
    if (hero) hero.style.display = 'flex';
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showCalendar() {
    hideAllViews();
    const calendarView = document.getElementById('calendar-view');
    calendarView.classList.add('active');
    
    if (typeof updateCalendar === 'function') {
        if (!calendarView.dataset.context) {
            const currentDate = new Date();
            const monthSelect = document.getElementById('month-select');
            const yearSelect = document.getElementById('year-select');
             if(monthSelect) monthSelect.value = currentDate.getMonth();
             if(yearSelect) yearSelect.value = currentDate.getFullYear();
        }
        updateCalendar();
        delete calendarView.dataset.context; 
    }
     window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showBalanceView() {
    hideAllViews();
    const balanceView = document.getElementById('balance-view');
    if (balanceView) balanceView.classList.add('active');
    if (typeof populateBalanceSelectors === 'function' && typeof updateBalanceView === 'function') {
        populateBalanceSelectors();
        updateBalanceView();
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showInvoicesView() {
    hideAllViews();
    const invoicesView = document.getElementById('invoices-view');
    if (invoicesView) invoicesView.classList.add('active');
    if (typeof renderInvoices === 'function') renderInvoices();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showInventoryView() {
    hideAllViews();
    const inventoryView = document.getElementById('inventory-view');
    if (inventoryView) {
        inventoryView.style.display = 'block';
    }
    if (typeof initializeInventory === 'function') {
        initializeInventory();
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showFullAnalysisReportView() {
    hideAllViews();
    const reportView = document.getElementById('full-analysis-view');
    if (reportView) reportView.style.display = 'block'; 
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showCashflowView() {
    hideAllViews();
    const cashflowView = document.getElementById('cashflow-view');
    if (cashflowView) {
        cashflowView.style.display = 'block';
    }
    if (typeof updateCashflowView === 'function') {
        const yearSelect = document.getElementById('cashflow-year-select');
        const monthSelect = document.getElementById('cashflow-month-select');
        if (yearSelect.options.length === 0) {
            const currentDate = new Date();
            populateYearSelector('cashflow-year-select', () => currentDate.getFullYear());
            populateMonthSelector('cashflow-month-select', () => currentDate.getMonth());
        }
        updateCashflowView();
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showRemindersView() {
    hideAllViews();
    const remindersView = document.getElementById('reminders-view');
    if (remindersView) {
        remindersView.style.display = 'block';
    }
    if (typeof window.initializeRemindersView === 'function') {
        window.initializeRemindersView();
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showPayrollView() {
    hideAllViews();
    const payrollView = document.getElementById('payroll-view');
    if (payrollView) {
        payrollView.style.display = 'block';
    }
    // Llama a la función para cargar la lista de empleados
    if (typeof renderEmployees === 'function') {
        renderEmployees();
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function filterFunctions(query, level) {
    const functions = document.querySelectorAll(`#${level}-functions .function-card`);
    const searchTerm = query.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    
    functions.forEach(card => {
        const title = card.querySelector('.function-title').textContent.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const description = card.querySelector('.function-description').textContent.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        
        if (title.includes(searchTerm) || description.includes(searchTerm)) {
            card.style.display = 'block';
        } else {
            card.style.display = 'none';
        }
    });
}

// ... (El resto de tus funciones de notificación y diálogo se mantienen igual) ...

function showNotification(message, type = 'info', duration = 5000) {
    //...
}

function showConfirmationDialog({ title, message, confirmText = 'Aceptar', cancelText = 'Cancelar', onConfirm, onCancel }) {
    //...
}

function formatCurrency(value) {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(value);
}