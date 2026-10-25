
import { AppError } from '../../shared/errors/AppError.js';
import { sendReservationNotice } from '../../shared/notifications/email.js';


export class ReservasService {

    // ============================================================
    // 1. CONSTRUCTOR
    // ============================================================

    constructor(repository, notifier = sendReservationNotice) {

        // Repositorio encargado de acceder a la base de datos.
        this.repository = repository;

        // Servicio encargado de enviar notificaciones.
        this.notifier = notifier;
    }


    // ============================================================
    // 2. LISTAR ESPACIOS DE LA PARROQUIA
    // ============================================================

    listarEspacios(parroquiaId) {

        // Solicitar los espacios al Repository.
        return this.repository.listarEspacios(parroquiaId);
    }


    // ============================================================
    // 3. LISTAR RESERVAS SEGÚN EL USUARIO
    // ============================================================

    listar(user) {

        // El Repository determina cuáles reservas puede consultar.
        return this.repository.listar(user);
    }


    // ============================================================
    // 4. VALIDAR FECHAS EN FORMATO ISO 8601
    // ============================================================

    validDate(fechaTexto) {

        // Verificar que la fecha sea un texto y que incluya
        // una zona horaria, como Z o -05:00.
        const formatoZonaHoraria = /(Z|[+-]\d\d:\d\d)$/i;

        if (
            typeof fechaTexto !== 'string' ||
            !formatoZonaHoraria.test(fechaTexto)
        ) {
            throw new AppError(
                'Fecha con zona horaria ISO 8601 obligatoria'
            );
        }

        // Convertir el texto recibido a un objeto Date.
        const fecha = new Date(fechaTexto);

        // Verificar que la fecha sea válida.
        if (!Number.isFinite(fecha.getTime())) {

            throw new AppError('Fecha inválida');
        }

        return fecha;
    }


    // ============================================================
    // 5. CONSULTAR DISPONIBILIDAD DE UN ESPACIO
    // ============================================================

    async disponibilidad(parroquiaId, query) {

        // --------------------------------------------------------
        // PASO 1. VALIDAR EL IDENTIFICADOR DEL ESPACIO
        // --------------------------------------------------------

        const espacioId = Number(query.espacioId);

        if (
            !Number.isSafeInteger(espacioId) ||
            espacioId < 1
        ) {
            throw new AppError('espacioId inválido');
        }


        // --------------------------------------------------------
        // PASO 2. VALIDAR FECHAS DE CONSULTA
        // --------------------------------------------------------

        const desde = this.validDate(query.desde);
        const hasta = this.validDate(query.hasta);


        // --------------------------------------------------------
        // PASO 3. VALIDAR EL INTERVALO DE CONSULTA
        // --------------------------------------------------------

        // Cantidad de milisegundos permitidos: 31 días.
        const maximoIntervalo = 31 * 86400000;

        const duracionIntervalo = hasta - desde;

        if (
            desde >= hasta ||
            duracionIntervalo > maximoIntervalo
        ) {
            throw new AppError(
                'Intervalo inválido (máximo 31 días)'
            );
        }


        // --------------------------------------------------------
        // PASO 4. CONSULTAR DISPONIBILIDAD EN EL REPOSITORY
        // --------------------------------------------------------

        return this.repository.disponibilidad(
            parroquiaId,
            espacioId,
            desde.toISOString(),
            hasta.toISOString()
        );
    }


    // ============================================================
    // 6. SOLICITAR UNA NUEVA RESERVA
    // ============================================================

    async solicitar(user, body) {

        // Si no se recibe información, utilizar un objeto vacío.
        body = body || {};


        // --------------------------------------------------------
        // PASO 1. VALIDAR EL IDENTIFICADOR DEL ESPACIO
        // --------------------------------------------------------

        const espacioId = Number(body.espacioId);

        if (
            !Number.isSafeInteger(espacioId) ||
            espacioId < 1
        ) {
            throw new AppError('espacioId inválido');
        }


        // --------------------------------------------------------
        // PASO 2. VALIDAR LOS CAMPOS OBLIGATORIOS
        // --------------------------------------------------------

        const camposObligatorios = [
            'solicitante',
            'correo',
            'motivo',
            'inicio',
            'fin'
        ];

        for (const campo of camposObligatorios) {

            const valor = body[campo];

            // Cada campo debe ser texto y no estar vacío.
            if (
                typeof valor !== 'string' ||
                !valor.trim()
            ) {
                throw new AppError(
                    `Campo obligatorio: ${campo}`
                );
            }
        }


        // --------------------------------------------------------
        // PASO 3. VALIDAR LA LONGITUD DE LOS TEXTOS
        // --------------------------------------------------------

        const solicitanteDemasiadoLargo =
            body.solicitante.length > 150;

        const correoDemasiadoLargo =
            body.correo.length > 200;

        const motivoDemasiadoLargo =
            body.motivo.length > 300;

        if (
            solicitanteDemasiadoLargo ||
            correoDemasiadoLargo ||
            motivoDemasiadoLargo
        ) {
            throw new AppError('Texto demasiado extenso');
        }


        // --------------------------------------------------------
        // PASO 4. VALIDAR EL FORMATO DEL CORREO ELECTRÓNICO
        // --------------------------------------------------------

        const formatoCorreo = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!formatoCorreo.test(body.correo)) {

            throw new AppError('Correo inválido');
        }


        // --------------------------------------------------------
        // PASO 5. VALIDAR FECHAS DE LA RESERVA
        // --------------------------------------------------------

        const inicio = this.validDate(body.inicio);
        const fin = this.validDate(body.fin);

