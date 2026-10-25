
//
// ============================================================
// MÓDULO: RUTAS DE RESERVAS PARROQUIALES
// ============================================================
//
// Este archivo define los endpoints HTTP del módulo.
//
// Responsabilidades:
// 1. Crear el Router de Express.
// 2. Conectar Controller, Service y Repository.
// 3. Aplicar middleware de autenticación y autorización.
// 4. Asociar cada endpoint con su método del Controller.
//
// ============================================================


// ============================================================
// 1. IMPORTAR DEPENDENCIAS
// ============================================================

// Router de Express.
import { Router } from 'express';

// Componentes del módulo de reservas.
import { ReservasController } from './reservas.controller.js';
import { ReservasService } from './reservas.service.js';
import { ReservasRepository } from './reservas.repository.js';

// Middleware para manejar errores de funciones asíncronas.
import { asyncHandler } from '../../shared/http/asyncHandler.js';

// Middleware de autenticación y autorización.
import {
    requireAuth,
    requireRole
} from '../../shared/auth/session.js';


// ============================================================
// 2. CREAR EL ROUTER DE EXPRESS
// ============================================================

// Router agrupa los endpoints del módulo de reservas.
const router = Router();


// ============================================================
// 3. CREAR LAS INSTANCIAS DE LAS CAPAS
// ============================================================

// Repository:
// Responsable de las consultas SQL y transacciones.
const repository = new ReservasRepository();

// Service:
// Responsable de las validaciones y reglas de negocio.
// Recibe el Repository mediante su constructor.
const service = new ReservasService(repository);

// Controller:
// Responsable de recibir solicitudes HTTP y generar
// las respuestas JSON.
// Recibe el Service mediante su constructor.
const controller = new ReservasController(service);


// ============================================================
// 4. APLICAR AUTENTICACIÓN A TODAS LAS RUTAS
// ============================================================

// Toda solicitud a este Router debe provenir de un
// usuario autenticado.
//
// Si la sesión no es válida, requireAuth impide continuar.
router.use(requireAuth);


// ============================================================
// 5. CONSULTAR ESPACIOS PARROQUIALES
// ============================================================
//
// Método: GET
// Endpoint: /api/reservas/espacios
//
// Devuelve los espacios habilitados para la parroquia
// del usuario autenticado.
//
// Roles: cualquier usuario autenticado.
// ============================================================

router.get(
    '/espacios',
    asyncHandler(controller.listarEspacios)
);


// ============================================================
// 6. CONSULTAR DISPONIBILIDAD DE UN ESPACIO
// ============================================================
//
// Método: GET
// Endpoint: /api/reservas/disponibilidad
//
// Parámetros de consulta:
// - espacioId
// - desde
// - hasta
//
// Consulta reservas aprobadas que coinciden con el
// intervalo solicitado.
//
// Roles: cualquier usuario autenticado.
// ============================================================

router.get(
    '/disponibilidad',
    asyncHandler(controller.disponibilidad)
);


// ============================================================
// 7. LISTAR RESERVAS
// ============================================================
//
// Método: GET
// Endpoint: /api/reservas
//
// Secretaría y párroco consultan las reservas de la parroquia.
// Los demás usuarios consultan únicamente sus reservas.
//
// Roles: cualquier usuario autenticado.
// ============================================================

router.get(
    '/',
    asyncHandler(controller.listar)
);


// ============================================================
// 8. CREAR UNA SOLICITUD DE RESERVA
// ============================================================
//
// Método: POST
// Endpoint: /api/reservas
//
// Recibe los datos de una solicitud de reserva.
// El Service valida la información.
// El Repository registra la solicitud en PostgreSQL.
//
// Estado inicial: PENDIENTE.
//
// Roles: cualquier usuario autenticado.
// ============================================================

router.post(
    '/',
    asyncHandler(controller.crear)
);


// ============================================================
// 9. APROBAR UNA SOLICITUD DE RESERVA
// ============================================================
//
// Método: PATCH
// Endpoint: /api/reservas/:id/aprobar
//
// Cambia el estado de una reserva a APROBADA.
//
// Antes de aprobar, el sistema verifica que no exista
// otra reserva aprobada que ocupe el mismo horario.
//
// Roles permitidos:
// - secretaria
// - parroco
// ============================================================

router.patch(
    '/:id/aprobar',

    // Verificar que el usuario tenga uno de los roles.
    requireRole('secretaria', 'parroco'),

    // Ejecutar el Controller con manejo de errores.
    asyncHandler(controller.aprobar)
);


// ============================================================
// 10. RECHAZAR UNA SOLICITUD DE RESERVA
// ============================================================
//
// Método: PATCH
// Endpoint: /api/reservas/:id/rechazar
//
// Cambia el estado de una reserva a RECHAZADA.
//
// El Service exige una observación que justifique
// el motivo del rechazo.
//
// Roles permitidos:
// - secretaria
// - parroco
// ============================================================

router.patch(
    '/:id/rechazar',

    // Verificar permisos administrativos.
    requireRole('secretaria', 'parroco'),

    // Ejecutar el Controller.
    asyncHandler(controller.rechazar)
);


// ============================================================
// 11. CANCELAR UNA RESERVA
// ============================================================
//
// Método: PATCH
// Endpoint: /api/reservas/:id/cancelar
//
// Permite cancelar una reserva PENDIENTE o APROBADA.
//
// La autorización final se valida en el Repository:
// - Secretaría y párroco pueden cancelar reservas.
// - Un usuario no administrativo solamente puede
//   cancelar sus propias reservas.
//
// Roles: cualquier usuario autenticado,
// sujeto a la validación de propiedad de la reserva.
// ============================================================

router.patch(
    '/:id/cancelar',
    asyncHandler(controller.cancelar)
);


// ============================================================
// 12. EXPORTAR EL ROUTER
// ============================================================

// Permite registrar estas rutas desde app.js,
// por ejemplo:
//
// app.use('/api/reservas', reservasRouter);
//
export default router;
