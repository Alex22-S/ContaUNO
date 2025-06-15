document.addEventListener('DOMContentLoaded', () => {
    // URL base del servidor backend. Usar una ruta relativa lo hace funcionar tanto en local como en producción (Render).
    const API_BASE_URL = '/api';

    // Si el usuario ya tiene una sesión en sessionStorage, lo redirigimos
    if (sessionStorage.getItem('contaunoUser')) {
        window.location.href = 'index.html';
    }

    const loginForm = document.getElementById('login-form');
    const errorDisplay = document.getElementById('login-error');
    const themeToggle = document.getElementById('theme-toggle');

    // Lógica del tema claro/oscuro
    if (themeToggle) {
        const savedTheme = localStorage.getItem('theme');
        document.body.classList.toggle('light-mode', savedTheme === 'light');
        themeToggle.checked = (savedTheme === 'light');

        themeToggle.addEventListener('change', () => {
            document.body.classList.toggle('light-mode', themeToggle.checked);
            localStorage.setItem('theme', themeToggle.checked ? 'light' : 'dark');
        });
    }

    // --- Lógica del FORMULARIO DE LOGIN ---
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = e.target.username.value.trim().toLowerCase();
            const password = e.target.password.value;
            errorDisplay.textContent = '';

            try {
                const response = await fetch(`${API_BASE_URL}/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });
                
                const data = await response.json();

                if (response.ok) {
                    // --- LÓGICA CLAVE ---
                    // 1. Guardamos el token en localStorage para usarlo en futuras peticiones
                    localStorage.setItem('contaunoToken', data.token);
                    
                    // 2. Guardamos info del usuario para mostrar en la UI si es necesario
                    sessionStorage.setItem('contaunoUser', JSON.stringify({ username }));

                    // 3. Redirigimos a la aplicación principal
                    window.location.href = 'index.html';
                } else {
                    // Si el login falla, limpiamos cualquier token viejo que pudiera existir
                    localStorage.removeItem('contaunoToken');
                    sessionStorage.removeItem('contaunoUser');
                    errorDisplay.textContent = data.message;
                }
            } catch (error) {
                errorDisplay.textContent = 'No se pudo conectar con el servidor.';
                console.error('Error de conexión:', error);
            }
        });
    }
});