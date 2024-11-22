const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
const formRoutes = require('./routes/form');
require('dotenv').config();

const app = express();
const port = process.env.PORT;

// Configuración de sesión
app.use(session({
    secret: 'secret',
    resave: true,
    saveUninitialized: true
}));

// Configuración de middlewares
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Configuración del motor de vistas
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Importar rutas
const authRoutes = require('./routes/auth');
const dataRoutes = require('./routes/data');

// Registrar las rutas
app.use('/auth', authRoutes); // Rutas de autenticación
app.use('/data', dataRoutes()); // Rutas de datos (con función para exportar el router)

// Ruta principal (redirigir al login si no está autenticado)
app.get('/', (req, res) => {
    if (req.session.loggedIn) {
        res.redirect('/data/dashboard');
    } else {
        res.redirect('/auth/login');
    }
});

app.use('/form', formRoutes);

// Iniciar el servidor
app.listen(port, () => {
    console.log(`Servidor corriendo en http://localhost:${port}`);
});