        // La fecha inicial debe ser anterior a la final.
        if (inicio >= fin) {

            throw new AppError(
                'Rango de fechas inválido'
            );
        }

        // No se permiten reservas con fecha inicial pasada.
        if (inicio <= new Date()) {

            throw new AppError(
                'La reserva debe ser futura'
            );
        }


        // --------------------------------------------------------
        // PASO 6. PREPARAR LOS DATOS DE LA RESERVA
        // --------------------------------------------------------

        const datosReserva = {
            espacioId: espacioId,
            solicitante: body.solicitante.trim(),
            correo: body.correo.trim(),
            motivo: body.motivo.trim(),
            inicio: inicio.toISOString(),
            fin: fin.toISOString()
        };


        // --------------------------------------------------------
        // PASO 7. SOLICITAR LA CREACIÓN AL REPOSITORY
        // --------------------------------------------------------

        const resultado = await this.repository.crear(
            user,
            datosReserva
        );


        // --------------------------------------------------------
        // PASO 8. EVALUAR EL RESULTADO DE LA OPERACIÓN
        // --------------------------------------------------------

        const reservaCreada = this.resolveResult(resultado);


        // --------------------------------------------------------
        // PASO 9. NOTIFICAR QUE LA RESERVA ESTÁ PENDIENTE
        // --------------------------------------------------------

        await this.notify(
            reservaCreada,
            'PENDIENTE'
        );


        // --------------------------------------------------------
        // PASO 10. DEVOLVER LA RESERVA CREADA
        // --------------------------------------------------------

        return reservaCreada;
    }


    // ============================================================
    // 7. CAMBIAR EL ESTADO DE UNA RESERVA
    // ============================================================

    async cambiarEstado(user, id, estado, observacion) {

        // --------------------------------------------------------
        // PASO 1. VALIDAR EL IDENTIFICADOR DE LA RESERVA
        // --------------------------------------------------------

        const reservaId = Number(id);

        if (
            !Number.isSafeInteger(reservaId) ||
            reservaId < 1
        ) {
            throw new AppError('Id inválido');
        }


        // --------------------------------------------------------
        // PASO 2. VALIDAR LA OBSERVACIÓN
        // --------------------------------------------------------

        // La observación es opcional, pero si se recibe
        // debe ser un texto con máximo 500 caracteres.

        if (
            observacion !== undefined &&
            (
                typeof observacion !== 'string' ||
                observacion.length > 500
            )
        ) {
            throw new AppError('Observación inválida');
        }


        // --------------------------------------------------------
        // PASO 3. EXIGIR JUSTIFICACIÓN SI SE RECHAZA
        // --------------------------------------------------------

        if (
            estado === 'RECHAZADA' &&
            !observacion?.trim()
        ) {
            throw new AppError(
                'Debe indicar el motivo de rechazo'
            );
        }


        // --------------------------------------------------------
        // PASO 4. SOLICITAR EL CAMBIO AL REPOSITORY
        // --------------------------------------------------------

        const observacionLimpia = observacion?.trim();

        const resultado = await this.repository.cambiarEstado(
            user,
            reservaId,
            estado,
            observacionLimpia
        );


        // --------------------------------------------------------
        // PASO 5. EVALUAR EL RESULTADO
        // --------------------------------------------------------

        const reservaActualizada = this.resolveResult(
            resultado
        );


        // --------------------------------------------------------
        // PASO 6. ENVIAR LA NOTIFICACIÓN
        // --------------------------------------------------------

        await this.notify(
            reservaActualizada,
            estado
        );


        // --------------------------------------------------------
        // PASO 7. DEVOLVER LA RESERVA ACTUALIZADA
        // --------------------------------------------------------

        return reservaActualizada;
    }


    // ============================================================
    // 8. ENVIAR NOTIFICACIONES
    // ============================================================

    async notify(data, event) {

        try {

            // Utilizar el servicio compartido de notificaciones.
            await this.notifier(data, event);

        } catch (error) {

            // Si falla el correo, registrar el error.
            // No interrumpir la operación de reserva.
            console.error(
                'Error en notificación de reserva',
                data.id,
                error.message
            );
        }
    }


    // ============================================================
    // 9. INTERPRETAR RESULTADOS DEL REPOSITORY
    // ============================================================

    resolveResult(result) {

        // --------------------------------------------------------
        // CASO 1. REGISTRO NO ENCONTRADO
        // --------------------------------------------------------

        if (result.type === 'NOT_FOUND') {

            throw new AppError(
                'Reserva o espacio no encontrado',
                404,
                'NOT_FOUND'
            );
        }


        // --------------------------------------------------------
        // CASO 2. CONFLICTO DE HORARIO
        // --------------------------------------------------------

        if (result.type === 'CONFLICT') {

            throw new AppError(
                'El espacio ya está reservado en ese horario',
                409,
                'SCHEDULE_CONFLICT'
            );
        }


        // --------------------------------------------------------
        // CASO 3. TRANSICIÓN DE ESTADO NO PERMITIDA
        // --------------------------------------------------------

        if (result.type === 'INVALID_STATE') {

            throw new AppError(
                'Transición de estado no permitida',
                409,
                'INVALID_STATE'
            );
        }


        // --------------------------------------------------------
        // CASO 4. USUARIO SIN PERMISOS
        // --------------------------------------------------------

        if (result.type === 'FORBIDDEN') {

            throw new AppError(
                'Sin permiso para esta operación',
                403,
                'FORBIDDEN'
            );
        }


        // --------------------------------------------------------
        // CASO 5. OPERACIÓN EXITOSA
        // --------------------------------------------------------

        return result.data;
    }

}
