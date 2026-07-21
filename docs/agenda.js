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

    // 1. Generar 7 días a partir de HOY (usando la base ajustada a Bolivia)
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
    const horasDisponibles = ["08:00", "09:30", "11:00", "14:00", "15:30", "17:00", "18:30", "19:30", "19:45", "19:50", "22:15", "22:27", "22:35", "22:47", "22:55"];

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

    // --- ASEGURAR REGISTRO DE ALARMA Y PERMISOS AL ENVIAR LA CITA ---
    if (btnSubmit) {
        btnSubmit.addEventListener('click', async (e) => {
            // Pedir permisos de notificación nativa del navegador de forma obligatoria al agendar
            if ("Notification" in window && Notification.permission !== "granted") {
                await Notification.requestPermission();
            }

            setTimeout(() => {
                const idSolicitud = localStorage.getItem('id_solicitud');
                const fechaSel = fechaInput.value;
                const horaSel = horaHidden.value;

                if (idSolicitud && fechaSel && horaSel) {
                    const horaCita = new Date(`${fechaSel}T${horaSel}`);
                    // PRUEBA RÁPIDA: Restamos 2 minutos
                    const tiempoAlerta = new Date(horaCita.getTime() - (2 * 60 * 1000));

                    const datosAlarma = {
                        id: idSolicitud,
                        tiempoAlertaMs: tiempoAlerta.getTime(),
                        mensaje: "¡Hola! Tu servicio de mantenimiento está por comenzar. Haz clic aquí para ver la unidad móvil en camino."
                    };

                    localStorage.setItem('alarma_servicio', JSON.stringify(datosAlarma));
                    console.log("Alarma configurada correctamente con permisos otorgados.");
                }
            }, 1000); 
        });
    }

   // --- MONITOREO LOCAL EN AGENDA (Si el usuario sigue en la pantalla de agenda) ---
    setInterval(async () => {
        const id = localStorage.getItem('id_solicitud');
        if (!id) return; 

        const { data, error } = await client.from('solicitudes')
            .select('fecha_solicitud, hora_solicitud, respuesta_solicitud')
            .eq('solicitud_id', parseInt(id))
            .maybeSingle();

        if (error || !data) return;

        const horaProgramada = new Date(`${data.fecha_solicitud}T${data.hora_solicitud}`);
        const ahoraMonitoreo = new Date();
        const faltanMinutos = (horaProgramada - ahoraMonitoreo) / (1000 * 60);

        console.log(`Monitoreando ID ${id} - Faltan minutos: ${faltanMinutos.toFixed(2)}`);

        if (faltanMinutos > 0 && faltanMinutos <= 2) {
            if (Notification.permission === "granted") {
                new Notification("PRUEBA DE SERVICIO", {
                    body: "¡Hola! Tu servicio de mantenimiento está por comenzar. Haz clic aquí para ver la unidad móvil en camino.",
                    icon: "logo_1.jpeg"
                });
            }
            
            if (!window.location.pathname.includes('espera.html')) {
                window.location.href = 'espera.html';
            }
        }
    }, 5000); 
};
