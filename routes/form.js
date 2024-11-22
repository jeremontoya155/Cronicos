const express = require('express');
const { Pool } = require('pg');
const mysql = require('mysql2/promise');
require('dotenv').config();

const poolPostgres = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const poolMySQL = mysql.createPool({
    host: process.env.MYSQL_HOST,
    port: process.env.MYSQL_PORT,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
  });

const router = express.Router();

// Ruta para mostrar el formulario
router.get('/', (req, res) => {
  res.render('form', { clientData: null, alertMessage: null, isCrónico: false });
});

// Ruta para verificar cliente
router.post('/verify', async (req, res) => {
  const { dni } = req.body;

  try {
    // Verificar en PostgreSQL
    const postgresClientResult = await poolPostgres.query('SELECT * FROM clientes WHERE dni = $1', [dni]);

    if (postgresClientResult.rows.length > 0) {
      const client = postgresClientResult.rows[0];

      // Verificar si está en `registros` (si es crónico)
      const registroResult = await poolPostgres.query('SELECT * FROM registros WHERE dni_afiliado = $1', [dni]);

      return res.render('form', {
        clientData: client,
        alertMessage: registroResult.rows.length > 0
          ? 'El cliente ya está registrado como crónico.'
          : 'El cliente ya está registrado. Puede ser actualizado.',
        isCrónico: registroResult.rows.length > 0,
      });
    }

    // Verificar en MySQL (Plex)
    const [mysqlResult] = await poolMySQL.query('SELECT * FROM clientes WHERE Documento = ?', [dni]);

    if (mysqlResult.length > 0) {
      const clientData = mysqlResult[0];
      return res.render('form', {
        clientData: {
          nombre: clientData.Nombre,
          dni: clientData.Documento,
          telefono: clientData.Telefono,
          email: clientData.Email,
          sucursal: '',
          obra_social: '',
          observaciones: '',
        },
        alertMessage: 'Cliente encontrado en MySQL. Por favor, verifica y guarda los datos.',
        isCrónico: false,
      });
    }

    // Si no se encuentra en ninguna base de datos
    res.render('form', {
      clientData: null,
      alertMessage: 'Cliente no encontrado. Puedes registrar uno nuevo.',
      isCrónico: false,
    });
  } catch (error) {
    console.error('Error al verificar cliente:', error);
    res.status(500).send('Error al verificar cliente. Inténtalo nuevamente.');
  }
});

// Ruta para guardar o actualizar cliente y registro
router.post('/save', async (req, res) => {
  const {
    nombre,
    dni,
    telefono,
    email,
    sucursal,
    obra_social,
    observaciones,
    cronico,
    ...registroData
  } = req.body;

  try {
    // Verificar si ya existe en `clientes`
    const postgresClientResult = await poolPostgres.query('SELECT * FROM clientes WHERE dni = $1', [dni]);

    if (postgresClientResult.rows.length > 0) {
      // Actualizar cliente en PostgreSQL
      await poolPostgres.query(
        `
        UPDATE clientes
        SET nombre = $1, telefono = $2, email = $3, sucursal = $4, obra_social = $5, observaciones = $6
        WHERE dni = $7
      `,
        [nombre, telefono, email, sucursal, obra_social, observaciones, dni]
      );

      // Si es crónico, actualizar o insertar en `registros`
      if (cronico) {
        const registroResult = await poolPostgres.query('SELECT * FROM registros WHERE dni_afiliado = $1', [dni]);

        if (registroResult.rows.length > 0) {
          // Actualizar registro existente
          await poolPostgres.query(
            `
            UPDATE registros
            SET afiliado = $1, telefono_afiliado = $2, correo_tercero = $3, sucursal = $4, obra_social = $5, grupo = $6, productos = $7, fecha_alerta = $8
            WHERE dni_afiliado = $9
          `,
            [
              nombre,
              telefono,
              email,
              sucursal,
              obra_social,
              registroData.grupo || null,
              registroData.productos || null,
              registroData.fecha_alerta || null,
              dni,
            ]
          );
        } else {
          // Insertar nuevo registro
          await poolPostgres.query(
            `
            INSERT INTO registros (
              afiliado, dni_afiliado, telefono_afiliado, correo_tercero, sucursal, obra_social, grupo, productos, fecha_alerta
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          `,
            [
              nombre,
              dni,
              telefono,
              email,
              sucursal,
              obra_social,
              registroData.grupo || null,
              registroData.productos || null,
              registroData.fecha_alerta || null,
            ]
          );
        }
      }

      return res.render('form', {
        clientData: null,
        alertMessage: 'Cliente actualizado correctamente.',
        isCrónico: cronico,
      });
    }

    // Si no existe en `clientes`, insertar nuevo
    await poolPostgres.query(
      `
      INSERT INTO clientes (nombre, dni, telefono, email, sucursal, obra_social, observaciones)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `,
      [nombre, dni, telefono, email, sucursal, obra_social, observaciones]
    );

    // Si es crónico, insertar en `registros`
    if (cronico) {
      await poolPostgres.query(
        `
        INSERT INTO registros (
          afiliado, dni_afiliado, telefono_afiliado, correo_tercero, sucursal, obra_social, grupo, productos, fecha_alerta
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `,
        [
          nombre,
          dni,
          telefono,
          email,
          sucursal,
          obra_social,
          registroData.grupo || null,
          registroData.productos || null,
          registroData.fecha_alerta || null,
        ]
      );
    }

    res.render('form', {
      clientData: null,
      alertMessage: 'Cliente guardado correctamente.',
      isCrónico: cronico,
    });
  } catch (error) {
    console.error('Error al guardar cliente:', error);
    res.status(500).send('Error al guardar cliente. Inténtalo nuevamente.');
  }
});

module.exports = router;
