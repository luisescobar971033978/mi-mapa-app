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
    const horasDisponibles = ["08:00", "09:30", "11:00", "14:00", "15:30", "17:00", "18:30", "19:30", "19:45", "19:50", "22:15", "22:27", "22:35", "22:47", "22:55", "23:08", "23:15", "23:30"];

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

    // --- 3. PEDIR VOBO (PERMISO) Y ENVIAR LA ORDEN AL SERVICE WORKER EXTERNO ---
    if (btnSubmit) {
        btnSubmit.addEventListener('click', async (e) => {
            // Solicitud explícita del visto bueno (permiso de notificaciones del sistema)
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
                    const horaCita = new Date(`${fechaSel}T${horaSel}`);
                    
                    // PRUEBA RÁPIDA: Restamos 2 minutos para el disparo de la alerta
                    const tiempoAlertaMs = horaCita.getTime() - (2 * 60 * 1000);
                    const tiempoRestanteMs = tiempoAlertaMs - Date.now();

                    if (tiempoRestanteMs > 0 && 'serviceWorker' in navigator) {
                        try {
                            const registration = await navigator.serviceWorker.ready;
                            
                            if (registration.active) {
                                // Transferimos la responsabilidad del temporizador al Service Worker mediante postMessage
                                registration.active.postMessage({
                                    type: 'PROGRAMAR_ALARMA',
                                    delay: tiempoRestanteMs,
                                    title: "PRUEBA DE SERVICIO",
                                    body: "¡Hola! Tu servicio de mantenimiento está por comenzar. Haz clic aquí para ver la unidad móvil en camino."
                                });
                                console.log(`¡Vobo confirmado! Orden de alarma enviada al Service Worker para dentro de ${(tiempoRestanteMs / 1000).toFixed(0)} segundos.`);
                            }
                        } catch (err) {
                            console.error("Error al comunicarse con el Service Worker:", err);
                        }
                    }
                }
            }, 1000); 
        });
    }
};
