const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken'); // <--- Importamos JWT
const bcrypt = require('bcryptjs'); // <--- Importamos Bcrypt

const app = express();
const PORT = 3000;
const JWT_SECRET = 'este-es-un-secreto-muy-largo-y-dificil-de-adivinar'; // Cambia esto por tu propia frase secreta

app.use(cors()); 
app.use(express.json()); 

let users = [];
let userIdCounter = 1;
let savingsGoals = []; 
let goalIdCounter = 1;

// --- Middleware de Autenticación ---
// Este "guardia" se ejecutará antes de cada ruta que queramos proteger.
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Formato: "Bearer TOKEN"

    if (token == null) {
        return res.sendStatus(401); // No hay token, no autorizado
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.sendStatus(403); // El token no es válido o ha expirado
        }
        req.user = user; // Guardamos la info del usuario del token en la petición
        next(); // El usuario está verificado, puede continuar
    });
};


// --- Rutas de Autenticación (Actualizadas) ---

// Signup: Ahora encriptamos la contraseña
app.post('/api/signup', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) return res.status(400).json({ message: 'El usuario y la contraseña son obligatorios.' });
        if (users.find(u => u.username === username.toLowerCase())) return res.status(409).json({ message: 'El nombre de usuario ya existe.' });
        
        const hashedPassword = await bcrypt.hash(password, 10); // Encriptamos la contraseña
        const newUser = { id: userIdCounter++, username: username.toLowerCase(), password: hashedPassword };
        users.push(newUser);
        
        console.log('Nuevo usuario registrado:', { id: newUser.id, username: newUser.username });
        res.status(201).json({ message: 'Usuario registrado con éxito.' });
    } catch (error) {
        res.status(500).json({ message: 'Error en el servidor.' });
    }
});

// Login: Ahora comparamos la contraseña encriptada y devolvemos un token
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = users.find(u => u.username === username.toLowerCase());
        if (!user) return res.status(401).json({ message: 'Usuario o contraseña incorrectos.' });

        const isMatch = await bcrypt.compare(password, user.password); // Comparamos con la contraseña encriptada
        if (!isMatch) return res.status(401).json({ message: 'Usuario o contraseña incorrectos.' });
        
        // Creamos el token con el ID del usuario dentro
        const accessToken = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '1h' });
        
        console.log('Usuario ha iniciado sesión:', { id: user.id, username: user.username });
        res.json({ token: accessToken }); // <-- Enviamos el token al frontend
    } catch (error) {
        res.status(500).json({ message: 'Error en el servidor.' });
    }
});

// --- Rutas para Metas de Ahorro (Ahora Protegidas) ---
// Usamos el middleware 'authenticateToken' para proteger todas estas rutas.

// OBTENER las metas del usuario logueado
app.get('/api/savings', authenticateToken, (req, res) => {
    // Filtramos las metas para devolver solo las del usuario que hace la petición
    const userGoals = savingsGoals.filter(goal => goal.userId === req.user.id);
    res.json(userGoals);
});

// CREAR una nueva meta para el usuario logueado
app.post('/api/savings', authenticateToken, (req, res) => {
    const { name, target, saved } = req.body;
    const newGoal = {
        _id: `goal_${goalIdCounter++}`,
        userId: req.user.id, // <-- Asociamos la meta al usuario
        name,
        target: parseFloat(target),
        saved: parseFloat(saved) || 0,
    };
    savingsGoals.push(newGoal);
    res.status(201).json(newGoal);
});

// ELIMINAR una meta (verificando que le pertenece al usuario)
app.delete('/api/savings/:id', authenticateToken, (req, res) => {
    const goalIndex = savingsGoals.findIndex(g => g._id === req.params.id && g.userId === req.user.id);
    if (goalIndex === -1) return res.status(404).json({ message: 'Meta no encontrada o no tienes permiso para eliminarla.' });
    savingsGoals.splice(goalIndex, 1);
    res.status(200).json({ message: 'Meta eliminada.' });
});

// ✅ --- RUTA PARA AÑADIR ABONOS (LA QUE FALTABA) ---
app.post('/api/savings/:id/contributions', authenticateToken, (req, res) => {
    const goalId = req.params.id;
    const { amount } = req.body;
    const parsedAmount = parseFloat(amount);

    if (isNaN(parsedAmount) || parsedAmount <= 0) {
        return res.status(400).json({ message: 'El monto del abono debe ser un número positivo.' });
    }

    const goal = savingsGoals.find(g => g._id === goalId);

    if (!goal) {
        return res.status(404).json({ message: 'Meta no encontrada.' });
    }
    if (goal.userId !== req.user.id) {
        return res.status(403).json({ message: 'No tienes permiso para modificar esta meta.' });
    }

    goal.saved += parsedAmount;

    console.log(`Abono añadido a la meta '${goal.name}':`, { amount: parsedAmount, newTotal: goal.saved });

    res.status(200).json(goal);
});


app.listen(PORT, () => {
    console.log(`Servidor ContaUNO corriendo en http://localhost:${PORT}`);
});