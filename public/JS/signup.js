document.addEventListener('DOMContentLoaded', () => {
    // URL base del servidor backend. Usar una ruta relativa lo hace funcionar tanto en local como en producción (Render).
    const API_BASE_URL = '/api';

    const signupForm = document.getElementById('signup-form');

    // Lógica del tema claro/oscuro
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        const savedTheme = localStorage.getItem('theme');
        document.body.classList.toggle('light-mode', savedTheme === 'light');
        themeToggle.checked = (savedTheme === 'light');
        themeToggle.addEventListener('change', () => {
            document.body.classList.toggle('light-mode', themeToggle.checked);
            localStorage.setItem('theme', themeToggle.checked ? 'light' : 'dark');
        });
    }

    if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const username = document.getElementById('signup-username').value.trim().toLowerCase();
            const password = document.getElementById('signup-password').value;
            const passwordConfirm = document.getElementById('signup-password-confirm').value;
            const errorDisplay = document.getElementById('signup-error');

            errorDisplay.textContent = '';

            if (!username || !password || !passwordConfirm) { errorDisplay.textContent = 'Todos los campos son obligatorios.'; return; }
            if (password.length < 6) { errorDisplay.textContent = 'La contraseña debe tener al menos 6 caracteres.'; return; }
            if (password !== passwordConfirm) { errorDisplay.textContent = 'Las contraseñas no coinciden.'; return; }

            try {
                // Usamos la ruta relativa para que funcione en cualquier servidor
                const response = await fetch(`${API_BASE_URL}/signup`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });
                const data = await response.json();

                if (response.status === 201) {
                    alert("¡Usuario registrado con éxito! Serás redirigido para iniciar sesión.");
                    setTimeout(() => {
                       window.location.href = 'login.html';
                    }, 1500); 
                } else {
                    errorDisplay.textContent = data.message;
                }
            } catch (error) {
                errorDisplay.textContent = 'No se pudo conectar con el servidor. ¿Está encendido?';
                console.error('Error de conexión:', error);
            }
        });
    }
});