
import { pool } from '../../database/pool.js';

export class ReservasRepository {

    constructor(db = pool) {
        this.db = db;
    }

    // ============================================================
    // 1. LISTAR ESPACIOS DISPONIBLES DE LA PARROQUIA
    // ============================================================

    async listarEspacios(parroquiaId) {

        const sql = `
            SELECT
                id,
                nombre,
                capacidad
            FROM espacios
            WHERE parroquia_id = $1
              AND activo = TRUE
            ORDER BY nombre
        `;

        const parametros = [parroquiaId];

        const { rows } = await this.db.query(sql, parametros);

        return rows;
    }


    // ============================================================
    // 2. CONSULTAR DISPONIBILIDAD DE UN ESPACIO
    // ============================================================

    async disponibilidad(parroquiaId, espacioId, desde, hasta) {

        const sql = `
            SELECT
                id,
                inicio,
                fin,
                estado
            FROM reservas
            WHERE parroquia_id = $1
              AND espacio_id = $2
              AND estado = 'APROBADA'
              AND inicio < $4
              AND fin > $3
            ORDER BY inicio
        `;

        const parametros = [
            parroquiaId,
            espacioId,
            desde,
            hasta
        ];

        const { rows } = await this.db.query(sql, parametros);

        return rows;
    }


    // ============================================================
    // 3. LISTAR RESERVAS SEGÚN EL ROL DEL USUARIO
    // ============================================================

    async listar(user) {

        // Secretaría y párroco pueden consultar todas las reservas.
        // Los demás usuarios solamente consultan las propias.

        const isAdmin = ['secretaria', 'parroco'].includes(user.role);

        const sql = `
            SELECT
                r.id,
                r.espacio_id,
                e.nombre AS espacio,
                r.solicitante,
                r.correo,
                r.motivo,
                r.inicio,
                r.fin,
                r.estado,
                r.observacion
            FROM reservas r
            INNER JOIN espacios e
                ON e.id = r.espacio_id
               AND e.parroquia_id = r.parroquia_id
            WHERE r.parroquia_id = $1
              AND (
                    $2::boolean
                    OR r.usuario_id = $3
                  )
            ORDER BY r.inicio DESC
            LIMIT 200
        `;

        const parametros = [
            user.parroquiaId,
            isAdmin,
            user.id
        ];

        const { rows } = await this.db.query(sql, parametros);

        return rows;
    }


    // ============================================================
    // 4. EJECUTAR OPERACIONES DENTRO DE UNA TRANSACCIÓN
    // ============================================================

    async transaction(fn) {

        // Obtener una conexión del pool.
        const client = await this.db.connect();

        try {

            // Iniciar transacción.
            await client.query('BEGIN');

            // Ejecutar las operaciones recibidas.
            const result = await fn(client);

            // Confirmar todos los cambios.
            await client.query('COMMIT');

            return result;

        } catch (error) {

            // Revertir las operaciones si ocurre un error.
            await client.query('ROLLBACK');

            // PostgreSQL: conflicto de restricción de exclusión.
            if (error.code === '23P01') {
                return {
                    type: 'CONFLICT'
                };
            }

            throw error;

        } finally {

            // Liberar la conexión para que pueda reutilizarse.
            client.release();
        }
    }


    // ============================================================
    // 5. CREAR UNA NUEVA SOLICITUD DE RESERVA
    // ============================================================

