
//
// ============================================================
// SCRIPT: CREACIÓN DE USUARIOS DEL SISTEMA PARROQUIAL
// ============================================================
//
// Permite registrar usuarios en PostgreSQL.
//
// Parámetros:
//   1. Correo electrónico
//   2. Nombre completo
//   3. Rol del usuario
//   4. Identificador de la parroquia
//
// Ejemplo:
// node scripts/create-user.js admin@parroquia.com "Administrador" secretaria 1
//
// La contraseña se obtiene de la variable de entorno
// NEW_USER_PASSWORD, evitando escribirla en el código.
// ============================================================


// ============================================================
// 1. IMPORTAR DEPENDENCIAS
// ============================================================

// Cargar las variables de entorno desde el archivo .env.
import 'dotenv/config';

// Módulo nativo de Node.js para operaciones criptográficas.
import crypto from 'node:crypto';

// Pool de conexiones a PostgreSQL.
import { pool } from '../src/database/pool.js';


// ============================================================
// 2. OBTENER LOS PARÁMETROS DE LA TERMINAL
// ============================================================

// process.argv contiene los argumentos utilizados al
// ejecutar el programa.
//
// slice(2) elimina los primeros dos elementos:
// - Ruta del ejecutable Node.js.
// - Ruta del archivo create-user.js.

const argumentos = process.argv.slice(2);

// Obtener los parámetros mediante desestructuración.
const [
    correo,
    nombre,
    rol,
    parroquiaText = '1'
] = argumentos;

// Convertir el identificador de parroquia a número.
const parroquiaId = Number(parroquiaText);


// ============================================================
// 3. VALIDAR LOS PARÁMETROS RECIBIDOS
// ============================================================

// Roles permitidos por el sistema.
const rolesPermitidos = [
    'secretaria',
    'parroco',
    'feligrés'
];

// Verificar si el rol recibido está permitido.
const rolValido = rolesPermitidos.includes(rol);

// Verificar que el identificador sea un entero seguro.
const parroquiaValida = Number.isSafeInteger(parroquiaId);

// Validar que los parámetros obligatorios existan.
if (
    !correo ||
    !nombre ||
    !rolValido ||
    !parroquiaValida
) {

    console.error(
        'Uso: node scripts/create-user.js ' +
        'correo "Nombre" rol parroquiaId'
    );

    // Finalizar el programa con código de error.
    process.exit(1);
}


// ============================================================
// 4. OBTENER Y VALIDAR LA CONTRASEÑA
// ============================================================

// Leer la contraseña desde una variable de entorno.
const password = process.env.NEW_USER_PASSWORD;

// Verificar que exista y tenga mínimo 12 caracteres.
if (
    !password ||
    password.length < 12
) {

    console.error(
        'Configurar NEW_USER_PASSWORD ' +
        '(mínimo 12 caracteres) ' +
        'como variable de entorno temporal'
    );

    process.exit(1);
}


// ============================================================
// 5. GENERAR EL SALT Y EL HASH DE LA CONTRASEÑA
// ============================================================

// Generar 16 bytes aleatorios.
//
// El salt hace que dos usuarios con la misma contraseña
// no tengan necesariamente el mismo hash almacenado.
const salt = crypto.randomBytes(16);

// Generar el hash utilizando scrypt.
//
// Parámetros:
// - password: contraseña original.
// - salt: valor aleatorio generado.
// - 64: longitud del hash en bytes.
const hash = crypto.scryptSync(
    password,
    salt,
    64
);

// Convertir salt y hash a formato hexadecimal.
const saltHex = salt.toString('hex');
const hashHex = hash.toString('hex');

// Crear el valor que se almacenará en PostgreSQL.
//
// Formato:
// salt:hash
const passwordHash = `${saltHex}:${hashHex}`;


// ============================================================
// 6. REGISTRAR EL USUARIO EN POSTGRESQL
// ============================================================

try {

    // --------------------------------------------------------
    // 6.1 DEFINIR LA CONSULTA SQL
    // --------------------------------------------------------

    const sql = `
        INSERT INTO usuarios (
            parroquia_id,
            correo,
            nombre,
            rol,
            password_hash
        )
        VALUES (
            $1,
            $2,
            $3,
            $4,
            $5
        )
        RETURNING
            id,
            correo,
            rol
    `;


    // --------------------------------------------------------
    // 6.2 PREPARAR LOS PARÁMETROS DE LA CONSULTA
    // --------------------------------------------------------

    const parametros = [
        parroquiaId,
        correo,
        nombre,
        rol,
        passwordHash
    ];


    // --------------------------------------------------------
    // 6.3 EJECUTAR EL INSERT EN POSTGRESQL
    // --------------------------------------------------------

    const { rows } = await pool.query(
        sql,
        parametros
    );


    // --------------------------------------------------------
    // 6.4 MOSTRAR EL USUARIO CREADO
    // --------------------------------------------------------

    const usuarioCreado = rows[0];

    console.log(usuarioCreado);

} finally {

    // ========================================================
    // 7. CERRAR LAS CONEXIONES A POSTGRESQL
    // ========================================================

    // Liberar los recursos del pool al finalizar.
    await pool.end();
}
