// --- 3. GESTIÓN DE MODAL PERSONALIZADO Y SUSCRIPCIÓN PUSH ---
    if (btnSubmit) {
        btnSubmit.addEventListener('click', async (e) => {
            e.preventDefault(); // Evitamos recargas por defecto para controlarlo por código

            const idSolicitud = localStorage.getItem('id_solicitud');
            const fechaSel = fechaInput.value;
            const horaSel = horaHidden.value;

            if (!idSolicitud || !fechaSel || !horaSel) {
                console.warn("Faltan datos de la solicitud, fecha u hora para continuar.");
                return;
            }

            // Función interna para ejecutar la suscripción y actualizar Supabase
            const ejecutarSuscripcionYGuardar = async () => {
                try {
                    if ("Notification" in window && Notification.permission !== "granted") {
                        const permissionResult = await Notification.requestPermission();
                        if (permissionResult !== "granted") {
                            console.log("El usuario denegó las notificaciones.");
                            return;
                        }
                    }

                    const registration = await navigator.serviceWorker.ready;
                    const publicVapidKey = "BB39ZxbYgFwqQtc4sJonYgzl-SS5n-fnJ6xBf5AFI9_xrmhs00qImHbVjeGYEQKMcaHIZfsH-fXs2LK1bVpMuwI"; 

                    let pushSubscription = null;
                    if (publicVapidKey) {
                        pushSubscription = await registration.pushManager.subscribe({
                            userVisibleOnly: true,
                            applicationServerKey: urlBase64ToUint8Array(publicVapidKey)
                        });
                    }

                    // Actualizamos el registro en Supabase incluyendo la suscripción push
                    const { error: updateError } = await client
                        .from('solicitudes')
                        .update({ 
                            push_subscription: pushSubscription,
                            fecha_solicitud: fechaSel,
                            hora_solicitud: horaSel,
                            respuesta_solicitud: 'pendiente' // O el estado que corresponda en tu flujo
                        })
                        .eq('solicitud_id', idSolicitud);

                    if (updateError) {
                        console.error("Error al guardar la suscripción push en Supabase:", updateError);
                    } else {
                        console.log("¡Cita agendada y suscripción push guardada con éxito!");
                        // Aquí puedes redirigir o actualizar la vista si lo requieres, ej:
                        // window.location.href = 'espera.html';
                    }

                } catch (err) {
                    console.error("Error al procesar la suscripción push o actualizar Supabase:", err);
                }
            };

            // Verificamos en localStorage si ya se mostró/aceptó el modal previamente
            const notifAceptada = localStorage.getItem('notificacion_aceptada');

            if (!notifAceptada && "Notification" in window && Notification.permission !== "granted") {
                // Creamos el modal flotante con Tailwind CSS
                const modalDiv = document.createElement('div');
                modalDiv.id = 'modalNotifPush';
                modalDiv.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4';
                modalDiv.innerHTML = `
                    <div class="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 text-center transform transition-all animate-fade-in">
                        <div class="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-teal-100 text-teal-600 mb-4">
                            <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path>
                            </svg>
                        </div>
                        <h3 class="text-lg font-bold text-gray-800 mb-2">Activación de Alertas</h3>
                        <p class="text-sm text-gray-600 mb-6 leading-relaxed">
                            Te recordaremos 30 minutos antes de tu cita programada, mediante un mensaje. Por favor no cierre esta ventana y mantenga en segundo plano esta app.
                        </p>
                        <button id="btnAceptarModal" class="w-full bg-teal-600 hover:bg-teal-700 text-white font-semibold py-2.5 px-4 rounded-lg transition duration-200 shadow-md">
                            Aceptar
                        </button>
                    </div>
                `;
                document.body.appendChild(modalDiv);

                // Al hacer clic en aceptar, guardamos la preferencia, removemos el modal y ejecutamos el guardado
                document.getElementById('btnAceptarModal').onclick = async () => {
                    localStorage.setItem('notificacion_aceptada', 'true');
                    modalDiv.remove();
                    await ejecutarSuscripcionYGuardar();
                };
            } else {
                // Si ya aceptó antes, ejecutamos directo
                await ejecutarSuscripcionYGuardar();
            }
        });
    }
