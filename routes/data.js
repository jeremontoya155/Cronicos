const express = require('express');
const { Pool } = require('pg');
const moment = require('moment');

// Configurar la conexión a PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Encabezados esperados
const HEADERS = [
  'marca_temporal',
  'afiliado',
  'tercero_interviniente',
  'dni_afiliado',
  'correo_tercero',
  'telefono_afiliado',
  'obra_social',
  'nro_afiliado',
  'tipo_productos',
  'grupo',
  'productos',
  'fecha_alerta',
  'sucursal',
  'telefono_tercero',
  'fecha_venta',
  'legajo_carga',
  'notas',
  'estado_contacto',

];

module.exports = () => {
  const router = express.Router();

  // Función para reiniciar estado a "Pendiente" al inicio del mes
  async function resetContactStatus() {
    const today = moment();
    if (today.date() === 1 && today.hour() === 0 && today.minute() === 0) {
      await pool.query("UPDATE registros SET estado_contacto = 'Pendiente'");
    }
  }

  // Ejecutar la función al cargar el servidor
  resetContactStatus().catch((err) => console.error('Error al reiniciar estados:', err));

  // Ruta para mostrar el dashboard
  router.get('/dashboard', async (req, res) => {
    if (!req.session.loggedIn) {
      return res.redirect('/auth/login');
    }

    try {
      const result = await pool.query('SELECT * FROM registros');
      const data = result.rows.map((row) => ({
        ...row,
        marca_temporal: moment(row.marca_temporal).isValid()
          ? moment(row.marca_temporal).format('DD/MM/YYYY')
          : '',
        fecha_alerta: row.fecha_alerta ? moment(row.fecha_alerta).format('DD/MM/YYYY') : '',
        fecha_venta: row.fecha_venta ? moment(row.fecha_venta).format('DD/MM/YYYY') : '',
      }));

      res.render('dashboard', { user: req.session.user, data, headers: HEADERS, error: null });
    } catch (err) {
      console.error('Error al cargar datos:', err);
      res.render('dashboard', { user: req.session.user, data: [], headers: HEADERS, error: 'Error al cargar los datos.' });
    }
  });

  // Ruta para filtrar registros
  router.post('/filter', async (req, res) => {
    if (!req.session.loggedIn) {
      return res.redirect('/auth/login');
    }

    const { startDate, endDate, person } = req.body;

    try {
      let query = 'SELECT * FROM registros WHERE 1=1';
      const values = [];

      if (startDate) {
        query += ` AND marca_temporal::date >= $${values.length + 1}`;
        values.push(moment(startDate, 'YYYY-MM-DD').format('YYYY-MM-DD'));
      }

      if (endDate) {
        query += ` AND marca_temporal::date <= $${values.length + 1}`;
        values.push(moment(endDate, 'YYYY-MM-DD').format('YYYY-MM-DD'));
      }

      if (person) {
        query += ` AND LOWER(afiliado) LIKE $${values.length + 1}`;
        values.push(`%${person.toLowerCase()}%`);
      }

      const result = await pool.query(query, values);
      const filteredData = result.rows.map((row) => ({
        ...row,
        marca_temporal: moment(row.marca_temporal).isValid()
          ? moment(row.marca_temporal).format('DD/MM/YYYY')
          : '',
        fecha_alerta: row.fecha_alerta ? moment(row.fecha_alerta).format('DD/MM/YYYY') : '',
        fecha_venta: row.fecha_venta ? moment(row.fecha_venta).format('DD/MM/YYYY') : '',
      }));

      res.render('dashboard', { user: req.session.user, data: filteredData, headers: HEADERS, error: null });
    } catch (err) {
      console.error('Error al filtrar datos:', err);
      res.render('dashboard', { user: req.session.user, data: [], headers: HEADERS, error: 'Error al filtrar los datos.' });
    }
  });

  // Ruta para actualizar notas y estado de contacto
  router.post('/update', async (req, res) => {
    if (!req.session.loggedIn) {
      return res.redirect('/auth/login');
    }

    const { id, notas, estado_contacto } = req.body;

    try {
      const query = [];
      const values = [];

      if (notas) {
        const existingNotes = await pool.query('SELECT notas FROM registros WHERE id = $1', [id]);
        const updatedNotes = `${existingNotes.rows[0].notas || ''}\n${moment().format('DD/MM/YYYY')}: ${notas}`;
        query.push('notas = $' + (values.length + 1));
        values.push(updatedNotes);
      }

      if (estado_contacto) {
        query.push('estado_contacto = $' + (values.length + 1));
        values.push(estado_contacto);
      }

      if (query.length > 0) {
        values.push(id);
        await pool.query(`UPDATE registros SET ${query.join(', ')} WHERE id = $${values.length}`, values);
      }

      res.redirect('/data/dashboard');
    } catch (err) {
      console.error('Error al actualizar registro:', err);
      res.render('dashboard', { user: req.session.user, data: [], headers: HEADERS, error: 'Error al actualizar registro.' });
    }
  });

  return router;
};
