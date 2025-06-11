document.addEventListener('DOMContentLoaded', () => {
    // Si el usuario ya tiene una sesión, lo mandamos a la app principal
    if (sessionStorage.getItem('contaunoUser')) {
        window.location.href = 'index.html';
    }

    const loginForm = document.getElementById('login-form');
    const signupLink = document.getElementById('signup-link');
    const errorDisplay = document.getElementById('login-error');
    const themeToggle = document.getElementById('theme-toggle');

    // Lógica del tema claro/oscuro
    const savedTheme = localStorage.getItem('theme');
    document.body.classList.toggle('light-mode', savedTheme === 'light');
    if (themeToggle) themeToggle.checked = (savedTheme === 'light');

    if (themeToggle) {
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
                // ===== CORRECCIÓN 1 =====
                const response = await fetch('/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });

                const data = await response.json();

                if (response.ok) {
                    sessionStorage.setItem('contaunoUser', JSON.stringify(data));
                    window.location.href = 'index.html';
                } else {
                    errorDisplay.textContent = data.message;
                }
            } catch (error) {
                errorDisplay.textContent = 'No se pudo conectar con el servidor.';
                console.error('Error de conexión:', error);
            }
        });
    }

    // --- Lógica para la VENTANA MODAL DE REGISTRO ---

    const signupModal = document.getElementById('signup-modal');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const signupFormModal = document.getElementById('signup-form-modal');

    if (signupLink) {
        signupLink.addEventListener('click', (e) => {
            e.preventDefault();
            signupModal.classList.add('active');
        });
    }

    function closeModal() {
        if (signupModal) {
            signupModal.classList.remove('active');
        }
    }

    if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);

    if (signupModal) {
        signupModal.addEventListener('click', (e) => {
            if (e.target === signupModal) {
                closeModal();
            }
        });
    }
    document.addEventListener('keydown', (e) => {
        if (e.key === "Escape" && signupModal.classList.contains('active')) {
            closeModal();
        }
    });
    
    if (signupFormModal) {
        signupFormModal.addEventListener('submit', async (e) => {
            e.preventDefault();

            const usernameInput = document.getElementById('signup-username');
            const passwordInput = document.getElementById('signup-password');
            const passwordConfirmInput = document.getElementById('signup-password-confirm');
            const errorDisplayModal = document.getElementById('signup-modal-error');

            const username = usernameInput.value.trim().toLowerCase();
            const password = passwordInput.value;
            const passwordConfirm = passwordConfirmInput.value;

            errorDisplayModal.textContent = '';

            if (!username || !password) {
                errorDisplayModal.textContent = 'Todos los campos son obligatorios.';
                return;
            }
            if (password.length < 6) {
                errorDisplayModal.textContent = 'La contraseña debe tener al menos 6 caracteres.';
                return;
            }
            if (password !== passwordConfirm) {
                errorDisplayModal.textContent = 'Las contraseñas no coinciden.';
                return;
            }

            try {
                // ===== CORRECCIÓN 2 =====
                const response = await fetch('/api/signup', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });

                const data = await response.json();

                if (response.status === 201) {
                    alert("¡Usuario registrado con éxito! Serás redirigido para iniciar sesión.");
                    window.location.href = 'login.html';
                } else {
                    errorDisplayModal.textContent = data.message;
                }
            } catch (error) {
                errorDisplayModal.textContent = 'No se pudo conectar con el servidor.';
            }
        });
    }
});