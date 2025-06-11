document.addEventListener('DOMContentLoaded', () => {
    const signupForm = document.getElementById('signup-form');

    // Lógica del tema claro/oscuro
    const themeToggle = document.getElementById('theme-toggle');
    const savedTheme = localStorage.getItem('theme');
    document.body.classList.toggle('light-mode', savedTheme === 'light');
    if (themeToggle) themeToggle.checked = (savedTheme === 'light');
    if (themeToggle) {
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

            errorDisplay.textContent = ''; // Limpiar errores

            if (!username || !password || !passwordConfirm) {
                errorDisplay.textContent = 'Todos los campos son obligatorios.';
                return;
            }
            if (password.length < 6) {
                errorDisplay.textContent = 'La contraseña debe tener al menos 6 caracteres.';
                return;
            }
            if (password !== passwordConfirm) {
                errorDisplay.textContent = 'Las contraseñas no coinciden.';
                return;
            }

            try {
                const response = await fetch('http://localhost:3000/api/signup', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });

                const data = await response.json();

                if (response.status === 201) {
                    alert("¡Usuario registrado con éxito! Serás redirigido para iniciar sesión.");
                    window.location.href = 'login.html'; // Redirige al login
                } else {
                    errorDisplay.textContent = data.message;
                }
            } catch (error) {
                errorDisplay.textContent = 'No se pudo conectar con el servidor.';
            }
        });
    }
});