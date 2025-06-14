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
}

function showDashboard(level) {
    hideAllViews();
    const dashboard = document.getElementById(level + '-dashboard');
    if (dashboard) dashboard.classList.add('active');
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

function showFullAnalysisReportView() {
    hideAllViews();
    const reportView = document.getElementById('full-analysis-view');
    if (reportView) reportView.style.display = 'block'; 
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

// =================================================================
// SISTEMA DE NOTIFICACIONES Y DIÁLOGOS
// =================================================================

/**
 * Muestra una notificación personalizada en la pantalla.
 * @param {string} message - El mensaje que se mostrará.
 * @param {string} type - El tipo de notificación ('success', 'error', 'info', 'warning').
 * @param {number} duration - La duración en milisegundos antes de que desaparezca.
 */
function showNotification(message, type = 'info', duration = 5000) {
    const container = document.getElementById('notification-container');
    if (!container) return;

    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `<span>${message}</span><button class="close-btn">&times;</button>`;
    
    const closeNotification = () => {
        notification.classList.remove('show');
        setTimeout(() => { if (notification.parentElement) notification.parentElement.removeChild(notification); }, 400);
    };

    notification.querySelector('.close-btn').onclick = closeNotification;
    container.appendChild(notification);
    setTimeout(() => notification.classList.add('show'), 10);
    setTimeout(closeNotification, duration);
}


/**
 * Muestra un diálogo de confirmación modal.
 * @param {object} options - Opciones para el diálogo.
 * @param {string} options.title - El título del diálogo.
 * @param {string} options.message - El mensaje principal del diálogo.
 * @param {string} [options.confirmText='Aceptar'] - Texto del botón de confirmación.
 * @param {string} [options.cancelText='Cancelar'] - Texto del botón de cancelación.
 * @param {function} options.onConfirm - Callback que se ejecuta al confirmar.
 * @param {function} [options.onCancel] - Callback que se ejecuta al cancelar.
 */
function showConfirmationDialog({ title, message, confirmText = 'Aceptar', cancelText = 'Cancelar', onConfirm, onCancel }) {
    // Eliminar cualquier diálogo existente para evitar duplicados
    const existingDialog = document.getElementById('confirmation-dialog');
    if (existingDialog) existingDialog.remove();

    // Crear la estructura del diálogo
    const dialog = document.createElement('div');
    dialog.className = 'confirmation-overlay';
    dialog.id = 'confirmation-dialog';
    dialog.innerHTML = `
        <div class="confirmation-dialog">
            <h3 class="confirmation-title">${title}</h3>
            <p class="confirmation-message">${message}</p>
            <div class="confirmation-actions">
                <button id="confirm-btn" class="btn-confirm">${confirmText}</button>
                <button id="cancel-btn" class="btn-cancel">${cancelText}</button>
            </div>
        </div>
    `;

    document.body.appendChild(dialog);

    const confirmBtn = dialog.querySelector('#confirm-btn');
    const cancelBtn = dialog.querySelector('#cancel-btn');
    const overlay = dialog;

    const closeDialog = () => {
        dialog.classList.add('closing');
        setTimeout(() => dialog.remove(), 300); // Coincide con la animación CSS
    };

    confirmBtn.addEventListener('click', () => {
        if (typeof onConfirm === 'function') onConfirm();
        closeDialog();
    });

    cancelBtn.addEventListener('click', () => {
        if (typeof onCancel === 'function') onCancel();
        closeDialog();
    });
    
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            if (typeof onCancel === 'function') onCancel();
            closeDialog();
        }
    });

    // Forzar reflow y añadir clase para animar la entrada
    setTimeout(() => dialog.classList.add('visible'), 10);
}