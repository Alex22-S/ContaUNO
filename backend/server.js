// --- Importaciones ---
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const path = require('path');
const jwt = require('jsonwebtoken'); // Para la seguridad por tokens
const { jsPDF } = require('jspdf'); // Para generar PDFs en el servidor
require('jspdf-autotable'); // Extensión para tablas en PDF
const { Pool } = require('pg');

// --- Configuración Inicial ---
const app = express();
const PORT = process.env.PORT || 3000;
// IMPORTANTE: Crea una variable de entorno en Render llamada JWT_SECRET con un valor largo y aleatorio.
const JWT_SECRET = process.env.JWT_SECRET || 'este-es-un-secreto-solo-para-desarrollo-local';

// --- Conexión a PostgreSQL en Render ---
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// --- Middlewares ---
app.use(cors());
app.use(express.json());

// --- Sirviendo Archivos Estáticos (Frontend) ---
app.use(express.static(path.join(__dirname, '..', 'public')));

// --- Middleware de Autenticación ---
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

// --- Rutas de Autenticación ---
app.post('/api/signup', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ message: "Usuario y contraseña son requeridos." });
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        await pool.query('INSERT INTO users (username, password) VALUES ($1, $2)', [username, hashedPassword]);
        res.status(201).json({ message: 'Usuario creado con éxito' });
    } catch (error) {
        if (error.code === '23505') return res.status(409).json({ message: 'El nombre de usuario ya existe.' });
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
});

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        const user = result.rows[0];
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ message: 'Usuario o contraseña incorrectos' });
        }
        const accessToken = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: '8h' });
        res.json({ message: 'Login exitoso', token: accessToken });
    } catch (error) {
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
});

// --- API para Transacciones (Protegida) ---
app.get('/api/transactions', authenticateToken, async (req, res) => {
    const { userId } = req.user;
    try {
        const result = await pool.query('SELECT *, to_char(date, \'YYYY-MM-DD\') as date FROM transactions WHERE "userId" = $1 ORDER BY date DESC', [userId]);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener transacciones' });
    }
});

app.post('/api/transactions', authenticateToken, async (req, res) => {
    const { userId } = req.user;
    const { date, type, amount, description, category, provider, providerId, notes } = req.body;
    try {
        const query = `INSERT INTO transactions ("userId", date, type, amount, description, category, provider, "providerId", notes) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *;`;
        const values = [userId, date, type, amount, description, category, provider, providerId, notes];
        const result = await pool.query(query, values);
        res.status(201).json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ message: 'Error al crear la transacción' });
    }
});

// --- API para Reportes PDF (Protegida) ---
app.get('/api/report/monthly', authenticateToken, async (req, res) => {
    const { userId } = req.user;
    const { month, year } = req.query;
    if (!month || !year) return res.status(400).json({ message: 'Mes y año son requeridos.' });

    try {
        const query = `SELECT *, to_char(date, 'YYYY-MM-DD') as date FROM transactions WHERE "userId" = $1 AND EXTRACT(YEAR FROM date) = $2 AND EXTRACT(MONTH FROM date) = $3 ORDER BY date ASC;`;
        const result = await pool.query(query, [userId, year, month]);
        const transactions = result.rows;

        const summary = transactions.reduce((acc, t) => {
            if (t.type === 'income') acc.income += parseFloat(t.amount);
            else if (t.type === 'expense') acc.expense += parseFloat(t.amount);
            acc.balance = acc.income - acc.expense;
            return acc;
        }, { income: 0, expense: 0, balance: 0 });

        const { doc, fileName } = generatePdfDocument(summary, transactions, { month, year });
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        
        doc.pipe(res);

    } catch (error) {
        res.status(500).json({ message: 'Error generando el reporte PDF' });
    }
});

// --- Función Auxiliar para crear el PDF ---
function generatePdfDocument(summary, transactions, period) {
    const doc = new jsPDF();
    const formatCurrency = (value) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(value);
    
    const primaryColor = '#0d47a1', secondaryColor = '#42a5f5', textColor = '#333333';
    const headerBgColor = '#1e88e5', incomeColor = '#2e7d32', expenseColor = '#c62828';
    const borderColor = '#e0e0e0';

    const monthName = new Date(period.year, period.month - 1).toLocaleString('es-CO', { month: 'long' });
    const fileName = `Reporte_${monthName}_${period.year}.pdf`;
    
    // Encabezado del documento
    doc.setFont('helvetica', 'bold').setFontSize(24).setTextColor(primaryColor).text('ContaUNO', 14, 22);
    doc.setFont('helvetica', 'normal').setFontSize(14).setTextColor(textColor).text('Reporte Financiero Mensual', 200, 18, { align: 'right' });
    doc.setFontSize(11).setTextColor(secondaryColor).text(`${monthName.charAt(0).toUpperCase() + monthName.slice(1)} de ${period.year}`, 200, 25, { align: 'right' });
    doc.setDrawColor(borderColor).line(14, 32, 200, 32);

    // Tarjetas de Resumen
    const drawSummaryCard = (x, y, title, value, color) => {
        doc.setFillColor(255, 255, 255).setDrawColor(borderColor).roundedRect(x, y, 62, 25, 3, 3, 'FD');
        doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor(secondaryColor).text(title, x + 31, y + 8, { align: 'center' });
        doc.setFontSize(14).setTextColor(color).text(formatCurrency(value), x + 31, y + 18, { align: 'center' });
    };

    drawSummaryCard(14, 40, 'INGRESOS TOTALES', summary.income, incomeColor);
    drawSummaryCard(80, 40, 'GASTOS TOTALES', summary.expense, expenseColor);
    drawSummaryCard(146, 40, 'BALANCE NETO', summary.balance, summary.balance >= 0 ? primaryColor : expenseColor);

    // Tabla de transacciones
    const head = [['Fecha', 'Descripción', 'Categoría', 'Ingreso', 'Gasto']];
    const body = transactions.map(t => [
        t.date,
        t.description,
        t.category || 'N/A',
        t.type === 'income' ? formatCurrency(t.amount) : '',
        t.type === 'expense' ? formatCurrency(t.amount) : ''
    ]);
    const totalRow = [
        { content: 'TOTALES', colSpan: 3, styles: { halign: 'right', fontStyle: 'bold', fillColor: '#f5f5f5'} },
        { content: formatCurrency(summary.income), styles: { halign: 'right', fontStyle: 'bold', textColor: incomeColor, fillColor: '#f5f5f5' } },
        { content: formatCurrency(summary.expense), styles: { halign: 'right', fontStyle: 'bold', textColor: expenseColor, fillColor: '#f5f5f5' } }
    ];
    body.push(totalRow);

    doc.autoTable({ startY: 85, head, body, theme: 'grid', /* ...estilos... */ });

    return { doc, fileName };
}


// --- Iniciar el servidor ---
app.listen(PORT, () => console.log(`🚀 Servidor ContaUNO corriendo en el puerto ${PORT}`));

// No olvides la función para crear tablas si no existen
const createTables = async () => { /* ... tu función createTables sin cambios ... */ };
createTables();