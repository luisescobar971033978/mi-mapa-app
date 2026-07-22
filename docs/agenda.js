// Función auxiliar para convertir la llave VAPID a Uint8Array
function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

export const inicializarAgenda = async (client, tableId, fechaInputId, horaHiddenId, btnSubmitId) => {
    const tableBody = document.getElementById('cuerpoAgenda');
    
    // Obtenemos fecha y hora local ajustada a Bolivia (-4 horas)
    const ahora = new Date();
    const offsetBolivia = -4 * 60 * 60 * 1000;
    const fechaBolivia = new Date(ahora.getTime() + offsetBolivia);
    const fechaActual = fechaBolivia.toISOString().split('T')[0];

    const btnSubmit = document.getElementById(btnSubmitId);
    if (btnSubmit) {
        btnSubmit.disabled = true;
    }

    // --- 1. REGISTRAR EL SERVICE WORKER AL CARGAR LA AGENDA ---
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js')
        .then(() => console.log('Service Worker registrado exitosamente.'))
        .catch((err) => console.error('Error al registrar el Service Worker:', err));
    }

    // 2. Generar 7 días a partir de HOY
    const dias = [];
    const nombresDias = ["DOMINGO", "LUNES", "MARTES", "MIÉRCOLES", "JUEVES", "VIERNES", "SÁBADO"];
    for (let i = 0; i < 7; i++) {
        const d = new Date(fechaBolivia.getTime()); 
        d.setDate(d.getDate() + i);
        const fStr = d.toISOString().split('T')[0];
        const label = `${nombresDias[d.getDay()]}<br><span class="text-[8px]">${d.getDate()}/${(d.getMonth() + 1)}</span>`;
        dias.push({ fecha: fStr, label: label });
        const headEl = document.getElementById(`head-${i}`);
        if (headEl) headEl.innerHTML = label;
    }

    const { data: ocupados } = await client.from('solicitudes').select('solicitud_id, fecha_solicitud, hora_solicitud').in('fecha_solicitud', dias.map(d => d.fecha));

    if (tableBody) {
        tableBody.innerHTML = '';
        const horasDisponibles = ["08:00", "09:30", "11:00", "12:30", "14:00", "15:30", "17:00", "18:00", "18:10", "18:20", "18:30", "18:40", "18:50", "19:00", "19:10", "19:20"];

        horasDisponibles.forEach(horaStr => {
            const row = document.createElement('tr');
            const cellHora = document.createElement('td');
            cellHora.className = "p-2 border font-bold text-teal-800";
            cellHora.innerText = horaStr;
            row.appendChild(cellHora);

            dias.forEach(dia => {
                const td = document.createElement('td');
                td.className = "border p-1 text-[9px]";
                
                const [h, m] = horaStr.split(':').map(Number);
                const horaCompletaActual = ahora.getHours() + (ahora.getMinutes() / 60);
                const horaCompletaCelda = h + (m / 60);
                
                const esPasado = (dia.fecha === fechaActual && horaCompletaCelda <= horaCompletaActual) || (dia.fecha < fechaActual);
                const ocupado = ocupados?.find(o => o.fecha_solicitud === dia.fecha && o.hora_solicitud.substring(0, 5) === horaStr);

                if (ocupado) {
                    td.classList.add('bg-green-500', 'text-white');
                    td.innerText = `ID:${ocupado.solicitud_id}`;
                } else if (esPasado) {
                    td.classList.add('bg-gray-100', 'text-gray-300');
                    td.innerText = "X";
                } else {
                    td.classList.add('bg-white', 'hover:bg-gray-200', 'cursor-pointer');
                    td.innerText = "Libre";
                    td.onclick = () => {
                        document.querySelectorAll('#cuerpoAgenda td').forEach(c => c.classList.remove('bg-yellow-400', 'font-bold'));
                        td.classList.add('bg-yellow-400', 'font-bold');
                        
                        const fInput = document.getElementById(fechaInputId);
                        const hHidden = document.getElementById(horaHiddenId);
                        if (fInput) fInput.value = dia.fecha;
                        if (hHidden) hHidden.value = horaStr;
                        if (btnSubmit) btnSubmit.disabled = false;
                    };
                }
                row.appendChild(td);
            });
            tableBody.appendChild(row);
        });
    }

    // --- 3. GESTIÓN DEL BOTÓN SOLICITAR SERVICIO (BLINDADO Y SINCRONIZADO) ---
    if (btnSubmit) {
        btnSubmit.addEventListener('click', (e) => {
            e.preventDefault();

            const fechaInputElem = document.getElementById(fechaInputId);
            const horaHiddenElem = document.getElementById(horaHiddenId);

            const fechaSel = fechaInputElem ? fechaInputElem.value : '';
            const horaSel = horaHiddenElem ? horaHiddenElem.value : '';

            if (!fechaSel || !horaSel) {
                alert("Por favor, seleccione una fecha y hora disponible en la agenda antes de solicitar el servicio.");
                return;
            }

            // Mostrar Modal de Éxito / Notificaciones
            const modalDiv = document.createElement('div');
            modalDiv.id = 'modalNotifPush';
            modalDiv.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4';
            modalDiv.innerHTML = `
                <div class="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 text-center transform transition-all">
                    <div class="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-teal-100 text-teal-600 mb-4">
                        <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path>
                        </svg>
                    </div>
                    <h3 class="text-xl font-bold text-gray-800 mb-2">¡Éxito!</h3>
                    <p class="text-sm text-gray-600 mb-6 leading-relaxed">
                        Solicitud enviada. Presione Aceptar para marcar su ubicación y continuar con el registro de su servicio. ¡Mantenga la aplicación abierta!
                    </p>
                    <button id="btnAceptarModal" type="button" class="w-full bg-teal-600 hover:bg-teal-700 text-white font-semibold py-2.5 px-4 rounded-lg transition duration-200 shadow-md">
                        Aceptar
                    </button>
                </div>
            `;
            document.body.appendChild(modalDiv);

            document.getElementById('btnAceptarModal').onclick = async () => {
                modalDiv.remove();

                try {
                    // Recuperar datos temporales almacenados del formulario inicial (Asegura que no se pierdan nombre, celular ni comentarios)
                    const nombreUsuario = localStorage.getItem('nombre_usuario') || '';
                    const celularContacto = localStorage.getItem('celular_contacto') || '';
                    const comentarioSolicitud = localStorage.getItem('comentario_solicitud') || '';
                    const movilId = localStorage.getItem('movil_id') || 'Movil_1';
                    const idTecnico = localStorage.getItem('id_tecnico') || '1234';
                    let idSolicitud = localStorage.getItem('id_solicitud');

                    let pushSubscription = null;
                    try {
                        if ("Notification" in window) {
                            if (Notification.permission !== "granted") {
                                await Notification.requestPermission();
                            }
                            if (Notification.permission === "granted") {
                                const registration = await navigator.serviceWorker.ready;
                                const publicVapidKey = "BB39ZxbYgFwqQtc4sJonYgzl-SS5n-fnJ6xBf5AFI9_xrmhs00qImHbVjeGYEQKMcaHIZfsH-fXs2LK1bVpMuwI"; 
                                if (publicVapidKey) {
                                    pushSubscription = await registration.pushManager.subscribe({
                                        userVisibleOnly: true,
                                        applicationServerKey: urlBase64ToUint8Array(publicVapidKey)
                                    });
                                }
                            }
                        }
                    } catch (pushErr) {
                        console.warn("Aviso: Notificaciones push omitidas o modo incógnito activo.", pushErr);
                    }

                    if (idSolicitud) {
                        // Si ya existe un registro previo, lo actualizamos con fecha, hora y push
                        const { error: updateError } = await client
                            .from('solicitudes')
                            .update({ 
                                nombre_usuario: nombreUsuario,
                                celular_contacto: celularContacto,
                                comentario_solicitud: comentarioSolicitud,
                                fecha_solicitud: fechaSel,
                                hora_solicitud: horaSel,
                                push_subscription: pushSubscription 
                            })
                            .eq('solicitud_id', idSolicitud);

                        if (updateError) console.error("Error al actualizar:", updateError);
                    } else {
                        // Si no existe, insertamos un registro completo nuevo para evitar campos vacíos NULL
                        const { data: insertData, error: insertError } = await client
                            .from('solicitudes')
                            .insert([{ 
                                nombre_usuario: nombreUsuario,
                                celular_contacto: celularContacto ? Number(celularContacto) : null,
                                comentario_solicitud: comentarioSolicitud,
                                fecha_solicitud: fechaSel,
                                hora_solicitud: horaSel,
                                movil_id: movilId,
                                id_tecnico: idTecnico,
                                push_subscription: pushSubscription 
                            }])
                            .select();

                        if (insertError) {
                            console.error("Error al insertar solicitud:", insertError);
                        } else if (insertData && insertData.length > 0) {
                            idSolicitud = insertData[0].solicitud_id;
                            localStorage.setItem('id_solicitud', idSolicitud);
                        }
                    }

                    // Continuar al flujo de coordenadas (Asegde que la redirección o siguiente vista ocurra aquí)
                    console.log("¡Flujo completado con éxito, procediendo a coordenadas!");
                    
                    // Si tienes una función o redirección para las coordenadas, colócala aquí.
                    // Por ejemplo: window.location.href = "mi-mapa.html"; 

                } catch (err) {
                    console.error("Error crítico en el flujo de guardado:", err);
                }
            };
        });
    }
};
