
//
// ============================================================
// 1. VARIABLES Y FUNCIONES GENERALES
// ============================================================
//

// Función auxiliar para obtener un elemento HTML por su ID.
const $ = (id) => {
    return document.getElementById(id);
};

// Almacena la información del usuario autenticado.
let user = null;


// ============================================================
// 2. MOSTRAR MENSAJES AL USUARIO
// ============================================================

function msg(texto) {

    const elementoMensaje = $('message');

    elementoMensaje.textContent = texto;
}


// ============================================================
// 3. CONSUMIR LA API REST
// ============================================================

async function api(url, options = {}) {

    // Enviar la solicitud HTTP al backend.
    const respuesta = await fetch(url, {
        credentials: 'same-origin',

        headers: {
            'Content-Type': 'application/json'
        },

        ...options
    });

    // Convertir la respuesta del servidor a JSON.
    const json = await respuesta.json();

    // Verificar si la solicitud presentó algún error.
    if (!respuesta.ok) {

        throw new Error(
            json.message || `HTTP ${respuesta.status}`
        );
    }

    // Devolver únicamente los datos de la respuesta.
    return json.data;
}


// ============================================================
// 4. CONVERTIR FECHAS A FORMATO ISO 8601
// ============================================================

function iso(fechaLocal) {

    // Convertir el valor del campo datetime-local a Date.
    const fecha = new Date(fechaLocal);

    // Verificar que la fecha sea válida.
    if (!Number.isFinite(fecha.getTime())) {

        throw new Error('Fecha inválida');
    }

    // Convertir la fecha a ISO con zona horaria UTC.
    return fecha.toISOString();
}


// ============================================================
// 5. OBTENER LOS VALORES DE UN FORMULARIO
// ============================================================

function values(formulario) {

    // FormData obtiene los campos del formulario.
    const datosFormulario = new FormData(formulario);

    // Convertir los campos a un objeto JavaScript.
    return Object.fromEntries(datosFormulario);
}


// ============================================================
// 6. CARGAR ESPACIOS Y RESERVAS
// ============================================================

async function load() {

    // Consultar los espacios parroquiales habilitados.
    const espacios = await api('/api/reservas/espacios');

    // Obtener el selector HTML.
    const selectorEspacios = $('espacio');

    // Crear un elemento <option> por cada espacio.
    const opciones = espacios.map((espacio) => {

        const opcion = document.createElement('option');

        opcion.value = espacio.id;
        opcion.textContent = espacio.nombre;

        return opcion;
    });

    // Reemplazar las opciones anteriores.
    selectorEspacios.replaceChildren(...opciones);

    // Cargar el listado de reservas.
    await list();
}


// ============================================================
// 7. CONSULTAR Y MOSTRAR RESERVAS
// ============================================================

async function list() {

    // Obtener las reservas desde la API.
    const reservas = await api('/api/reservas');

    // Obtener el cuerpo de la tabla HTML.
    const tablaReservas = $('tbody');

    // Limpiar las filas anteriores.
    tablaReservas.replaceChildren();


    // Recorrer las reservas recibidas.
    for (const reserva of reservas) {

        // Crear una nueva fila HTML.
        const fila = document.createElement('tr');


        // ----------------------------------------------------
        // 7.1 PREPARAR LOS VALORES DE LA FILA
        // ----------------------------------------------------

        const valores = [
            reserva.id,
            reserva.espacio,
            reserva.solicitante,
            new Date(reserva.inicio).toLocaleString('es-CO'),
            new Date(reserva.fin).toLocaleString('es-CO'),
            reserva.estado
        ];


        // ----------------------------------------------------
        // 7.2 CREAR LAS COLUMNAS DE LA FILA
        // ----------------------------------------------------

        for (const valor of valores) {

            const columna = document.createElement('td');

            // textContent evita interpretar el contenido como HTML.
            columna.textContent = valor;

            fila.append(columna);
        }


        // ----------------------------------------------------
        // 7.3 PREPARAR LA COLUMNA DE ACCIONES
        // ----------------------------------------------------

        const columnaAcciones = document.createElement('td');

        // Almacena los botones permitidos para esta reserva.
        const botones = [];


        // ----------------------------------------------------
        // 7.4 DETERMINAR SI SE PUEDE APROBAR O RECHAZAR
        // ----------------------------------------------------

        // En la interfaz original, cualquier usuario diferente
        // de "feligrés" puede ver estos botones.
        //
        // El backend valida los permisos reales.

        if (
            reserva.estado === 'PENDIENTE' &&
            user.role !== 'feligrés'
        ) {

            botones.push(
                ['Aprobar', 'aprobar'],
                ['Rechazar', 'rechazar']
            );
        }


        // ----------------------------------------------------
        // 7.5 DETERMINAR SI SE PUEDE CANCELAR
        // ----------------------------------------------------

        if (
            ['PENDIENTE', 'APROBADA'].includes(reserva.estado)
        ) {

            botones.push(
                ['Cancelar', 'cancelar']
            );
        }


        // ----------------------------------------------------
        // 7.6 CREAR LOS BOTONES DE ACCIÓN
        // ----------------------------------------------------

        for (const [textoBoton, accion] of botones) {

            const boton = document.createElement('button');

            boton.textContent = textoBoton;


            // ------------------------------------------------
            // 7.7 EVENTO CLICK DE CADA BOTÓN
            // ------------------------------------------------

            boton.onclick = async () => {

                let observacion = '';


                // Solicitar motivo cuando la acción es RECHAZAR.
                if (accion === 'rechazar') {

                    observacion = prompt(
                        'Motivo obligatorio del rechazo:'
                    );

                } else if (accion === 'cancelar') {

                    // Solicitar observación opcional al cancelar.
                    observacion = prompt(
                        'Motivo de cancelación (opcional):'
                    );
                }


                // Si el usuario cancela el cuadro de diálogo,
                // no ejecutar ninguna operación.
                if (observacion === null) {
                    return;
                }


                try {

                    // Construir la dirección del endpoint.
                    const url = `/api/reservas/${reserva.id}/${accion}`;

                    // Enviar la solicitud al backend.
                    await api(url, {
                        method: 'PATCH',

                        body: JSON.stringify({
                            observacion: observacion
                        })
                    });


                    // Mostrar confirmación.
                    msg(`Reserva ${accion}: correcta`);


                    // Recargar el listado.
                    await list();

                } catch (error) {

                    // Mostrar el mensaje devuelto por el backend.
                    msg(error.message);
                }
            };


            // Incorporar el botón en la columna de acciones.
            columnaAcciones.append(boton);
        }


        // ----------------------------------------------------
        // 7.8 AGREGAR LA COLUMNA DE ACCIONES A LA FILA
        // ----------------------------------------------------

        fila.append(columnaAcciones);


        // ----------------------------------------------------
        // 7.9 AGREGAR LA FILA A LA TABLA
        // ----------------------------------------------------

        tablaReservas.append(fila);
    }
}