    async crear(user, data) {

        return this.transaction(async (client) => {

            // ----------------------------------------------------
            // PASO 1. BLOQUEAR OPERACIONES CONCURRENTES
            // SOBRE EL MISMO ESPACIO Y PARROQUIA
            // ----------------------------------------------------

            const sqlBloqueo = `
                SELECT pg_advisory_xact_lock(
                    $1::integer,
                    $2::integer
                )
            `;

            await client.query(sqlBloqueo, [
                user.parroquiaId,
                data.espacioId
            ]);


            // ----------------------------------------------------
            // PASO 2. VERIFICAR QUE EL ESPACIO EXISTA Y ESTÉ ACTIVO
            // ----------------------------------------------------

            const sqlEspacio = `
                SELECT 1
                FROM espacios
                WHERE id = $1
                  AND parroquia_id = $2
                  AND activo = TRUE
            `;

            const espacio = await client.query(sqlEspacio, [
                data.espacioId,
                user.parroquiaId
            ]);

            if (!espacio.rowCount) {
                return {
                    type: 'NOT_FOUND'
                };
            }


            // ----------------------------------------------------
            // PASO 3. VERIFICAR CONFLICTOS CON RESERVAS APROBADAS
            // ----------------------------------------------------

            const sqlConflicto = `
                SELECT 1
                FROM reservas
                WHERE parroquia_id = $1
                  AND espacio_id = $2
                  AND estado = 'APROBADA'
                  AND inicio < $4
                  AND fin > $3
                LIMIT 1
            `;

            const parametrosConflicto = [
                user.parroquiaId,
                data.espacioId,
                data.inicio,
                data.fin
            ];

            const conflicto = await client.query(
                sqlConflicto,
                parametrosConflicto
            );

            if (conflicto.rowCount) {
                return {
                    type: 'CONFLICT'
                };
            }


            // ----------------------------------------------------
            // PASO 4. INSERTAR LA SOLICITUD DE RESERVA
            // ----------------------------------------------------

            const sqlInsertar = `
                INSERT INTO reservas (
                    parroquia_id,
                    espacio_id,
                    usuario_id,
                    solicitante,
                    correo,
                    motivo,
                    inicio,
                    fin
                )
                VALUES (
                    $1, $2, $3, $4,
                    $5, $6, $7, $8
                )
                RETURNING *
            `;

            const parametrosReserva = [
                user.parroquiaId,
                data.espacioId,
                user.id,
                data.solicitante,
                data.correo,
                data.motivo,
                data.inicio,
                data.fin
            ];

            const { rows } = await client.query(
                sqlInsertar,
                parametrosReserva
            );

            const reservaCreada = rows[0];


            // ----------------------------------------------------
            // PASO 5. REGISTRAR LA CREACIÓN EN AUDITORÍA
            // ----------------------------------------------------

            const sqlAuditoria = `
                INSERT INTO auditoria_reservas (
                    parroquia_id,
                    reserva_id,
                    usuario_id,
                    accion
                )
                VALUES ($1, $2, $3, $4)
            `;

            await client.query(sqlAuditoria, [
                user.parroquiaId,
                reservaCreada.id,
                user.id,
                'CREADA'
            ]);


            // ----------------------------------------------------
            // PASO 6. DEVOLVER LA RESERVA CREADA
            // ----------------------------------------------------

            return {
                type: 'OK',
                data: reservaCreada
            };

        });
    }


    // ============================================================
    // 6. CAMBIAR EL ESTADO DE UNA RESERVA
    // ============================================================

