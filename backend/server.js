// === SERVIDOR CONTAUNO - Archivo: backend/server.js ===

// 1. IMPORTAMOS LAS HERRAMIENTAS QUE INSTALAMOS
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');

// 2. CONFIGURACIÓN INICIAL DEL SERVIDOR
const app = express();
const PORT = process.env.PORT || 3000; // El puerto donde nuestro servidor "escuchará"

// Middlewares: "Plugins" que ayudan a nuestro servidor a funcionar
app.use(cors());           // Permite que tu página web se comunique con este servidor
app.use(express.json());   // Permite que el servidor entienda y envíe datos en formato JSON

// Variable para guardar nuestra conexión a la base de datos
let db;

// 3. CONEXIÓN A LA BASE DE DATOS Y CREACIÓN DE TABLAS
// Esta función se ejecuta sola en cuanto iniciamos el servidor
(async () => {
    // Conecta con el archivo de la base de datos. Si no existe, lo crea.
    db = await open({
        filename: './database.db', // El archivo se creará aquí, dentro de la carpeta 'backend'
        driver: sqlite3.Database
    });

    console.log('Conectado a la base de datos SQLite.');

    // Ejecuta el código SQL para crear nuestras tablas si no existen ya.
    // Esto configura la base de datos automáticamente la primera vez.
    await db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            userId INTEGER NOT NULL,
            date TEXT NOT NULL,
            type TEXT NOT NULL,
            amount REAL NOT NULL,
            description TEXT NOT NULL,
            category TEXT,
            provider TEXT,
            providerId TEXT,
            notes TEXT,
            FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            userId INTEGER NOT NULL,
            type TEXT NOT NULL,
            name TEXT NOT NULL,
            FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
        );
    `);
})();

// 4. RUTAS DE LA API (LOS "SERVICIOS" O "ENDPOINTS" QUE OFRECE NUESTRO SERVIDOR)

// --- Rutas de Autenticación ---

// Ruta para REGISTRAR un nuevo usuario
app.post('/api/signup', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ message: "Usuario y contraseña son requeridos." });
    }
    try {
        const hashedPassword = await bcrypt.hash(password, 10); // Encriptamos la contraseña
        await db.run('INSERT INTO users (username, password) VALUES (?, ?)', [username, hashedPassword]);
        res.status(201).json({ message: 'Usuario creado con éxito' });
    } catch (error) {
        res.status(409).json({ message: 'El nombre de usuario ya existe.' });
    }
});

// Ruta para INICIAR SESIÓN
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    const user = await db.get('SELECT * FROM users WHERE username = ?', [username]);
    if (!user) {
        return res.status(401).json({ message: 'Usuario o contraseña incorrectos' });
    }
    const isPasswordCorrect = await bcrypt.compare(password, user.password);
    if (!isPasswordCorrect) {
        return res.status(401).json({ message: 'Usuario o contraseña incorrectos' });
    }
    res.json({ message: 'Login exitoso', userId: user.id, username: user.username });
});


// --- Rutas de Transacciones ---

// Ruta para OBTENER todas las transacciones de un usuario
app.get('/api/transactions/:userId', async (req, res) => {
    const { userId } = req.params;
    const transactions = await db.all('SELECT * FROM transactions WHERE userId = ? ORDER BY date DESC, id DESC', [userId]);
    res.json(transactions);
});

// Ruta para AÑADIR una nueva transacción
app.post('/api/transactions', async (req, res) => {
    const { userId, date, type, amount, description, category, provider, providerId, notes } = req.body;
    const result = await db.run(
        `INSERT INTO transactions (userId, date, type, amount, description, category, provider, providerId, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [userId, date, type, amount, description, category, provider, providerId, notes]
    );
    const newTransaction = await db.get('SELECT * FROM transactions WHERE id = ?', result.lastID);
    res.status(201).json(newTransaction);
});

// Ruta para ELIMINAR una transacción
app.delete('/api/transactions/:transactionId', async (req, res) => {
    const { transactionId } = req.params;
    await db.run('DELETE FROM transactions WHERE id = ?', [transactionId]);
    res.status(200).json({ message: 'Transacción eliminada' });
});

// ===== CÓDIGO NUEVO QUE DEBES AÑADIR =====
// Ruta raíz: Cuando alguien visite la URL principal, lo redirigimos a la página de login.
app.get('/', (req, res) => {
    res.redirect('/login.html');
});
// =========================================

// 5. INICIAMOS EL SERVIDOR
app.listen(PORT, () => {
    // Este mensaje se mostrará en tu terminal cuando el servidor se inicie correctamente
    console.log(`🚀 Servidor ContaUNO corriendo en http://localhost:${PORT}`);
});