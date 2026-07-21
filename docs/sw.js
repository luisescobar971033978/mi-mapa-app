// Service Worker para Notificaciones Push Nativas y Temporizador Autónomo

let temporizadorAlarma = null;

self.addEventListener('install', (event) => {
    console.log('Service Worker instalado correctamente.');
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    console.log('Service Worker activado y listo.');
    event.waitUntil(self.clients.claim());
});

// Escuchar mensajes enviados desde agenda.js para programar la alarma localmente
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'PROGRAMAR_ALARMA') {
        const { delay, title, body } = event.data;
        
        console.log(`Service Worker: Alarma programada de forma independiente para dispararse en ${delay} ms.`);

        if (temporizadorAlarma) {
            clearTimeout(temporizadorAlarma);
        }

        // Programar el aviso autónomo dentro del ciclo de vida del Service Worker
        temporizadorAlarma = setTimeout(() => {
            const options = {
                body: body,
                icon: 'logo_1.jpeg',
                badge: 'logo_1.jpeg',
                vibrate: [200, 100, 200],
                tag: 'alerta-servicio-autonomo',
                renotify: true
            };

            self.registration.showNotification(title, options)
                .then(() => {
                    console.log("Notificación disparada con éxito por el Service Worker en segundo plano.");
                })
                .catch((err) => {
                    console.error("Error al mostrar la notificación desde el Service Worker:", err);
                });
        }, delay);
    }
});

// Escuchar eventos de notificación Push tradicionales por red (por si se usa en el futuro)
self.addEventListener('push', (event) => {
    let data = { title: "Aviso de Servicio", body: "Tienes una actualización en tu solicitud de mantenimiento.", icon: "logo_1.jpeg" };
    
    if (event.data) {
        try {
            data = event.data.json();
        } catch (e) {
            data.body = event.data.text();
        }
    }

    const options = {
        body: data.body,
        icon: data.icon || 'logo_1.jpeg',
        badge: 'logo_1.jpeg',
        vibrate: [200, 100, 200],
        tag: 'servicio-notificacion',
        renotify: true
    };

    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

// Manejar el clic sobre la notificación para abrir la app o ir al mapa/espera
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        clients.openWindow('espera.html') // Redirige a la pantalla de espera al hacer clic
    );
});