    async cambiarEstado(user, id, estado, observacion) {

        return this.transaction(async (client) => {

            // ----------------------------------------------------
            // PASO 1. CONSULTAR A QUÉ ESPACIO PERTENECE LA RESERVA
            // ----------------------------------------------------

            const sqlBuscar = `
                SELECT espacio_id
                FROM reservas
                WHERE id = $1
                  AND parroquia_id = $2
            `;

            const lookup = await client.query(sqlBuscar, [
                id,
                user.parroquiaId
            ]);

            if (!lookup.rowCount) {
                return {
                    type: 'NOT_FOUND'
                };
            }

            const espacioId = lookup.rows[0].espacio_id;


            // ----------------------------------------------------
            // PASO 2. BLOQUEAR OPERACIONES CONCURRENTES DEL ESPACIO
            // ----------------------------------------------------

            const sqlBloqueo = `
                SELECT pg_advisory_xact_lock(
                    $1::integer,
                    $2::integer
                )
            `;

            await client.query(sqlBloqueo, [
                user.parroquiaId,
                espacioId
            ]);


            // ----------------------------------------------------
            // PASO 3. OBTENER Y BLOQUEAR LA RESERVA
            // ----------------------------------------------------

            const sqlReserva = `
                SELECT *
                FROM reservas
                WHERE id = $1
                  AND parroquia_id = $2
                FOR UPDATE
            `;

            const result = await client.query(sqlReserva, [
                id,
                user.parroquiaId
            ]);

            if (!result.rowCount) {
                return {
                    type: 'NOT_FOUND'
                };
            }

            const reserva = result.rows[0];


            // ----------------------------------------------------
            // PASO 4. IDENTIFICAR SI EL USUARIO ES ADMINISTRATIVO
            // ----------------------------------------------------

            const admin = ['secretaria', 'parroco'].includes(user.role);


            // ----------------------------------------------------
            // PASO 5. VALIDAR PERMISOS PARA CANCELAR
            // ----------------------------------------------------

            if (
                estado === 'CANCELADA' &&
                !admin &&
                reserva.usuario_id !== user.id
            ) {
                return {
                    type: 'FORBIDDEN'
                };
            }


            // ----------------------------------------------------
            // PASO 6. VALIDAR PERMISOS PARA APROBAR O RECHAZAR
            // ----------------------------------------------------

            if (
                ['APROBADA', 'RECHAZADA'].includes(estado) &&
                !admin
            ) {
                return {
                    type: 'FORBIDDEN'
                };
            }


            // ----------------------------------------------------
            // PASO 7. VALIDAR TRANSICIONES PERMITIDAS
            // ----------------------------------------------------

            // Una reserva PENDIENTE puede ser:
            // - APROBADA
            // - RECHAZADA
            // - CANCELADA
            //
            // Una reserva APROBADA puede ser:
            // - CANCELADA

            const puedeAprobarORechazar =
                (estado === 'APROBADA' || estado === 'RECHAZADA') &&
                reserva.estado === 'PENDIENTE';

            const puedeCancelar =
                estado === 'CANCELADA' &&
                ['PENDIENTE', 'APROBADA'].includes(reserva.estado);

            if (!puedeAprobarORechazar && !puedeCancelar) {
                return {
                    type: 'INVALID_STATE'
                };
            }


            // ----------------------------------------------------
            // PASO 8. SI SE APRUEBA, VALIDAR CONFLICTOS DE HORARIO
            // ----------------------------------------------------

            if (estado === 'APROBADA') {

                const sqlConflicto = `
                    SELECT 1
                    FROM reservas
                    WHERE parroquia_id = $1
                      AND espacio_id = $2
                      AND id <> $3
                      AND estado = 'APROBADA'
                      AND inicio < $5
                      AND fin > $4
                    LIMIT 1
                `;

                const parametrosConflicto = [
                    user.parroquiaId,
                    reserva.espacio_id,
                    id,
                    reserva.inicio,
                    reserva.fin
                ];

                const { rowCount } = await client.query(
                    sqlConflicto,
                    parametrosConflicto
                );

                if (rowCount) {
                    return {
                        type: 'CONFLICT'
                    };
                }
            }


            // ----------------------------------------------------
            // PASO 9. ACTUALIZAR EL ESTADO DE LA RESERVA
            // ----------------------------------------------------

            const sqlActualizar = `
                UPDATE reservas
                SET
                    estado = $3,
                    observacion = $4,
                    actualizado_en = NOW()
                WHERE id = $1
                  AND parroquia_id = $2
                RETURNING *
            `;

            const parametrosActualizar = [
                id,
                user.parroquiaId,
                estado,
                observacion || null
            ];

            const { rows } = await client.query(
                sqlActualizar,
                parametrosActualizar
            );

            const reservaActualizada = rows[0];


            // ----------------------------------------------------
            // PASO 10. REGISTRAR EL CAMBIO EN AUDITORÍA
            // ----------------------------------------------------

            const sqlAuditoria = `
                INSERT INTO auditoria_reservas (
                    parroquia_id,
                    reserva_id,
                    usuario_id,
                    accion,
                    detalle
                )
                VALUES ($1, $2, $3, $4, $5)
            `;

            await client.query(sqlAuditoria, [
                user.parroquiaId,
                id,
                user.id,
                estado,
                observacion || null
            ]);


            // ----------------------------------------------------
            // PASO 11. DEVOLVER LA RESERVA ACTUALIZADA
            // ----------------------------------------------------

            return {
                type: 'OK',
                data: reservaActualizada
            };

        });
    }

}
