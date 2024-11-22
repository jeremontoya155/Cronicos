const express = require('express');
const router = express.Router();
const { Pool } = require('pg');

// Configurar la conexión a PostgreSQL
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Ruta para mostrar la página de login
router.get('/login', (req, res) => {
    res.render('login', { error: null }); // Renderiza la página de login
});

// Ruta para manejar el inicio de sesión
router.post('/login', async (req, res) => {
    const { user, password } = req.body;

    try {
        const result = await pool.query(
            'SELECT * FROM users WHERE "user" = $1 AND password = $2',
            [user, password]
        );

        if (result.rows.length > 0) {
            req.session.loggedIn = true; // Establecer sesión activa
            req.session.user = result.rows[0];
            console.log('Usuario autenticado:', req.session.user);

            // Redirigir al controlador de datos (data.js)
            res.redirect('/data/dashboard');
        } else {
            res.render('login', { error: 'Usuario o contraseña incorrectos' });
        }
    } catch (error) {
        console.error('Error al consultar la base de datos:', error);
        res.render('login', { error: 'Ocurrió un error en el servidor. Inténtalo nuevamente.' });
    }
});

// Ruta para cerrar sesión
router.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/auth/login'); // Redirigir al login
    });
});

// Exportar el router
module.exports = router;
