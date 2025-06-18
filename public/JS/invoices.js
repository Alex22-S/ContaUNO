document.addEventListener('DOMContentLoaded', () => {
    // Si no existe el formulario principal, salimos para no ejecutar el script en otras vistas
    if (!document.getElementById('invoice-form')) return;

    // --- REFERENCIAS AL DOM ---
    const invoiceForm = document.getElementById('invoice-form');
    const itemsContainer = document.getElementById('invoice-items-container');
    const addInvoiceItemBtn = document.getElementById('add-invoice-item-btn');
    const invoicesList = document.getElementById('invoices-list');
    const formTitle = document.getElementById('invoice-form-title');
    const hiddenEditingId = document.getElementById('editing-invoice-id');
    const cancelEditBtn = document.getElementById('cancel-edit-invoice-btn');

    // --- REFERENCIAS A TOTALES ---
    const subtotalDisplay = document.getElementById('subtotal-display');
    const discountDisplay = document.getElementById('discount-display');
    const taxDisplay = document.getElementById('tax-display');
    const totalDisplay = document.getElementById('total-display');

    // --- REFERENCIAS A MODALES Y CONFIGURACIÓN ---
    const settingsModal = document.getElementById('settings-modal');
    const invoicePreviewModal = document.getElementById('invoice-preview-modal');
    const btnOpenSettings = document.getElementById('btn-open-settings');
    const settingsForm = document.getElementById('settings-form');
    const companyLogoInput = document.getElementById('company-logo-input');
    const logoPreview = document.getElementById('logo-preview');
    
    // --- LÓGICA DE DATOS (LocalStorage) ---
    const getInvoices = () => JSON.parse(localStorage.getItem('invoices')) || [];
    const saveInvoices = (invoices) => localStorage.setItem('invoices', JSON.stringify(invoices));
    const getCompanyInfo = () => JSON.parse(localStorage.getItem('myCompanyInfo')) || {};
    const saveCompanyInfo = (info) => localStorage.setItem('myCompanyInfo', JSON.stringify(info));
    const getCompanyLogo = () => localStorage.getItem('myCompanyLogo') || '';
    const saveCompanyLogo = (logo) => localStorage.setItem('myCompanyLogo', logo);

    // --- FORMATEADOR DE MONEDA (COP) ---
    const formatCurrency = (value) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);

    // --- CÁLCULO DE TOTALES ---
    const updateInvoiceTotals = () => {
        let subtotal = 0;
        itemsContainer.querySelectorAll('.invoice-item-row').forEach(row => {
            const quantity = parseFloat(row.querySelector('.item-quantity').value) || 0;
            const price = parseFloat(row.querySelector('.item-price').value) || 0;
            subtotal += quantity * price;
        });

        const discountPercent = parseFloat(document.getElementById('invoice-discount').value) || 0;
        const taxPercent = parseFloat(document.getElementById('invoice-tax').value) || 0;

        const discountAmount = subtotal * (discountPercent / 100);
        const subtotalAfterDiscount = subtotal - discountAmount;
        const taxAmount = subtotalAfterDiscount * (taxPercent / 100);
        const finalTotal = subtotalAfterDiscount + taxAmount;

        subtotalDisplay.textContent = formatCurrency(subtotal);
        discountDisplay.textContent = `- ${formatCurrency(discountAmount)}`;
        taxDisplay.textContent = `+ ${formatCurrency(taxAmount)}`;
        totalDisplay.textContent = formatCurrency(finalTotal);
    };

    // --- GESTIÓN DE ITEMS EN FORMULARIO ---
    const addInvoiceItemRow = (item = {}) => {
        const row = document.createElement('div');
        row.className = 'invoice-item-row';
        row.innerHTML = `
            <input type="text" class="item-description" placeholder="Descripción del producto o servicio" required value="${item.description || ''}">
            <input type="number" class="item-quantity" placeholder="Cant." value="${item.quantity || 1}" min="1" required>
            <input type="number" class="item-price" placeholder="Precio Unit." step="0.01" min="0" required value="${item.price || ''}">
            <button type="button" class="delete-item-btn" title="Eliminar ítem">✖</button>
        `;
        itemsContainer.appendChild(row);
        row.querySelector('.delete-item-btn').addEventListener('click', () => { row.remove(); updateInvoiceTotals(); });
        row.querySelectorAll('input').forEach(input => input.addEventListener('input', updateInvoiceTotals));
    };

    // --- ESTADO Y RENDERIZADO DE FACTURAS ---
    const getInvoiceStatus = (invoice) => {
        if (invoice.status === 'paid') return { text: 'Pagada', className: 'paid' };
        
        const dueDate = new Date(invoice.dueDate + 'T23:59:59'); // Considerar el día completo
        const today = new Date();
        
        if (dueDate < today) return { text: 'Vencida', className: 'overdue' };
        return { text: 'Pendiente', className: 'unpaid' };
    };

    window.renderInvoices = () => {
        const invoices = getInvoices().sort((a, b) => new Date(b.issueDate) - new Date(a.issueDate));
        invoicesList.innerHTML = '';
        if (invoices.length === 0) {
            invoicesList.innerHTML = '<p style="text-align:center; color: var(--text-secondary); padding: 2rem 0;">Aún no has creado ninguna factura.</p>';
            return;
        }
        invoices.forEach(invoice => {
            const status = getInvoiceStatus(invoice);
            const listItem = document.createElement('div');
            listItem.className = 'invoice-list-item';
            listItem.innerHTML = `
                <div class="invoice-item-info">
                    <h4>${invoice.clientName}</h4>
                    <p>#${invoice.invoiceNumber} | Total: <span class="total">${formatCurrency(invoice.total)}</span></p>
                </div>
                <div class="invoice-item-status">
                    <span class="status ${status.className}">${status.text}</span>
                </div>
                <div class="invoice-item-actions">
                    <button class="view-btn" data-id="${invoice.id}" title="Ver Detalle">Ver</button>
                    <button class="edit-btn" data-id="${invoice.id}" title="Editar Factura">Editar</button>
                    <button class="delete-btn" data-id="${invoice.id}" title="Eliminar Factura">Eliminar</button>
                </div>
            `;
            invoicesList.appendChild(listItem);
        });
    };

    // --- RESETEAR FORMULARIO ---
    const resetForm = () => {
        invoiceForm.reset();
        hiddenEditingId.value = '';
        itemsContainer.innerHTML = '';
        addInvoiceItemRow(); // Añadir la primera fila por defecto
        formTitle.textContent = 'Crear Nueva Factura';
        const nextInvoiceNumber = (getInvoices().length > 0) ? Math.max(...getInvoices().map(i => parseInt(i.invoiceNumber) || 0)) + 1 : 1;
        document.getElementById('invoice-number').value = nextInvoiceNumber;
        document.getElementById('issue-date').value = new Date().toISOString().slice(0, 10);
        cancelEditBtn.style.display = 'none';
        updateInvoiceTotals();
    };

    // --- LÓGICA DE EDICIÓN ---
    const editInvoice = (id) => {
        const invoice = getInvoices().find(inv => inv.id === id);
        if (!invoice) return;

        resetForm();
        formTitle.textContent = `Editando Factura #${invoice.invoiceNumber}`;
        hiddenEditingId.value = invoice.id;
        cancelEditBtn.style.display = 'block';

        document.getElementById('invoice-number').value = invoice.invoiceNumber;
        document.getElementById('issue-date').value = invoice.issueDate;
        document.getElementById('due-date').value = invoice.dueDate;
        document.getElementById('client-name').value = invoice.clientName;
        document.getElementById('client-id').value = invoice.clientId;
        document.getElementById('client-address').value = invoice.clientAddress || '';
        document.getElementById('client-phone').value = invoice.clientPhone || '';
        document.getElementById('invoice-discount').value = invoice.discountPercent;
        document.getElementById('invoice-tax').value = invoice.taxPercent;
        document.getElementById('invoice-notes').value = invoice.notes || '';

        itemsContainer.innerHTML = ''; 
        invoice.items.forEach(item => addInvoiceItemRow(item));
        
        updateInvoiceTotals();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // --- EVENT HANDLER PRINCIPAL (SUBMIT) ---
    invoiceForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const id = hiddenEditingId.value;
        const totalText = totalDisplay.textContent;
        const totalNumber = parseFloat(totalText.replace(/[^0-9,-]+/g, "").replace(',', '.'));

        const currentInvoiceData = {
            id: id || `INV-${Date.now()}`,
            invoiceNumber: document.getElementById('invoice-number').value,
            issueDate: document.getElementById('issue-date').value,
            dueDate: document.getElementById('due-date').value,
            clientName: document.getElementById('client-name').value,
            clientId: document.getElementById('client-id').value,
            clientAddress: document.getElementById('client-address').value,
            clientPhone: document.getElementById('client-phone').value,
            items: Array.from(itemsContainer.querySelectorAll('.invoice-item-row')).map(row => ({
                description: row.querySelector('.item-description').value,
                quantity: parseFloat(row.querySelector('.item-quantity').value),
                price: parseFloat(row.querySelector('.item-price').value),
            })),
            discountPercent: parseFloat(document.getElementById('invoice-discount').value) || 0,
            taxPercent: parseFloat(document.getElementById('invoice-tax').value) || 0,
            notes: document.getElementById('invoice-notes').value,
            total: totalNumber,
            status: 'unpaid' // Siempre se guarda como no pagada inicialmente
        };

        let invoices = getInvoices();
        if (id) {
            const originalInvoice = invoices.find(inv => inv.id === id);
            currentInvoiceData.status = originalInvoice ? originalInvoice.status : 'unpaid'; // Mantiene el estado si se edita
            invoices = invoices.map(inv => inv.id === id ? currentInvoiceData : inv);
            showNotification('Factura actualizada con éxito.', 'success');
        } else { 
            invoices.push(currentInvoiceData);
            showNotification('Factura creada con éxito.', 'success');
        }
        
        saveInvoices(invoices);
        resetForm();
        renderInvoices();
    });

    // --- MANEJO DE ACCIONES EN LISTA ---
    invoicesList.addEventListener('click', (e) => {
        const button = e.target.closest('button');
        if (!button) return;

        const id = button.dataset.id;
        if (!id) return;

        if (button.classList.contains('delete-btn')) {
            showConfirmationDialog({
                title: '¿Eliminar Factura?',
                message: `Estás a punto de eliminar la factura #${getInvoices().find(i=>i.id === id).invoiceNumber}. Esta acción es permanente.`,
                confirmText: 'Sí, Eliminar',
                onConfirm: () => {
                    saveInvoices(getInvoices().filter(inv => inv.id !== id));
                    renderInvoices();
                    resetForm();
                    showNotification('Factura eliminada.', 'info');
                }
            });
        }
        if (button.classList.contains('edit-btn')) editInvoice(id);
        if (button.classList.contains('view-btn')) viewInvoice(id);
    });

    // --- LÓGICA DE CONFIGURACIÓN ---
    btnOpenSettings.addEventListener('click', () => {
        const info = getCompanyInfo();
        Object.keys(info).forEach(key => {
            const input = settingsForm.querySelector(`#${key}`);
            if(input) input.value = info[key];
        });
        logoPreview.src = getCompanyLogo() || '';
        settingsModal.style.display = 'flex';
    });

    settingsForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const formData = new FormData(settingsForm);
        const companyInfo = {};
        for(const [key, value] of formData.entries()){
            if(key !== 'company-logo-input') companyInfo[key] = value;
        }
        saveCompanyInfo(companyInfo);
        showNotification('Configuración guardada.', 'success');
        settingsModal.style.display = 'none';
    });

    companyLogoInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if(!file) return;
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64String = reader.result;
            saveCompanyLogo(base64String);
            logoPreview.src = base64String;
        };
        reader.readAsDataURL(file);
    });
    
    // --- LÓGICA DEL MODAL DE VISTA PREVIA ---
    const viewInvoice = (id) => {
        const invoice = getInvoices().find(inv => inv.id === id);
        if(!invoice) {
            showNotification('No se pudo encontrar la factura.', 'error');
            return;
        }
        const company = getCompanyInfo();
        const logo = getCompanyLogo();

        document.getElementById('preview-logo').src = logo;
        document.getElementById('preview-logo').style.display = logo ? 'block' : 'none';
        document.getElementById('preview-invoice-title').textContent = `FACTURA DE VENTA #${invoice.invoiceNumber}`;
        document.getElementById('preview-invoice-id').textContent = `ID: ${invoice.id}`;
        
        document.getElementById('my-company-name').textContent = company.myCompanyName || 'Tu Nombre o Empresa';
        document.getElementById('my-company-details').innerHTML = `${company.myCompanyNit || 'Tu NIT/C.C.'}<br>${company.myCompanyAddress || 'Tu Dirección'}<br>${company.myCompanyPhone || 'Tu Teléfono'}`;
        
        document.getElementById('client-info-name').textContent = invoice.clientName;
        document.getElementById('client-info-details').innerHTML = `NIT/C.C: ${invoice.clientId}<br>${invoice.clientAddress || ''}<br>${invoice.clientPhone || ''}`;
        
        const issueDate = new Date(invoice.issueDate + 'T00:00:00');
        const dueDate = new Date(invoice.dueDate + 'T00:00:00');
        const dateOptions = { year: 'numeric', month: 'long', day: 'numeric' };
        document.getElementById('preview-issue-date').textContent = issueDate.toLocaleDateString('es-ES', dateOptions);
        document.getElementById('preview-due-date').textContent = dueDate.toLocaleDateString('es-ES', dateOptions);

        const itemsTbody = document.getElementById('preview-items-tbody');
        itemsTbody.innerHTML = '';
        let subtotal = 0;
        invoice.items.forEach(item => {
            const itemTotal = item.quantity * item.price;
            subtotal += itemTotal;
            itemsTbody.innerHTML += `<tr><td>${item.description}</td><td class="text-right">${item.quantity}</td><td class="text-right">${formatCurrency(item.price)}</td><td class="text-right">${formatCurrency(itemTotal)}</td></tr>`;
        });

        const discountAmount = subtotal * (invoice.discountPercent / 100);
        const subtotalAfterDiscount = subtotal - discountAmount;
        const taxAmount = subtotalAfterDiscount * (invoice.taxPercent / 100);
        document.getElementById('preview-subtotal').textContent = formatCurrency(subtotal);
        document.getElementById('preview-discount').textContent = `-${formatCurrency(discountAmount)} (${invoice.discountPercent}%)`;
        document.getElementById('preview-tax').textContent = `+${formatCurrency(taxAmount)} (${invoice.taxPercent}%)`;
        document.getElementById('preview-grand-total').textContent = formatCurrency(invoice.total);

        document.getElementById('preview-notes').textContent = invoice.notes || 'Gracias por su compra.';
        
        const btnMarkPaid = document.getElementById('btn-mark-paid');
        btnMarkPaid.onclick = () => markInvoiceAsPaid(id);
        btnMarkPaid.style.display = invoice.status === 'paid' ? 'none' : 'inline-flex';

        document.getElementById('btn-download-pdf-preview').onclick = () => generateInvoicePDF(invoice);

        invoicePreviewModal.style.display = 'flex';
    };

    const markInvoiceAsPaid = (id) => {
        let invoices = getInvoices();
        const invoiceIndex = invoices.findIndex(inv => inv.id === id);
        if (invoiceIndex > -1) {
            invoices[invoiceIndex].status = 'paid';
            saveInvoices(invoices);
            invoicePreviewModal.style.display = 'none';
            renderInvoices();
            showNotification('Factura marcada como pagada.', 'success');
        }
    };
    
    // --- GENERACIÓN DE PDF PROFESIONAL ---
    const generateInvoicePDF = (invoice) => {
        if (typeof window.jspdf === 'undefined' || typeof window.jspdf.autoTable === 'undefined') {
            showNotification('Error: La librería para generar PDF no está disponible.', 'error');
            return;
        }
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        const company = getCompanyInfo();
        const logo = getCompanyLogo();

        // Logo y Cabecera de Factura
        if (logo) doc.addImage(logo, 'PNG', 15, 15, 40, 20);
        doc.setFontSize(20);
        doc.setFont(undefined, 'bold');
        doc.text(`Factura de Venta #${invoice.invoiceNumber}`, 200, 25, { align: 'right' });
        doc.setFontSize(10);
        doc.setFont(undefined, 'normal');
        doc.text(`ID: ${invoice.id}`, 200, 32, { align: 'right' });

        // Información de Empresa y Cliente
        doc.setLineWidth(0.5);
        doc.line(15, 40, 200, 40);
        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        doc.text('DE:', 15, 48);
        doc.setFont(undefined, 'normal');
        doc.text(doc.splitTextToSize(`${company.myCompanyName || 'Tu Empresa'}\nNIT/C.C: ${company.myCompanyNit || ''}\n${company.myCompanyAddress || ''}\n${company.myCompanyPhone || ''}`, 80), 15, 54);
        
        doc.setFont(undefined, 'bold');
        doc.text('PARA:', 110, 48);
        doc.setFont(undefined, 'normal');
        doc.text(doc.splitTextToSize(`${invoice.clientName}\nNIT/C.C: ${invoice.clientId}\n${invoice.clientAddress || ''}\n${invoice.clientPhone || ''}`, 80), 110, 54);
        
        // Fechas
        const dateOptions = { year: 'numeric', month: 'long', day: 'numeric' };
        doc.setFont(undefined, 'bold');
        doc.text('Fecha de Emisión:', 15, 85);
        doc.setFont(undefined, 'normal');
        doc.text(new Date(invoice.issueDate + 'T00:00:00').toLocaleDateString('es-ES', dateOptions), 50, 85);
        
        doc.setFont(undefined, 'bold');
        doc.text('Fecha de Vencimiento:', 110, 85);
        doc.setFont(undefined, 'normal');
        doc.text(new Date(invoice.dueDate + 'T00:00:00').toLocaleDateString('es-ES', dateOptions), 155, 85);
        doc.line(15, 90, 200, 90);

        // Tabla de Ítems
        const head = [['Descripción', 'Cant.', 'P. Unitario', 'Total']];
        const body = invoice.items.map(item => [item.description, item.quantity, formatCurrency(item.price), formatCurrency(item.quantity * item.price)]);
        
        doc.autoTable({
            head, body,
            startY: 95,
            headStyles: { fillColor: [22, 160, 133], textColor: [255,255,255] }, // Verde corporativo
            styles: { fontSize: 10, cellPadding: 2.5 },
            columnStyles: {
                0: { cellWidth: 85 },
                1: { cellWidth: 15, halign: 'right' },
                2: { cellWidth: 35, halign: 'right' },
                3: { cellWidth: 35, halign: 'right' },
            },
            didDrawPage: (data) => {
                const finalY = data.cursor.y + 10;
                let subtotal = invoice.items.reduce((sum, i) => sum + i.quantity * i.price, 0);
                let discount = subtotal * (invoice.discountPercent/100);
                let tax = (subtotal - discount) * (invoice.taxPercent/100);

                // Totales
                doc.setFontSize(10);
                doc.text('Subtotal:', 140, finalY);
                doc.text(formatCurrency(subtotal), 200, finalY, { align: 'right' });
                doc.text(`Descuento (${invoice.discountPercent}%):`, 140, finalY + 7);
                doc.text(`- ${formatCurrency(discount)}`, 200, finalY + 7, { align: 'right' });
                doc.text(`Impuesto (${invoice.taxPercent}%):`, 140, finalY + 14);
                doc.text(`+ ${formatCurrency(tax)}`, 200, finalY + 14, { align: 'right' });
                
                doc.setLineWidth(0.2);
                doc.line(140, finalY + 18, 200, finalY + 18);
                
                doc.setFontSize(12);
                doc.setFont(undefined, 'bold');
                doc.text('TOTAL:', 140, finalY + 24);
                doc.text(formatCurrency(invoice.total), 200, finalY + 24, { align: 'right' });

                // Notas
                const notesY = finalY + 40;
                doc.setFontSize(9);
                doc.setFont(undefined, 'bold');
                doc.text('Notas y Términos de Pago:', 15, notesY);
                doc.setFont(undefined, 'normal');
                doc.text(doc.splitTextToSize(invoice.notes || 'Gracias por su negocio.', 180), 15, notesY + 5);

                // Pie de página
                const pageCount = doc.internal.getNumberOfPages();
                for (let i = 1; i <= pageCount; i++) {
                    doc.setPage(i);
                    doc.setFontSize(8).text(`Página ${i} de ${pageCount}`, 15, 290);
                    doc.setFontSize(8).text(`Factura generada con ContaUNO`, 200, 290, { align: 'right' });
                }
            }
        });
        
        doc.save(`Factura-${invoice.invoiceNumber}-${invoice.clientName.replace(/\s/g, '_')}.pdf`);
    };

    // --- CERRAR MODALES ---
    document.querySelectorAll('.modal-close-btn').forEach(btn => {
        btn.addEventListener('click', () => { btn.closest('.modal').style.display = 'none'; });
    });
    window.addEventListener('click', (e) => { if(e.target.classList.contains('modal')) e.target.style.display = 'none'; });
    
    // --- INICIALIZACIÓN ---
    addInvoiceItemBtn.addEventListener('click', () => addInvoiceItemRow());
    document.querySelectorAll('#invoice-discount, #invoice-tax').forEach(input => input.addEventListener('input', updateInvoiceTotals));
    cancelEditBtn.addEventListener('click', resetForm);
    document.getElementById('settings-modal-close-btn').onclick = () => settingsModal.style.display = 'none';
    document.getElementById('invoice-preview-close-btn').onclick = () => invoicePreviewModal.style.display = 'none';

    resetForm();
    renderInvoices();
});