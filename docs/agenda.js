// agenda.js
export const inicializarAgenda = async (client, tableId, fechaInputId, horaHiddenId, btnSubmitId) => {
    const tableBody = document.getElementById('cuerpoAgenda');
    const fechaInput = document.getElementById(fechaInputId);
    const horaHidden = document.getElementById(horaHiddenId);
    const btnSubmit = document.getElementById(btnSubmitId);
    
    btnSubmit.disabled = true;

    // 1. Obtener próximos 7 días
    const dias = [];
    for (let i = 0; i < 7; i++) {
        const d = new Date();
        d.setDate(d.getDate() + i);
        dias.push(d.toISOString().split('T')[0]);
    }

    const horasDisponibles = ["08:00", "10:00", "14:00", "16:00", "18:00"];

    // 2. Cargar todas las solicitudes de la semana para pintar celdas ocupadas
    const { data: ocupados } = await client
        .from('solicitudes')
        .select('solicitud_id, fecha_solicitud, hora_solicitud')
        .in('fecha_solicitud', dias);

    // 3. Generar filas de la tabla
    tableBody.innerHTML = '';
    horasDisponibles.forEach(hora => {
        const row = document.createElement('tr');
        
        // Celda de Hora
        const cellHora = document.createElement('td');
        cellHora.className = "p-2 border font-bold text-teal-800";
        cellHora.innerText = hora;
        row.appendChild(cellHora);

        // Celdas de días
        dias.forEach(fecha => {
            const td = document.createElement('td');
            td.className = "border p-2 cursor-pointer text-[10px]";
            
            const ocupado = ocupados?.find(o => o.fecha_solicitud === fecha && o.hora_solicitud.substring(0, 5) === hora);

            if (ocupado) {
                td.classList.add('bg-green-500', 'text-white');
                td.innerText = `ID:${ocupado.solicitud_id}`;
            } else {
                td.classList.add('bg-white', 'hover:bg-gray-200');
                td.innerText = "Libre";
                
                td.onclick = () => {
                    // Limpiar selección previa
                    document.querySelectorAll('#cuerpoAgenda td').forEach(cell => {
                        if (!cell.classList.contains('bg-green-500')) {
                            cell.classList.remove('bg-yellow-400', 'font-bold');
                        }
                    });
                    
                    // Marcar nueva
                    td.classList.add('bg-yellow-400', 'font-bold');
                    fechaInput.value = fecha;
                    horaHidden.value = hora;
                    btnSubmit.disabled = false;
                };
            }
            row.appendChild(td);
        });
        tableBody.appendChild(row);
    });
};
