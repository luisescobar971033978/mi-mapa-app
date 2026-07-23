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
    
    // Obtenemos fecha y hora local ajustada a Bolivia (-4 horas)
    const ahora = new Date();
    const offsetBolivia = -4 * 60 * 60 * 1000;
    const fechaBolivia = new Date(ahora.getTime() + offsetBolivia);
    const fechaActual = fechaBolivia.toISOString().split('T')[0];
    const horaActual = ahora.getHours();

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

    // 2. Generar 7 días a partir de HOY
    const dias = [];
    const nombresDias = ["DOMINGO", "LUNES", "MARTES", "MIÉRCOLES", "JUEVES", "VIERNES", "SÁBADO"];
    for (let i = 0; i < 7; i++) {
        const d = new Date(fechaBolivia.getTime()); 
        d.setDate(d.getDate() + i);
        const fStr = d.toISOString().split('T')[0];
        const label = `${nombresDias[d.getDay()]}<br><span class="text-[8px]">${d.getDate()}/${(d.getMonth() + 1)}</span>`;
        dias.push({ fecha: fStr, label: label });
        document.getElementById(`head-${i}`).innerHTML = label;
    }

    const { data: ocupados } = await client.from('solicitudes').select('solicitud_id, fecha_solicitud, hora_solicitud').in('fecha_solicitud', dias.map(d => d.fecha));

    tableBody.innerHTML = '';
    const horasDisponibles = ["08:00", "09:30", "11:00", "13:45", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00", "17:30", "18:00", "19:30", "20:00", "20:30", "21:00", "21:30"];

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

                        // --- NUEVO: LLAMADA ASINCRÓNICA PARA EL SMS ---
                        // Obtenemos el teléfono del usuario (puedes adaptarlo según cómo lo guardes en localStorage o en el formulario)
                        const telefonoUsuario = localStorage.getItem('telefono_usuario') || ''; 
                        const mensajeTexto = `Tu mantenimiento solicitado #${idSolicitud} programado para las ${horaSel} ha sido confirmado con éxito.`;

                        if (telefonoUsuario) {
                            // Petición asincrónica a tu Edge Function de Supabase para disparar el SMS
                            fetch("https://tu-proyecto.supabase.co/functions/v1/enviar-sms", {
                                method: "POST",
                                headers: {
                                    "Content-Type": "application/json",
                                    // "Authorization": `Bearer ${client.supabaseKey}` // O tu clave anon correspondiente si aplica
                                },
                                body: JSON.stringify({
                                    telefono: telefonoUsuario,
                                    mensaje: mensajeTexto
                                })
                            })
                            .then(res => res.json())
                            .then(data => console.log("SMS programado/enviado con éxito:", data))
                            .catch(err => console.error("Error en petición asincrónica de SMS:", err));
                        }
                        // ---------------------------------------------

                    } catch (err) {
                        console.error("Error al procesar la suscripción push:", err);
                    }
                }
            }, 1000); 
        });
    }
};
