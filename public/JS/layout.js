/* ========================================= */
/* ==== NUEVO ARCHIVO: JS/layout.js ==== */
/* ========================================= */

document.addEventListener('DOMContentLoaded', function() {
    const sidebar = document.getElementById('app-sidebar');
    const sidebarToggleBtn = document.getElementById('sidebar-toggle-btn');
    const sidebarLinks = document.querySelectorAll('.sidebar .nav-link');
    const mainContent = document.querySelector('.main-content');
    const body = document.body;

    // --- LÓGICA PARA COLAPSAR/EXPANDIR SIDEBAR ---

    const setSidebarState = (isCollapsed) => {
        if (isCollapsed) {
            body.classList.add('sidebar-collapsed');
            localStorage.setItem('sidebarState', 'collapsed');
        } else {
            body.classList.remove('sidebar-collapsed');
            localStorage.setItem('sidebarState', 'expanded');
        }
    };

    if (sidebarToggleBtn) {
        sidebarToggleBtn.addEventListener('click', () => {
            const isCollapsed = body.classList.contains('sidebar-collapsed');
            setSidebarState(!isCollapsed);
        });
    }

    // Cargar el estado del sidebar al iniciar la página
    const savedState = localStorage.getItem('sidebarState');
    if (savedState === 'collapsed') {
        setSidebarState(true);
    }

    // --- LÓGICA PARA CAMBIAR DE VISTA ---

    const views = document.querySelectorAll('.view-container');

    window.switchView = (viewId, context = null) => {
        views.forEach(view => view.classList.remove('active'));
        
        sidebarLinks.forEach(link => {
            if (!link.classList.contains('logout')) {
                link.classList.remove('active');
            }
        });

        const activeView = document.getElementById(viewId);
        if (activeView) {
            activeView.classList.add('active');
            
            const initFunction = 'initialize' + viewId.charAt(0).toUpperCase() + viewId.slice(1).replace(/-/g, '');
            if(typeof window[initFunction] === 'function') {
                window[initFunction](context);
            }
        } else {
            const homeDashboard = document.getElementById('home-dashboard');
            if (homeDashboard) homeDashboard.classList.add('active');
            
            const homeLink = document.querySelector('.sidebar .nav-link[data-view="home-dashboard"]');
            if (homeLink) homeLink.classList.add('active');
        }

        const activeLink = document.querySelector(`.sidebar .nav-link[data-view="${viewId}"]`);
        if (activeLink) {
            activeLink.classList.add('active');
        }

        if (mainContent) mainContent.scrollTo({ top: 0, behavior: 'smooth' });
    };

    sidebarLinks.forEach(link => {
        if (link.classList.contains('logout')) return;

        link.addEventListener('click', function(e) {
            e.preventDefault();
            const viewId = this.getAttribute('data-view');
            if (viewId) {
                window.switchView(viewId);
            }
        });
    });

    // --- INICIALIZACIÓN DE LA APP ---
    window.switchView('home-dashboard');
});