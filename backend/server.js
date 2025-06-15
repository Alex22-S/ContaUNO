const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const path = require('path'); // <-- 1. AÑADIMOS EL MÓDULO 'path'

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = 'este-es-un-secreto-muy-largo-y-dificil-de-adivinar';

app.use(cors());
app.use(express.json());

// --- ARCHIVOS ESTÁTICOS ---
// <-- 2. CORREGIMOS LA RUTA A LA CARPETA 'public'
// Ahora el servidor buscará la carpeta 'public' un nivel arriba de donde está 'server.js'
app.use(express.static(path.join(__dirname, '../public')));

// --- Almacenamiento en Memoria (Tus datos existentes) ---
let users = [];
let userIdCounter = 1;
let savingsGoals = [];
let goalIdCounter = 1;

// --- (NUEVO) Almacenamiento para Recordatorios ---
let reminders = [];
let reminderIdCounter = 1;

// --- Middleware de Autenticación (Tu código existente, sin cambios) ---
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

// --- Rutas de Autenticación (Tu código existente, sin cambios) ---
app.post('/api/signup', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) return res.status(400).json({ message: 'El usuario y la contraseña son obligatorios.' });
        if (users.find(u => u.username === username.toLowerCase())) return res.status(409).json({ message: 'El nombre de usuario ya existe.' });
        
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = { id: userIdCounter++, username: username.toLowerCase(), password: hashedPassword };
        users.push(newUser);
        
        console.log('Nuevo usuario registrado:', { id: newUser.id, username: newUser.username });
        res.status(201).json({ message: 'Usuario registrado con éxito.' });
    } catch (error) {
        res.status(500).json({ message: 'Error en el servidor.' });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = users.find(u => u.username === username.toLowerCase());
        if (!user) return res.status(401).json({ message: 'Usuario o contraseña incorrectos.' });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(401).json({ message: 'Usuario o contraseña incorrectos.' });
        
        const accessToken = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '1h' });
        
        console.log('Usuario ha iniciado sesión:', { id: user.id, username: user.username });
        res.json({ token: accessToken });
    } catch (error) {
        res.status(500).json({ message: 'Error en el servidor.' });
    }
});


// --- Rutas para Metas de Ahorro (Tu código existente, sin cambios) ---
app.get('/api/savings', authenticateToken, (req, res) => {
    const userGoals = savingsGoals.filter(goal => goal.userId === req.user.id);
    res.json(userGoals);
});

app.post('/api/savings', authenticateToken, (req, res) => {
    const { name, target, saved } = req.body;
    const newGoal = {
        _id: `goal_${goalIdCounter++}`,
        userId: req.user.id,
        name,
        target: parseFloat(target),
        saved: parseFloat(saved) || 0,
    };
    savingsGoals.push(newGoal);
    res.status(201).json(newGoal);
});

app.delete('/api/savings/:id', authenticateToken, (req, res) => {
    const goalIndex = savingsGoals.findIndex(g => g._id === req.params.id && g.userId === req.user.id);
    if (goalIndex === -1) return res.status(404).json({ message: 'Meta no encontrada o no tienes permiso para eliminarla.' });
    savingsGoals.splice(goalIndex, 1);
    res.status(200).json({ message: 'Meta eliminada.' });
});

app.post('/api/savings/:id/contributions', authenticateToken, (req, res) => {
    const goalId = req.params.id;
    const { amount } = req.body;
    const parsedAmount = parseFloat(amount);

    if (isNaN(parsedAmount) || parsedAmount <= 0) {
        return res.status(400).json({ message: 'El monto del abono debe ser un número positivo.' });
    }
    const goal = savingsGoals.find(g => g._id === goalId);
    if (!goal) return res.status(404).json({ message: 'Meta no encontrada.' });
    if (goal.userId !== req.user.id) return res.status(403).json({ message: 'No tienes permiso para modificar esta meta.' });
    goal.saved += parsedAmount;
    console.log(`Abono añadido a la meta '${goal.name}':`, { amount: parsedAmount, newTotal: goal.saved });
    res.status(200).json(goal);
});


// ======================================================================
// --- (NUEVO) Rutas para Recordatorios (Protegidas) ---
// ======================================================================

// OBTENER los recordatorios del usuario logueado
app.get('/api/reminders', authenticateToken, (req, res) => {
    const userReminders = reminders.filter(r => r.userId === req.user.id);
    res.json(userReminders);
});

// CREAR un nuevo recordatorio para el usuario logueado
app.post('/api/reminders', authenticateToken, (req, res) => {
    const { title, dueDate, amount, priority } = req.body;
    if (!title || !dueDate || !priority) {
        return res.status(400).json({ message: "Título, fecha y prioridad son requeridos." });
    }
    const newReminder = {
        id: `rem_${reminderIdCounter++}`,
        userId: req.user.id, // <-- Asociamos el recordatorio al usuario
        title,
        dueDate,
        amount: parseFloat(amount) || null,
        priority,
        completed: false
    };
    reminders.push(newReminder);
    res.status(201).json(newReminder);
});

// ACTUALIZAR un recordatorio (verificando que le pertenece al usuario)
app.put('/api/reminders/:id', authenticateToken, (req, res) => {
    const { id } = req.params;
    const { title, dueDate, amount, priority, completed } = req.body;
    const index = reminders.findIndex(r => r.id === id);

    if (index === -1) return res.status(404).json({ message: "Recordatorio no encontrado." });
    if (reminders[index].userId !== req.user.id) return res.status(403).json({ message: "No tienes permiso para editar este recordatorio." });

    reminders[index].title = title !== undefined ? title : reminders[index].title;
    reminders[index].dueDate = dueDate !== undefined ? dueDate : reminders[index].dueDate;
    reminders[index].amount = amount !== undefined ? amount : reminders[index].amount;
    reminders[index].priority = priority !== undefined ? priority : reminders[index].priority;
    reminders[index].completed = completed !== undefined ? completed : reminders[index].completed;

    res.json(reminders[index]);
});

// ELIMINAR un recordatorio (verificando que le pertenece al usuario)
app.delete('/api/reminders/:id', authenticateToken, (req, res) => {
    const { id } = req.params;
    const index = reminders.findIndex(r => r.id === id);

    if (index === -1) return res.status(404).json({ message: "Recordatorio no encontrado." });
    if (reminders[index].userId !== req.user.id) return res.status(403).json({ message: "No tienes permiso para eliminar este recordatorio." });

    reminders.splice(index, 1);
    res.status(204).send(); // 204 = Sin Contenido (éxito)
});


// --- Iniciar servidor ---
app.listen(PORT, () => {
    console.log(`Servidor ContaUNO corriendo en http://localhost:${PORT}`);
});