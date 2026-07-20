// agenda.js
export const inicializarAgenda = (client, containerId, fechaInputId, horaHiddenId) => {
    const grid = document.getElementById(containerId);
    const fechaInput = document.getElementById(fechaInputId);
    const horaHidden = document.getElementById(horaHiddenId);
    const horasDisponibles = ["08:00", "10:00", "14:00", "16:00", "18:00"];

    fechaInput.addEventListener('change', async (e) => {
        const fecha = e.target.value;
        grid.innerHTML = '<p class="text-sm">Cargando disponibilidad...</p>';
        
        const { data: ocupados } = await client
            .from('solicitudes')
            .select('hora_solicitud')
            .eq('fecha_solicitud', fecha);

        grid.innerHTML = ''; 
        horasDisponibles.forEach(hora => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.innerText = hora;
            btn.className = "p-3 rounded-lg border font-bold transition-all";
            
            // Lógica de ocupado
            if (ocupados?.some(o => o.hora_solicitud.substring(0, 5) === hora)) {
                btn.className += " bg-gray-300 text-gray-500 cursor-not-allowed";
                btn.disabled = true;
            } else {
                btn.className += " bg-teal-100 hover:bg-teal-200";
                btn.onclick = () => {
                    horaHidden.value = hora;
                    document.querySelectorAll('#gridHorarios button').forEach(b => 
                        b.classList.remove('bg-teal-800', 'text-white'));
                    btn.classList.add('bg-teal-800', 'text-white');
                };
            }
            grid.appendChild(btn);
        });
    });
};
