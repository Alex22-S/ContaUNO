// ===================================================================
// ================= SISTEMA DE NOTIFICACIONES =======================
// ===================================================================

/**
 * Muestra una notificación en la pantalla.
 * @param {string} message - El mensaje a mostrar.
 * @param {string} type - El tipo de notificación ('success', 'error', 'info', 'warning').
 * @param {number} duration - La duración en milisegundos antes de que desaparezca.
 */
function showNotification(message, type = 'info', duration = 4000) {
    const container = document.getElementById('notification-container');
    if (!container) {
        console.error('El contenedor de notificaciones no se encuentra en el DOM.');
        return;
    }

    // Crear el elemento de la notificación
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    
    const messageSpan = document.createElement('span');
    messageSpan.textContent = message;

    const closeButton = document.createElement('button');
    closeButton.className = 'close-btn';
    closeButton.innerHTML = '&times;';
    
    notification.appendChild(messageSpan);
    notification.appendChild(closeButton);

    // Función para cerrar la notificación
    const closeNotification = () => {
        notification.classList.remove('show');
        // Esperar a que termine la animación de salida para eliminar el elemento
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 400); // La duración debe coincidir con la transición en CSS
    };

    closeButton.addEventListener('click', closeNotification);
    container.appendChild(notification);

    // Forzar un reflujo para que la animación de entrada funcione
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);

    // Temporizador para cerrar automáticamente la notificación
    setTimeout(closeNotification, duration);
}


// ===================================================================
// ================= DIÁLOGO DE CONFIRMACIÓN =========================
// ===================================================================

/**
 * Muestra un diálogo de confirmación personalizable.
 * @param {object} options - Opciones para el diálogo.
 * @param {string} options.title - El título del diálogo.
 * @param {string} options.message - El mensaje principal.
 * @param {string} [options.confirmText='Confirmar'] - Texto del botón de confirmación.
 * @param {string} [options.cancelText='Cancelar'] - Texto del botón de cancelación.
 * @returns {Promise<boolean>} - Una promesa que se resuelve a `true` si se confirma, `false` si se cancela.
 */
function showConfirmation({ title, message, confirmText = 'Confirmar', cancelText = 'Cancelar' }) {
    return new Promise((resolve) => {
        // Evitar múltiples diálogos
        if (document.querySelector('.confirmation-overlay')) {
            return;
        }

        // Crear el overlay
        const overlay = document.createElement('div');
        overlay.className = 'confirmation-overlay';

        // Crear el diálogo
        overlay.innerHTML = `
            <div class="confirmation-dialog">
                <h3 class="confirmation-title">${title}</h3>
                <p class="confirmation-message">${message}</p>
                <div class="confirmation-actions">
                    <button class="btn-cancel">${cancelText}</button>
                    <button class="btn-confirm">${confirmText}</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        const btnConfirm = overlay.querySelector('.btn-confirm');
        const btnCancel = overlay.querySelector('.btn-cancel');
        const dialog = overlay.querySelector('.confirmation-dialog');

        // Función para cerrar el diálogo
        const closeDialog = (value) => {
            overlay.classList.add('closing');
            dialog.addEventListener('transitionend', () => {
                document.body.removeChild(overlay);
                resolve(value);
            }, { once: true });
        };
        
        // Asignar eventos
        btnConfirm.addEventListener('click', () => closeDialog(true));
        btnCancel.addEventListener('click', () => closeDialog(false));
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                closeDialog(false);
            }
        });

        // Mostrar el diálogo
        setTimeout(() => {
            overlay.classList.add('visible');
        }, 10); // Pequeño delay para activar la transición
    });
}