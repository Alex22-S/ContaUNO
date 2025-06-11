document.addEventListener('DOMContentLoaded', () => {

    // --- LÓGICA MODO CLARO/OSCURO ---
    const themeToggle = document.getElementById('theme-toggle');
    const body = document.body;

    const setTheme = (isLight) => {
        if (isLight) {
            body.classList.add('light-mode');
            themeToggle.checked = true;
            localStorage.setItem('theme', 'light');
        } else {
            body.classList.remove('light-mode');
            themeToggle.checked = false;
            localStorage.setItem('theme', 'dark');
        }
    };

    themeToggle.addEventListener('change', () => {
        setTheme(themeToggle.checked);
    });

    const savedTheme = localStorage.getItem('theme');
    setTheme(savedTheme === 'light');

    // --- ELEMENTOS FLOTANTES ANIMADOS ---
    function createFloatingElements() {
        const container = document.getElementById('floatingElements');
        if (!container) return;
        container.innerHTML = '';
        for (let i = 0; i < 50; i++) {
            const element = document.createElement('div');
            element.className = 'floating-element';
            element.style.left = Math.random() * 100 + '%';
            element.style.animationDelay = Math.random() * 15 + 's';
            element.style.animationDuration = (15 + Math.random() * 10) + 's';
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
        el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
        observer.observe(el);
    });
});

// --- NAVEGACIÓN Y FILTROS (FUNCIONES GLOBALES) ---

function hideAllViews() {
    document.getElementById('hero').style.display = 'none';
    document.querySelectorAll('.dashboard').forEach(d => d.classList.remove('active'));
    document.getElementById('calendar-view').classList.remove('active');
    document.getElementById('form-view').classList.remove('active'); // AÑADIDO: Oculta la vista del formulario
}

function showDashboard(level) {
    hideAllViews();
    const dashboard = document.getElementById(level + '-dashboard');
    if (dashboard) {
        dashboard.classList.add('active');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showHero() {
    hideAllViews();
    const hero = document.getElementById('hero');
    if (hero) {
        hero.style.display = 'flex';
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showCalendar() {
    hideAllViews();
    const calendarView = document.getElementById('calendar-view');
    calendarView.classList.add('active');
    
    // Inicializa o actualiza el calendario cada vez que se muestra
    // Se asegura de que el calendario muestre el mes y año actual al abrirse
    if (typeof initializeCalendar === 'function') {
        const currentDate = new Date();
        const monthSelect = document.getElementById('month-select');
        const yearSelect = document.getElementById('year-select');

        // Solo se actualiza si el calendario no tiene ya una fecha seleccionada
        // para no perder el contexto al volver del formulario.
        if (!calendarView.dataset.context) {
             if(monthSelect) monthSelect.value = currentDate.getMonth();
             if(yearSelect) yearSelect.value = currentDate.getFullYear();
        }
        
        updateCalendar();
        delete calendarView.dataset.context; // Limpiar contexto
    }
     window.scrollTo({ top: 0, behavior: 'smooth' });
}

function filterFunctions(query, level) {
    const functions = document.querySelectorAll(`#${level}-functions .function-card`);
    const searchTerm = query.toLowerCase().trim();
    
    functions.forEach(card => {
        const title = card.querySelector('.function-title').textContent.toLowerCase();
        const description = card.querySelector('.function-description').textContent.toLowerCase();
        
        if (title.includes(searchTerm) || description.includes(searchTerm)) {
            card.style.display = 'block';
        } else {
            card.style.display = 'none';
        }
    });
}