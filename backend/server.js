// --- Importaciones ---
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const path = require('path');
const { Pool } = require('pg'); // Usamos el driver de PostgreSQL

// --- Configuración Inicial ---
const app = express();
const PORT = process.env.PORT || 3000;

// --- Conexión Segura a la Base de Datos PostgreSQL ---
// El código lee la "llave secreta" de las variables de entorno de Render.
// Esto es seguro porque tu contraseña no queda expuesta en el código.
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// --- Middlewares ---
app.use(cors());
app.use(express.json());

// --- Configuración de Archivos Estáticos ---
app.get('/', (req, res) => {
    res.redirect('/login.html');
});
app.use(express.static(path.join(__dirname, '..', 'public')));

// --- Función para Crear las Tablas si no Existen ---
const createTables = async () => {
    const createTablesQuery = `
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS transactions (
            id SERIAL PRIMARY KEY,
            "userId" INTEGER NOT NULL,
            date TEXT NOT NULL,
            type TEXT NOT NULL,
            amount NUMERIC NOT NULL,
            description TEXT NOT NULL,
            category TEXT,
            provider TEXT,
            "providerId" TEXT,
            notes TEXT,
            FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS categories (
            id SERIAL PRIMARY KEY,
            "userId" INTEGER NOT NULL,
            type TEXT NOT NULL,
            name TEXT NOT NULL,
            FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE
        );
    `;
    try {
        await pool.query(createTablesQuery);
        console.log('Tablas verificadas/creadas en PostgreSQL.');
    } catch (err) {
        console.error('Error al crear las tablas:', err);
    }
};
createTables(); // Ejecutamos la función al iniciar

// --- RUTAS DE LA API (Actualizadas para PostgreSQL) ---
app.post('/api/signup', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ message: "Usuario y contraseña son requeridos." });
    }
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        await pool.query('INSERT INTO users (username, password) VALUES ($1, $2)', [username, hashedPassword]);
        res.status(201).json({ message: 'Usuario creado con éxito' });
    } catch (error) {
        if (error.code === '23505') { // Código de error para duplicados en PostgreSQL
            return res.status(409).json({ message: 'El nombre de usuario ya existe.' });
        }
        console.error(error);
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
        res.json({ message: 'Login exitoso', userId: user.id, username: user.username });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
});

// --- Iniciar el servidor ---
app.listen(PORT, () => {
    console.log(`🚀 Servidor ContaUNO corriendo en el puerto ${PORT}`);
});