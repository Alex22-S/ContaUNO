// --- Importaciones ---
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const path = require('path'); // Módulo para manejar rutas de archivos

// --- Configuración Inicial ---
const app = express();
// Usa el puerto que Render te da, o el 3000 si estás en tu PC
const PORT = process.env.PORT || 3000; 

// --- Middlewares ---
app.use(cors());
app.use(express.json());

// ** INSTRUCCIÓN CLAVE PARA SERVIR ARCHIVOS **
// Le decimos a Express que la carpeta 'public' está un nivel "arriba" de donde está este archivo.
app.use(express.static(path.join(__dirname, '../public')));

// --- Conexión a la Base de Datos ---
let db;
(async () => {
    // La base de datos se creará dentro de la carpeta 'backend'
    db = await open({
        filename: './database.db', 
        driver: sqlite3.Database
    });
    console.log('Conectado a la base de datos SQLite.');
    // El código para crear las tablas no cambia...
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
            FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
        );
        /* ... Aquí irían tus otras tablas ... */
    `);
})();

// --- RUTAS DE LA API ---
// (Estas no cambian)
app.post('/api/signup', async (req, res) => { /* ... */ });
app.post('/api/login', async (req, res) => { /* ... */ });
app.get('/api/transactions/:userId', async (req, res) => { /* ... */ });
app.post('/api/transactions', async (req, res) => { /* ... */ });
app.delete('/api/transactions/:transactionId', async (req, res) => { /* ... */ });


// --- RUTA RAÍZ (para la redirección) ---
app.get('/', (req, res) => {
    res.redirect('/login.html');
});

// --- Iniciar el servidor ---
app.listen(PORT, () => {
    console.log(`🚀 Servidor ContaUNO corriendo en el puerto ${PORT}`);
});

// Re-pego el código de las rutas API para que tengas el archivo completo
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
app.get('/api/transactions/:userId', async (req, res) => {
    const { userId } = req.params;
    const transactions = await db.all('SELECT * FROM transactions WHERE userId = ? ORDER BY date DESC, id DESC', [userId]);
    res.json(transactions);
});
app.post('/api/transactions', async (req, res) => {
    const { userId, date, type, amount, description, category } = req.body;
    const result = await db.run(
        `INSERT INTO transactions (userId, date, type, amount, description, category)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [userId, date, type, amount, description, category]
    );
    const newTransaction = await db.get('SELECT * FROM transactions WHERE id = ?', result.lastID);
    res.status(201).json(newTransaction);
});
app.delete('/api/transactions/:transactionId', async (req, res) => {
    const { transactionId } = req.params;
    await db.run('DELETE FROM transactions WHERE id = ?', [transactionId]);
    res.status(200).json({ message: 'Transacción eliminada' });
});