// ============================================================
// 8. INGRESAR A LA APLICACIÓN
// ============================================================

async function enter(usuario) {

    // Guardar los datos del usuario autenticado.
    user = usuario;

    // Ocultar formulario de inicio de sesión.
    $('login').hidden = true;

    // Mostrar la aplicación.
    $('app').hidden = false;

    // Mostrar la información de la sesión.
    $('session').textContent =
        `Sesión: ${usuario.nombre || usuario.role} (${usuario.role})`;

    // Cargar los espacios y las reservas.
    await load();
}


// ============================================================
// 9. EVENTO: INICIAR SESIÓN
// ============================================================

$('loginForm').onsubmit = async (evento) => {

    // Evitar el envío tradicional del formulario.
    evento.preventDefault();

    try {

        // Obtener correo y contraseña.
        const datos = values(evento.target);

        // Enviar las credenciales al backend.
        const usuario = await api('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify(datos)
        });

        // Ingresar a la aplicación.
        await enter(usuario);

        // Mostrar mensaje de confirmación.
        msg('Sesión iniciada');

    } catch (error) {

        msg(error.message);
    }
};


// ============================================================
// 10. EVENTO: CERRAR SESIÓN
// ============================================================

$('logout').onclick = async () => {

    // Solicitar al backend finalizar la sesión.
    await api('/api/auth/logout', {
        method: 'POST'
    });

    // Recargar la página para mostrar nuevamente el login.
    location.reload();
};


// ============================================================
// 11. EVENTO: SOLICITAR UNA RESERVA
// ============================================================

$('bookingForm').onsubmit = async (evento) => {

    evento.preventDefault();

    try {

        // Obtener los valores del formulario.
        const datos = values(evento.target);

        // Convertir las fechas al formato esperado por la API.
        datos.inicio = iso(datos.inicio);
        datos.fin = iso(datos.fin);


        // Enviar los datos al backend.
        const reservaCreada = await api('/api/reservas', {
            method: 'POST',
            body: JSON.stringify(datos)
        });


        // Mostrar confirmación con el número de reserva.
        msg(
            `Solicitud #${reservaCreada.id} registrada como PENDIENTE`
        );


        // Actualizar el listado.
        await list();

    } catch (error) {

        msg(error.message);
    }
};


// ============================================================
// 12. EVENTO: CONSULTAR DISPONIBILIDAD
// ============================================================

$('check').onclick = async () => {

    try {

        // Obtener los valores del formulario.
        const datos = values($('bookingForm'));


        // Construir la URL con sus parámetros.
        const url =
            '/api/reservas/disponibilidad' +
            `?espacioId=${encodeURIComponent(datos.espacioId)}` +
            `&desde=${encodeURIComponent(iso(datos.inicio))}` +
            `&hasta=${encodeURIComponent(iso(datos.fin))}`;


        // Consultar reservas aprobadas que coincidan.
        const reservasOcupadas = await api(url);


        // Mostrar el resultado.
        if (reservasOcupadas.length > 0) {

            msg(
                `Hay ${reservasOcupadas.length} reserva(s) ` +
                'aprobada(s) que coinciden con este horario'
            );

        } else {

            msg(
                'Sin reservas aprobadas en ese intervalo ' +
                '(sujeto a aprobación).'
            );
        }

    } catch (error) {

        msg(error.message);
    }
};


// ============================================================
// 13. EVENTO: ACTUALIZAR LISTADO
// ============================================================

$('refresh').onclick = () => {

    list().catch((error) => {
        msg(error.message);
    });
};


// ============================================================
// 14. RESTAURAR LA SESIÓN AL CARGAR LA PÁGINA
// ============================================================

// Consultar si existe una sesión autenticada.
api('/api/auth/me')

    // Si hay sesión, mostrar directamente la aplicación.
    .then(enter)

    // Si no hay sesión, permanecer en el formulario de login.
    .catch(() => {});
