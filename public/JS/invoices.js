document.addEventListener('DOMContentLoaded', () => {
    // Si no existe el formulario principal, salimos para no ejecutar el script en otras vistas
    if (!document.getElementById('invoice-form')) return;

    // --- REFERENCIAS AL DOM ---
    const invoiceForm = document.getElementById('invoice-form');
    const itemsContainer = document.getElementById('invoice-items-container');
    const addInvoiceItemBtn = document.getElementById('add-invoice-item-btn');
    const invoicesList = document.getElementById('invoices-list');
    const formTitle = document.querySelector('.invoice-form-container .form-section-title');
    const hiddenEditingId = document.getElementById('editing-invoice-id');

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

    // --- FORMATEADOR DE MONEDA ---
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
            <input type="text" class="item-description" placeholder="Descripción" required value="${item.description || ''}">
            <input type="number" class="item-quantity" placeholder="Cant." value="${item.quantity || 1}" min="1" required>
            <input type="number" class="item-price" placeholder="Precio" step="0.01" min="0" required value="${item.price || ''}">
            <button type="button" class="delete-item-btn">✖</button>
        `;
        itemsContainer.appendChild(row);
        row.querySelector('.delete-item-btn').addEventListener('click', () => { row.remove(); updateInvoiceTotals(); });
        row.querySelectorAll('input').forEach(input => input.addEventListener('input', updateInvoiceTotals));
    };

    // --- RENDERIZADO Y ESTADOS DE FACTURAS ---
    const getInvoiceStatus = (invoice) => {
        if (invoice.status === 'paid') return { text: 'Pagada', className: 'paid' };
        const dueDate = new Date(invoice.dueDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0); 
        dueDate.setHours(23, 59, 59, 999);
        if (dueDate < today) return { text: 'Vencida', className: 'overdue' };
        return { text: 'Pendiente', className: 'unpaid' };
    };

    window.renderInvoices = () => {
        const invoices = getInvoices().sort((a, b) => new Date(b.issueDate) - new Date(a.issueDate));
        invoicesList.innerHTML = '';
        if (invoices.length === 0) {
            invoicesList.innerHTML = '<p>No hay facturas registradas.</p>';
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
                    <button class="view-btn" data-id="${invoice.id}">Ver</button>
                    <button class="edit-btn" data-id="${invoice.id}">Editar</button>
                    <button class="delete-btn" data-id="${invoice.id}">Eliminar</button>
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
        addInvoiceItemRow();
        formTitle.textContent = 'Nueva Factura';
        document.getElementById('invoice-number').value = getInvoices().length + 1;
        document.getElementById('issue-date').value = new Date().toISOString().slice(0, 10);
        updateInvoiceTotals();
    };

    // --- LÓGICA DE EDICIÓN ---
    const editInvoice = (id) => {
        const invoice = getInvoices().find(inv => inv.id === id);
        if (!invoice) return;

        resetForm();
        formTitle.textContent = `Editando Factura #${invoice.invoiceNumber}`;
        hiddenEditingId.value = invoice.id;

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
        const totalNumber = parseFloat(totalText.replace(/[^0-9,-]+/g,"").replace(',','.'));

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
            status: 'unpaid'
        };

        let invoices = getInvoices();
        if (id) {
            const originalInvoice = invoices.find(inv => inv.id === id);
            currentInvoiceData.status = originalInvoice ? originalInvoice.status : 'unpaid';
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
        const id = e.target.dataset.id;
        if (!id) return;

        if (e.target.classList.contains('delete-btn')) {
            showConfirmationDialog({
                title: '¿Eliminar Factura?',
                message: 'Esta acción es permanente y no se puede deshacer. ¿Estás seguro de que quieres eliminar esta factura?',
                confirmText: 'Sí, Eliminar',
                onConfirm: () => {
                    saveInvoices(getInvoices().filter(inv => inv.id !== id));
                    renderInvoices();
                    showNotification('Factura eliminada.', 'info');
                }
            });
        }
        if (e.target.classList.contains('edit-btn')) editInvoice(id);
        if (e.target.classList.contains('view-btn')) viewInvoice(id);
    });

    // --- LÓGICA DE CONFIGURACIÓN ---
    btnOpenSettings.addEventListener('click', () => {
        const info = getCompanyInfo();
        Object.keys(info).forEach(key => {
            const input = settingsForm.querySelector(`#${key}`);
            if(input) input.value = info[key];
        });
        logoPreview.src = getCompanyLogo() || '';
        settingsModal.style.display = 'block';
    });

    settingsForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const formData = new FormData(settingsForm);
        const companyInfo = {};
        for(const [key, value] of formData.entries()){
            if(key !== 'company-logo-input') companyInfo[key] = value;
        }
        saveCompanyInfo(companyInfo);
        showNotification('Configuración guardada.', 'success'); // Reemplazamos alert()
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
        document.getElementById('preview-invoice-title').textContent = `FACTURA #${invoice.invoiceNumber}`;
        document.getElementById('preview-invoice-id').textContent = `ID: ${invoice.id}`;
        document.getElementById('my-company-name').textContent = company.myCompanyName || 'Tu Empresa';
        document.getElementById('my-company-details').innerHTML = `${company.myCompanyNit || ''}<br>${company.myCompanyAddress || ''}<br>${company.myCompanyPhone || ''}`;
        document.getElementById('client-info-name').textContent = invoice.clientName;
        document.getElementById('client-info-details').innerHTML = `NIT/C.C: ${invoice.clientId}<br>${invoice.clientAddress || ''}<br>${invoice.clientPhone || ''}`;
        document.getElementById('preview-issue-date').textContent = new Date(invoice.issueDate).toLocaleDateString('es-ES', { timeZone: 'UTC' });
        document.getElementById('preview-due-date').textContent = new Date(invoice.dueDate).toLocaleDateString('es-ES', { timeZone: 'UTC' });

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

        document.getElementById('preview-notes').textContent = invoice.notes || '';
        
        const btnMarkPaid = document.getElementById('btn-mark-paid');
        btnMarkPaid.onclick = () => markInvoiceAsPaid(id);
        btnMarkPaid.style.display = invoice.status === 'paid' ? 'none' : 'inline-block';

        document.getElementById('btn-download-pdf').onclick = () => generateInvoicePDF(invoice);

        invoicePreviewModal.style.display = 'block';
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
    
    // --- GENERACIÓN DE PDF ---
    const generateInvoicePDF = (invoice) => {
        if (typeof window.jspdf === 'undefined' || typeof window.jspdf.autoTable === 'undefined') {
            showNotification('Error: La librería para generar PDF no está disponible.', 'error');
            return;
        }
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        const company = getCompanyInfo();
        const logo = getCompanyLogo();

        if (logo) doc.addImage(logo, 'PNG', 15, 15, 40, 20);
        doc.setFontSize(22);
        doc.text(`Factura #${invoice.invoiceNumber}`, 200, 25, { align: 'right' });
        doc.setFontSize(10);
        doc.text(`ID: ${invoice.id}`, 200, 32, { align: 'right' });
        doc.setFontSize(12);
        doc.text('DE:', 15, 50);
        doc.setFontSize(10);
        doc.text(`${company.myCompanyName || ''}\nNIT: ${company.myCompanyNit || ''}\n${company.myCompanyAddress || ''}\n${company.myCompanyPhone || ''}`, 15, 56);
        doc.setFontSize(12);
        doc.text('PARA:', 110, 50);
        doc.setFontSize(10);
        doc.text(`${invoice.clientName}\nNIT/C.C: ${invoice.clientId}\n${invoice.clientAddress || ''}\n${invoice.clientPhone || ''}`, 110, 56);
        doc.setFontSize(12);
        doc.text(`Fecha Emisión: ${new Date(invoice.issueDate).toLocaleDateString('es-ES', { timeZone: 'UTC' })}`, 15, 85);
        doc.text(`Fecha Vencimiento: ${new Date(invoice.dueDate).toLocaleDateString('es-ES', { timeZone: 'UTC' })}`, 110, 85);
        
        const head = [['Descripción', 'Cant.', 'P. Unitario', 'Total']];
        const body = invoice.items.map(item => [item.description, item.quantity, formatCurrency(item.price), formatCurrency(item.quantity * item.price)]);
        
        doc.autoTable({
            head, body,
            startY: 95,
            headStyles: { fillColor: [4, 120, 87] }, // Un verde más oscuro
            styles: { fontSize: 10 },
            didDrawPage: (data) => {
                const finalY = data.cursor.y + 10;
                doc.setFontSize(10);
                let subtotal = invoice.items.reduce((sum, i) => sum + i.quantity * i.price, 0);
                doc.text('Subtotal:', 140, finalY);
                doc.text(formatCurrency(subtotal), 200, finalY, { align: 'right' });
                let discount = subtotal * (invoice.discountPercent/100);
                doc.text(`Descuento (${invoice.discountPercent}%):`, 140, finalY + 7);
                doc.text(`- ${formatCurrency(discount)}`, 200, finalY + 7, { align: 'right' });
                let tax = (subtotal - discount) * (invoice.taxPercent/100);
                doc.text(`Impuesto (${invoice.taxPercent}%):`, 140, finalY + 14);
                doc.text(`+ ${formatCurrency(tax)}`, 200, finalY + 14, { align: 'right' });
                doc.setFontSize(12);
                doc.setFont(undefined, 'bold');
                doc.text('TOTAL:', 140, finalY + 21);
                doc.text(formatCurrency(invoice.total), 200, finalY + 21, { align: 'right' });
            }
        });

        const finalTableY = doc.lastAutoTable.finalY + 30;
        doc.setFontSize(8);
        doc.setFont(undefined, 'normal');
        doc.text('Notas y Términos:', 15, finalTableY);
        doc.text(doc.splitTextToSize(invoice.notes || 'Gracias por su negocio.', 180), 15, finalTableY + 4);

        doc.save(`Factura-${invoice.invoiceNumber}-${invoice.clientName}.pdf`);
    };

    // --- CERRAR MODALES ---
    document.querySelectorAll('.modal-close-btn').forEach(btn => {
        btn.addEventListener('click', () => { btn.closest('.modal').style.display = 'none'; });
    });
    window.addEventListener('click', (e) => { if(e.target.classList.contains('modal')) e.target.style.display = 'none'; });

    // --- INICIALIZACIÓN ---
    addInvoiceItemBtn.addEventListener('click', () => addInvoiceItemRow());
    document.querySelectorAll('#invoice-discount, #invoice-tax').forEach(input => input.addEventListener('input', updateInvoiceTotals));
    resetForm();
    renderInvoices();
});