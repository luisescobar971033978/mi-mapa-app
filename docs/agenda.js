// agenda.js
export const inicializarAgenda = (client, containerId, fechaInputId, horaHiddenId, btnSubmitId) => {
    const grid = document.getElementById(containerId);
    const fechaInput = document.getElementById(fechaInputId);
    const horaHidden = document.getElementById(horaHiddenId);
    const btnSubmit = document.getElementById(btnSubmitId);
    
    // Inicialmente bloqueamos el botón hasta que seleccionen hora
    btnSubmit.disabled = true;

    fechaInput.addEventListener('change', async (e) => {
        const fecha = e.target.value;
        grid.innerHTML = '<p class="text-xs p-2 text-gray-500">Cargando...</p>';
        
        const { data: ocupados } = await client
            .from('solicitudes')
            .select('solicitud_id, hora_solicitud')
            .eq('fecha_solicitud', fecha);

        grid.innerHTML = '';
        const horasDisponibles = ["08:00", "10:00", "14:00", "16:00", "18:00"];

        horasDisponibles.forEach(hora => {
            const ocupado = ocupados?.find(o => o.hora_solicitud.substring(0, 5) === hora);
            const btn = document.createElement('button');
            btn.type = 'button';
            
            if (ocupado) {
                // VERDE: Programado
                btn.innerText = `ID: ${ocupado.solicitud_id} Programada`;
                btn.className = "p-2 rounded-lg border text-[10px] font-bold bg-green-500 text-white cursor-not-allowed";
                btn.disabled = true;
            } else {
                // BLANCO: Disponible
                btn.innerText = hora;
                btn.className = "p-3 rounded-lg border font-bold bg-white text-teal-900 border-teal-800 hover:bg-gray-100";
                btn.onclick = () => {
                    // AMARILLO: Preseleccionado
                    document.querySelectorAll('#gridHorarios button').forEach(b => {
                        if(!b.disabled) b.className = "p-3 rounded-lg border font-bold bg-white text-teal-900 border-teal-800";
                    });
                    btn.className = "p-3 rounded-lg border font-bold bg-yellow-400 text-teal-900 shadow-xl scale-105";
                    horaHidden.value = hora;
                    btnSubmit.disabled = false;
                };
            }
            grid.appendChild(btn);
        });
    });
};
