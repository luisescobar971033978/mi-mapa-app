// Service Worker para Notificaciones Push Nativas
self.addEventListener('install', (event) => {
    console.log('Service Worker instalado correctamente.');
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    console.log('Service Worker activado.');
});

// Escuchar eventos de notificación
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
