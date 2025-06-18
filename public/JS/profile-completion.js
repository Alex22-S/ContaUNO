document.addEventListener('DOMContentLoaded', () => {
    const profileForm = document.getElementById('profile-form');
    if (!profileForm) return;

    const errorDisplay = document.getElementById('profile-error');
    const submitBtn = document.getElementById('submit-btn');
    const btnText = submitBtn.querySelector('.btn-text');
    
    const accountTypeRadios = document.querySelectorAll('input[name="account-type"]');
    const businessFieldsContainer = document.getElementById('business-fields');
    const businessNameInput = document.getElementById('business-name');

    // Función para mostrar/ocultar campos de negocio con animación
    const toggleBusinessFields = () => {
        const selectedType = document.querySelector('input[name="account-type"]:checked').value;
        if (selectedType === 'business') {
            businessFieldsContainer.classList.add('visible');
            businessNameInput.required = true; // Hace el campo obligatorio
        } else {
            businessFieldsContainer.classList.remove('visible');
            businessNameInput.required = false; // El campo deja de ser obligatorio
        }
    };

    accountTypeRadios.forEach(radio => {
        radio.addEventListener('change', toggleBusinessFields);
    });
    
    // Inicializar el estado de los campos al cargar la página
    toggleBusinessFields();

    // Función para gestionar el estado de carga del botón
    const setLoading = (isLoading) => {
        if (isLoading) {
            submitBtn.classList.add('is-loading');
            submitBtn.disabled = true;
        } else {
            submitBtn.classList.remove('is-loading');
            submitBtn.disabled = false;
        }
    };

    firebase.auth().onAuthStateChanged(user => {
        if (!user) {
            // Si no hay usuario, redirigir al login
            window.location.href = 'login.html';
            return;
        }

        profileForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            errorDisplay.textContent = ''; // Limpiar errores previos

            const accountType = document.querySelector('input[name="account-type"]:checked').value;
            const businessName = document.getElementById('business-name').value.trim();

            // Validación
            if (accountType === 'business' && !businessName) {
                errorDisplay.textContent = 'El nombre del negocio es obligatorio.';
                businessNameInput.focus();
                return;
            }

            setLoading(true);

            // Preparar el objeto de datos a guardar
            const dataToSave = {
                phone: document.getElementById('phone-number').value.trim(),
                accountType: accountType,
                profileCompleted: true,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            if (accountType === 'business') {
                dataToSave.businessDetails = {
                    name: businessName,
                    id: document.getElementById('business-id').value.trim()
                };
            }

            try {
                const userDocRef = firebase.firestore().collection('users').doc(user.uid);
                // Usamos .set con { merge: true } para crear o actualizar el documento de forma segura
                await userDocRef.set(dataToSave, { merge: true }); 
                
                // Redirigir a la página principal tras el éxito
                window.location.href = 'index.html';

            } catch (error) {
                console.error("Error al actualizar el perfil:", error);
                errorDisplay.textContent = 'No se pudo guardar tu información. Inténtalo de nuevo.';
                setLoading(false); // Detener la carga en caso de error
            }
        });
    });
});