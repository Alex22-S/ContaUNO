// --- Importaciones ---
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const path = require('path');

// --- Configuración Inicial ---
const app = express();
// Usa el puerto que Render te da, o el 3000 si estás en tu PC
const PORT = process.env.PORT || 3000;

// --- Middlewares ---
app.use(cors());
app.use(express.json());


// ===================================================================
// ===== ESTE ES EL ORDEN CORRECTO Y LA SOLUCIÓN DEFINITIVA ========
// ===================================================================

// 1. LA REDIRECCIÓN DE LA RUTA RAÍZ VA PRIMERO
// Así, esta es la primera regla que Express revisa.
app.get('/', (req, res) => {
    res.redirect('/login.html');
});

// 2. SERVIR LOS ARCHIVOS ESTÁTICOS VA DESPUÉS
// Si la ruta no era '/', Express buscará en la carpeta 'public'.
app.use(express.static(path.join(__dirname, 'public')));

// ===================================================================
// ===================================================================


// --- Conexión a la Base de Datos ---
let db;
(async () => {
    // La base de datos se creará en la raíz del proyecto
    db = await open({
        filename: './database.db',
        driver: sqlite3.Database
    });
    console.log('Conectado a la base de datos SQLite.');
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

// --- RUTAS DE LA API ---

app.post('/api/signup', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ message: "Usuario y contraseña son requeridos." });
    }
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        await db.run('INSERT INTO users (username, password) VALUES (?, ?)', [username, hashedPassword]);
        res.status(201).json({ message: 'Usuario creado con éxito' });
    } catch (error) {
        res.status(409).json({ message: 'El nombre de usuario ya existe.' });
    }
});
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    const user = await db.get('SELECT * FROM users WHERE username = ?', [username]);
    if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(401).json({ message: 'Usuario o contraseña incorrectos' });
    }
    res.json({ message: 'Login exitoso', userId: user.id, username: user.username });
});
// (Aquí irían tus otras rutas de transacciones, etc. si las tuvieras)


// --- Iniciar el servidor ---
app.listen(PORT, () => {
    console.log(`🚀 Servidor ContaUNO corriendo en el puerto ${PORT}`);
});