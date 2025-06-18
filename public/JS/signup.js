// JS/signup.js (Versión corregida para funcionar con Firebase)

document.addEventListener('DOMContentLoaded', () => {
    // Referencias a los elementos del DOM
    const signupForm = document.getElementById('signup-form');
    const googleBtn = document.getElementById('google-signup-btn');
    const facebookBtn = document.getElementById('facebook-signup-btn');
    const errorDisplay = document.getElementById('signup-error');
    const themeToggle = document.getElementById('theme-toggle');

    /**
     * Esta función se ejecuta después de un registro exitoso para crear el perfil
     * del usuario en la base de datos y redirigirlo a donde deba ir.
     */
    const handleSuccessfulLogin = async (firebaseUser) => {
        const { uid, displayName, email } = firebaseUser;
        const userDocRef = db.collection('users').doc(uid);
        const userDoc = await userDocRef.get();

        sessionStorage.setItem('contaunoUser', JSON.stringify({
            uid: uid,
            username: displayName,
            email: email
        }));

        if (!userDoc.exists) {
            // El usuario es NUEVO. Lo creamos en Firestore.
            await userDocRef.set({
                username: displayName || "Usuario",
                email: email,
                createdAt: new Date(),
                profileCompleted: false // Marcamos que debe llenar el formulario de perfil.
            });
            // Lo redirigimos a la página para completar su perfil.
            window.location.href = 'complete-profile.html';
        } else {
            // El usuario YA EXISTE. Verificamos si completó su perfil.
            const userData = userDoc.data();
            if (!userData.profileCompleted) {
                window.location.href = 'complete-profile.html';
            } else {
                window.location.href = 'index.html';
            }
        }
    };

    /** Muestra errores de autenticación en la UI */
    const handleAuthError = (error) => {
        console.error("Error de autenticación:", error);
        let message = "Ocurrió un error. Inténtalo de nuevo.";
        if (error.code === 'auth/email-already-in-use') {
            message = 'Este correo electrónico ya está registrado.';
        } else if (error.code === 'auth/popup-closed-by-user') {
            message = "La ventana de inicio de sesión fue cerrada.";
        } else if (error.code === 'auth/unauthorized-domain') {
            message = "Dominio no autorizado. Revisa la configuración de Firebase."
        }
        errorDisplay.textContent = message;
    };
    
    // --- LÓGICA DE REGISTRO CON GOOGLE Y FACEBOOK ---
    const signUpWithGoogle = (e) => {
        e.preventDefault();
        const provider = new firebase.auth.GoogleAuthProvider();
        auth.signInWithPopup(provider).then(result => handleSuccessfulLogin(result.user)).catch(handleAuthError);
    };
    const signUpWithFacebook = (e) => {
        e.preventDefault();
        const provider = new firebase.auth.FacebookAuthProvider();
        auth.signInWithPopup(provider).then(result => handleSuccessfulLogin(result.user)).catch(handleAuthError);
    };

    if (googleBtn) googleBtn.addEventListener('click', signUpWithGoogle);
    if (facebookBtn) facebookBtn.addEventListener('click', signUpWithFacebook);

    // --- LÓGICA DEL FORMULARIO DE REGISTRO CON CORREO ---
    if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const username = document.getElementById('signup-username').value.trim();
            const email = document.getElementById('signup-email').value.trim(); // Necesitamos el campo de email
            const password = document.getElementById('signup-password').value;
            const passwordConfirm = document.getElementById('signup-password-confirm').value;

            errorDisplay.textContent = '';

            // Tus validaciones originales, ahora incluyendo el email
            if (!username || !email || !password || !passwordConfirm) { errorDisplay.textContent = 'Todos los campos son obligatorios.'; return; }
            if (password.length < 6) { errorDisplay.textContent = 'La contraseña debe tener al menos 6 caracteres.'; return; }
            if (password !== passwordConfirm) { errorDisplay.textContent = 'Las contraseñas no coinciden.'; return; }

            try {
                // AQUÍ ESTÁ EL CAMBIO PRINCIPAL:
                // En lugar de fetch, usamos la función de Firebase para crear el usuario.
                const userCredential = await auth.createUserWithEmailAndPassword(email, password);
                const user = userCredential.user;

                // Le asignamos el nombre de usuario a su perfil de Firebase.
                await user.updateProfile({ displayName: username });
                
                // Llamamos a nuestra función centralizada que crea el perfil en la base de datos
                // y lo redirige a la página para completar sus datos.
                await handleSuccessfulLogin(user);

            } catch (error) {
                // Si Firebase devuelve un error (ej: email ya existe), lo mostramos.
                handleAuthError(error);
            }
        });
    }

    // --- Lógica del tema claro/oscuro (de tu código original) ---
    if (themeToggle) {
        const savedTheme = localStorage.getItem('theme');
        document.body.classList.toggle('light-mode', savedTheme === 'light');
        themeToggle.checked = (savedTheme === 'light');
        themeToggle.addEventListener('change', () => {
            document.body.classList.toggle('light-mode', themeToggle.checked);
            localStorage.setItem('theme', themeToggle.checked ? 'light' : 'dark');
        });
    }
});