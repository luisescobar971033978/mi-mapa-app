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
    const fechaInput = document.getElementById(fechaInputId);
    const horaHidden = document.getElementById(horaHiddenId);
    const btnSubmit = document.getElementById(btnSubmitId);
    
    // Obtener fecha y hora exacta de Bolivia de forma infalible mediante Intl
    const opcionesFecha = { timeZone: 'America/La_Paz', year: 'numeric', month: '2-digit', day: '2-digit' };
    const opcionesHora = { timeZone: 'America/La_Paz', hour: '2-digit', minute: '2-digit', hour12: false };
    
    const formatterFecha = new Intl.DateTimeFormat('en-CA', opcionesFecha); // Devuelve YYYY-MM-DD
    const formatterHora = new Intl.DateTimeFormat('en-GB', opcionesHora);   // Devuelve HH:mm
    
    const ahoraDinamico = new Date();
    const fechaActual = formatterFecha.format(ahoraDinamico);
    const horaActualStr = formatterHora.format(ahoraDinamico);
    
    const [hActual, mActual] = horaActualStr.split(':').map(Number);
    const horaActualMinutos = hActual * 60 + mActual;

    btnSubmit.disabled = true;

    // --- 1. REGISTRAR EL SERVICE WORKER AL CARGAR LA AGENDA ---
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js')
        .then((reg) => {
            console.log('Service Worker de notificaciones registrado exitosamente.');
        })
        .catch((err) => {
            console.error('Error al registrar el Service Worker:', err);
        });
    }

    // 2. Generar 7 días a partir de HOY basados en Bolivia
    const dias = [];
    const nombresDias = ["DOMINGO", "LUNES", "MARTES", "MIÉRCOLES", "JUEVES", "VIERNES", "SÁBADO"];
    
    // Parseamos la fecha actual de Bolivia para los incrementos de días sin desfase
    const [anioA, mesA, diaA] = fechaActual.split('-').map(Number);
    const baseDate = new Date(anioA, mesA - 1, diaA);

    for (let i = 0; i < 7; i++) {
        const d = new Date(baseDate.getTime());
        d.setDate(baseDate.getDate() + i);
        
        const fStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const label = `${nombresDias[d.getDay()]}<br><span class="text-[8px]">${d.getDate()}/${(d.getMonth() + 1)}</span>`;
        dias.push({ fecha: fStr, label: label });
        
        const headElement = document.getElementById(`head-${i}`);
        if (headElement) headElement.innerHTML = label;
    }

    // Consultamos todas las solicitudes de los días correspondientes
    const { data: solicitudesBD } = await client
        .from('solicitudes')
        .select('solicitud_id, fecha_solicitud, hora_solicitud, respuesta_solicitud')
        .in('fecha_solicitud', dias.map(d => d.fecha));

    // Lógica de filtrado de ocupados con validación estricta de tareas finalizadas antes de tiempo
    const ocupados = (solicitudesBD || []).filter(o => {
        if (!o.respuesta_solicitud || o.respuesta_solicitud.toLowerCase() !== 'finalizado') {
            return true; // Sigue ocupado si no está finalizado
        }

        // Si es de otra fecha, se mantiene ocupado/finalizado
        if (o.fecha_solicitud !== fechaActual) {
            return true; 
        }

        // Evaluamos si el trabajo se realizó antes del horario previsto hoy
        const horaSolStr = o.hora_solicitud ? o.hora_solicitud.substring(0, 5) : "00:00";
        const [hSol, mSol] = horaSolStr.split(':').map(Number);
        const minutosSolicitud = hSol * 60 + mSol;

        if (horaActualMinutos < minutosSolicitud) {
            // Finalizado antes de la hora: SE LIBERA (retornamos false para excluirlo de ocupados)
            return false;
        }

        return true;
    });

    tableBody.innerHTML = '';
    const horasDisponibles = ["08:00", "09:00", "10:00", "11:00", "12:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00", "21:00", "22:00", "22:30", "23:00", "23:30"];

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
            const minutosCelda = h * 60 + m;
            
            // Validación exacta por comparación de cadenas de fecha y total de minutos para horas pasadas
            const esPasado = (dia.fecha < fechaActual) || (dia.fecha === fechaActual && minutosCelda <= horaActualMinutos);
            const ocupado = ocupados.find(o => o.fecha_solicitud === dia.fecha && o.hora_solicitud && o.hora_solicitud.substring(0, 5) === horaStr);

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
                    fechaInput.value = dia.fecha;
                    horaHidden.value = horaStr;
                    btnSubmit.disabled = false;
                };
            }
            row.appendChild(td);
        });
        tableBody.appendChild(row);
    });

    // --- 3. PEDIR VOBO (PERMISO) Y OBTENER SUSCRIPCIÓN PUSH PARA SUPABASE ---
    if (btnSubmit) {
        btnSubmit.addEventListener('click', async (e) => {
            if ("Notification" in window && Notification.permission !== "granted") {
                const permissionResult = await Notification.requestPermission();
                if (permissionResult !== "granted") {
                    console.log("El usuario denegó las notificaciones.");
                    return;
                }
            }

            setTimeout(async () => {
                const idSolicitud = localStorage.getItem('id_solicitud');
                const fechaSel = fechaInput.value;
                const horaSel = horaHidden.value;

                if (idSolicitud && fechaSel && horaSel) {
                    try {
                        const registration = await navigator.serviceWorker.ready;
                        
                        const publicVapidKey = "BB39ZxbYgFwqQtc4sJonYgzl-SS5n-fnJ6xBf5AFI9_xrmhs00qImHbVjeGYEQKMcaHIZfsH-fXs2LK1bVpMuwI"; 

                        let pushSubscription = null;
                        if (publicVapidKey && publicVapidKey !== 'TU_CLAVE_PUBLICA_VAPID_AQUI') {
                            pushSubscription = await registration.pushManager.subscribe({
                                userVisibleOnly: true,
                                applicationServerKey: urlBase64ToUint8Array(publicVapidKey)
                            });
                        }

                        // Actualizamos el registro en Supabase incluyendo la suscripción push
                        const { error: updateError } = await client
                            .from('solicitudes')
                            .update({ push_subscription: pushSubscription })
                            .eq('solicitud_id', idSolicitud);

                        if (updateError) {
                            console.error("Error al guardar la suscripción push en Supabase:", updateError);
                        } else {
                            console.log("¡Suscripción push guardada exitosamente en Supabase!");
                        }
                        
                    } catch (err) {
                        console.error("Error al procesar la suscripción push:", err);
                    }
                }
            }, 1000); 
        });
    }
};
