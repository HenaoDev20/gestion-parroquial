# Sistema Integrado de Gestión Parroquial — Base de arquitectura

**Plantilla académica de referencia**, no aplicación terminada ni apta para producción. Mantiene el stack propuesto: JavaScript ES Modules, Node.js, Express, PostgreSQL y API REST. Arquitectura **cliente-servidor de tres capas** y backend **monolítico modular**, con `route -> controller -> service -> repository -> database`.

## Contenido

- **Módulo funcional implementado:** reservas de espacios (consulta de espacios, solicitud, listado para administración, aprobación con comprobación de solapamientos).
- **Módulos con estructura reservada, NO desarrollados:** cursillos, calendario, eucaristías, sacramentos y patrimonio.
- **Componentes compartidos implementados mínimamente:** middleware de autenticación de prueba, control de roles y manejo uniforme de errores.
- **Componentes compartidos pendientes:** correo/notificaciones, auditoría, gestión documental y permisos avanzados.
- **Base SQL:** parroquias, espacios y reservas, con semillas de la Parroquia Nuestra Señora de la Candelaria.
- No se incluyen datos personales reales.

## Requisitos

Node.js 20 o superior, npm, Docker Desktop y Docker Compose para PostgreSQL (o una base PostgreSQL local).

## Pasos en Windows / PowerShell

```powershell
# Desde la carpeta descomprimida
Copy-Item .env.example .env
npm install
docker compose up -d
npm run dev
```

Abre http://localhost:3000/api/health ; se espera una respuesta con `success: true`.

> Si la base de datos ya existía antes de incluir el script SQL, Docker no reejecuta automáticamente los scripts de inicialización. Usa una base nueva o aplica `database/001_schema.sql` manualmente. No borres volúmenes con datos importantes.

## Probar las solicitudes desde PowerShell

```powershell
# Espacios disponibles
Invoke-RestMethod http://localhost:3000/api/reservas/espacios

# Reserva futura (ajusta fechas a un día futuro)
$body = @{
  espacioId = 1
  solicitante = 'Ana Pérez'
  correo = 'ana@example.com'
  motivo = 'Reunión comunitaria'
  inicio = '2030-06-20T10:00:00-05:00'
  fin = '2030-06-20T11:00:00-05:00'
} | ConvertTo-Json
Invoke-RestMethod -Method POST -Uri http://localhost:3000/api/reservas -ContentType 'application/json' -Body $body

# Administración (solo en modo demo local)
Invoke-RestMethod -Headers @{'x-demo-role'='secretaria'} http://localhost:3000/api/reservas
Invoke-RestMethod -Method PATCH -Headers @{'x-demo-role'='secretaria'} http://localhost:3000/api/reservas/1/aprobar
```

## Pruebas

```powershell
npm test
```

## Responsabilidades del ejemplo

- `reservas.routes.js`: endpoints HTTP y autorización básica.
- `reservas.controller.js`: forma de las respuestas HTTP.
- `reservas.service.js`: validación y reglas del proceso de solicitud.
- `reservas.repository.js`: SQL y transacciones.
- `shared/`: utilidades técnicas que pueden utilizar varios módulos.

## IMPORTANTES LIMITACIONES DE ESTA BASE

1. La cabecera `x-demo-role` es un mecanismo **simulado solo para pruebas locales**; **NO ofrece autenticación real**. En `NODE_ENV=production` las rutas protegidas fallan deliberadamente hasta integrar autenticación real.
2. La pertenencia a parroquia se fija en `1` solo para el ejemplo. Para multi-parroquia real, derivar el identificador de identidad verificada, autorizar pertenencia y aislar datos y archivos; jamás confiar en un `parroquiaId` enviado por el cliente.
3. La prevención de cruces usa bloqueo transaccional de PostgreSQL para las operaciones de creación y aprobación del ejemplo. Otros procesos que cambien estados u horarios deben respetar el mismo control. Evaluar restricciones `EXCLUDE USING gist` como garantía fuerte a nivel de base de datos.
4. Se debe agregar gestión real de usuarios, trazabilidad de cambios, notificaciones, respaldos, protección de archivos, validaciones exhaustivas, gestión de secretos, protección frente a abuso y pruebas de integración antes del despliegue.
5. La propuesta académica se limita al Templo Principal y Salón Parroquial. Una arquitectura preparada para escalar **no significa** que esta plantilla sea un sistema nacional listo para operar.
6. No se incluye frontend operativo: se deja documentada su capa, para desarrollarla posteriormente con HTML/CSS/JavaScript como propusieron los estudiantes.
