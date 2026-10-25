
export class ReservasController {

    // ============================================================
    // 1. CONSTRUCTOR
    // ============================================================

    constructor(service) {

        // Servicio encargado de las reglas de negocio
        // y de comunicarse con el Repository.
        this.service = service;
    }


    // ============================================================
    // 2. LISTAR ESPACIOS DISPONIBLES DE LA PARROQUIA
    // ============================================================

    listarEspacios = async (req, res) => {

        // Obtener la parroquia del usuario autenticado.
        const parroquiaId = req.user.parroquiaId;

        // Solicitar los espacios al Service.
        const espacios = await this.service.listarEspacios(
            parroquiaId
        );

        // Devolver respuesta HTTP.
        return res.json({
            success: true,
            data: espacios,
            message: 'Espacios',
            errors: []
        });
    };


    // ============================================================
    // 3. CONSULTAR DISPONIBILIDAD DE UN ESPACIO
    // ============================================================

    disponibilidad = async (req, res) => {

        // Obtener la parroquia del usuario autenticado.
        const parroquiaId = req.user.parroquiaId;

        // Obtener los parámetros de la consulta HTTP.
        // Ejemplo: espacioId, desde y hasta.
        const parametros = req.query;

        // Consultar disponibilidad a través del Service.
        const disponibilidad = await this.service.disponibilidad(
            parroquiaId,
            parametros
        );

        // Devolver respuesta HTTP.
        return res.json({
            success: true,
            data: disponibilidad,
            message: 'Disponibilidad',
            errors: []
        });
    };


    // ============================================================
    // 4. LISTAR RESERVAS DEL USUARIO O DE LA PARROQUIA
    // ============================================================

    listar = async (req, res) => {

        // Obtener el usuario autenticado.
        const usuario = req.user;

        // El Service solicita las reservas al Repository.
        // El Repository aplica el filtro según el rol.
        const reservas = await this.service.listar(usuario);

        // Devolver respuesta HTTP.
        return res.json({
            success: true,
            data: reservas,
            message: 'Reservas',
            errors: []
        });
    };


    // ============================================================
    // 5. CREAR UNA NUEVA SOLICITUD DE RESERVA
    // ============================================================

    crear = async (req, res) => {

        // Obtener el usuario autenticado.
        const usuario = req.user;

        // Obtener los datos enviados desde el frontend.
        const datosReserva = req.body;

        // Solicitar al Service la creación de la reserva.
        const reservaCreada = await this.service.solicitar(
            usuario,
            datosReserva
        );

        // Código HTTP 201: recurso creado correctamente.
        return res.status(201).json({
            success: true,
            data: reservaCreada,
            message: 'Solicitud registrada',
            errors: []
        });
    };


    // ============================================================
    // 6. APROBAR UNA SOLICITUD DE RESERVA
    // ============================================================

    aprobar = async (req, res) => {

        // Obtener el usuario autenticado.
        const usuario = req.user;

        // Obtener el ID de la reserva desde la URL.
        const reservaId = req.params.id;

        // Obtener una observación opcional.
        const observacion = req.body?.observacion;

        // Solicitar al Service cambiar el estado a APROBADA.
        const reservaAprobada = await this.service.cambiarEstado(
            usuario,
            reservaId,
            'APROBADA',
            observacion
        );

        // Devolver respuesta HTTP.
        return res.json({
            success: true,
            data: reservaAprobada,
            message: 'Aprobada',
            errors: []
        });
    };


    // ============================================================
    // 7. RECHAZAR UNA SOLICITUD DE RESERVA
    // ============================================================

    rechazar = async (req, res) => {

        // Obtener el usuario autenticado.
        const usuario = req.user;

        // Obtener el ID de la reserva desde la URL.
        const reservaId = req.params.id;

        // Obtener la justificación del rechazo.
        const observacion = req.body?.observacion;

        // El Service valida que exista un motivo de rechazo.
        const reservaRechazada = await this.service.cambiarEstado(
            usuario,
            reservaId,
            'RECHAZADA',
            observacion
        );

        // Devolver respuesta HTTP.
        return res.json({
            success: true,
            data: reservaRechazada,
            message: 'Rechazada',
            errors: []
        });
    };


    // ============================================================
    // 8. CANCELAR UNA RESERVA
    // ============================================================

    cancelar = async (req, res) => {

        // Obtener el usuario autenticado.
        const usuario = req.user;

        // Obtener el ID de la reserva desde la URL.
        const reservaId = req.params.id;

        // Obtener una observación opcional.
        const observacion = req.body?.observacion;

        // Solicitar al Service cambiar el estado a CANCELADA.
        const reservaCancelada = await this.service.cambiarEstado(
            usuario,
            reservaId,
            'CANCELADA',
            observacion
        );

        // Devolver respuesta HTTP.
        return res.json({
            success: true,
            data: reservaCancelada,
            message: 'Cancelada',
            errors: []
        });
    };

}
