export const inicializarAgenda = async (client, tableId, fechaInputId, horaHiddenId, btnSubmitId) => {
    const tableBody = document.getElementById('cuerpoAgenda');
    const fechaInput = document.getElementById(fechaInputId);
    const horaHidden = document.getElementById(horaHiddenId);
    const btnSubmit = document.getElementById(btnSubmitId);
    
    // Obtenemos fecha y hora actual (ajustado a Bolivia: -4h de UTC)
    const ahora = new Date();
    const fechaActual = ahora.toISOString().split('T')[0];
    const horaActual = ahora.getHours(); 

    btnSubmit.disabled = true;

    // 1. Generar 7 días a partir de HOY
    const dias = [];
    const nombresDias = ["DOMINGO", "LUNES", "MARTES", "MIÉRCOLES", "JUEVES", "VIERNES", "SÁBADO"];
    for (let i = 0; i < 7; i++) {
        const d = new Date();
        d.setDate(d.getDate() + i);
        const fStr = d.toISOString().split('T')[0];
        const label = `${nombresDias[d.getDay()]}<br><span class="text-[8px]">${d.getDate()}/${(d.getMonth() + 1)}</span>`;
        dias.push({ fecha: fStr, label: label });
        document.getElementById(`head-${i}`).innerHTML = label;
    }

    const { data: ocupados } = await client.from('solicitudes').select('solicitud_id, fecha_solicitud, hora_solicitud').in('fecha_solicitud', dias.map(d => d.fecha));

    tableBody.innerHTML = '';
    // Horarios reestructurados con intervalos de 01:30
    const horasDisponibles = ["08:00", "09:30", "11:00", "14:00", "15:30", "17:00", "18:30"];

    horasDisponibles.forEach(horaStr => {
        const row = document.createElement('tr');
        const cellHora = document.createElement('td');
        cellHora.className = "p-2 border font-bold text-teal-800";
        cellHora.innerText = horaStr;
        row.appendChild(cellHora);

        dias.forEach(dia => {
            const td = document.createElement('td');
            td.className = "border p-1 text-[9px]";
            
            // Lógica de Validación (usamos hora y minutos para mayor precisión)
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

    
    // --- MONITOREO INTEGRADO (Modo Test) ---
setInterval(async () => {
    const id = localStorage.getItem('id_solicitud');
    if (!id) return;

    const { data } = await client.from('solicitudes')
        .select('fecha_solicitud, hora_solicitud, respuesta_solicitud')
        .eq('solicitud_id', parseInt(id)).maybeSingle();

    if (data?.respuesta_solicitud === 'iniciando') {
        const horaProgramada = new Date(`${data.fecha_solicitud}T${data.hora_solicitud}`);
        const ahoraMonitoreo = new Date();
        const faltanMinutos = (horaProgramada - ahoraMonitoreo) / (1000 * 60);

        // PRUEBA A: Cambiamos el límite de 30 a 2 minutos
        if (faltanMinutos > 0 && faltanMinutos <= 2) {
            if (Notification.permission !== "denied") {
                Notification.requestPermission();
                new Notification("PRUEBA DE SERVICIO", {
                    body: "Redirigiendo a espera...",
                    icon: "logo_1.jpeg"
                });
            }
            window.location.href = 'espera.html';
        }
    }
}, 5000); // PRUEBA A: Revisión cada 5 segundos en lugar de 1 minuto para respuesta inmediata; 
};
