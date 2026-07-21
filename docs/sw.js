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

// Función para disparar la notificación de forma segura
const ejecutarNotificacion = async (title, body) => {
    const options = {
        body: body,
        icon: 'logo_1.jpeg',
        badge: 'logo_1.jpeg',
        vibrate: [200, 100, 200],
        tag: 'alerta-servicio-autonomo',
        renotify: true
    };

    try {
        await self.registration.showNotification(title, options);
        console.log("Notificación disparada con éxito por el Service Worker.");
    } catch (err) {
        console.error("Error al mostrar la notificación desde el Service Worker:", err);
    }
};

// Escuchar mensajes enviados desde agenda.js
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'PROGRAMAR_ALARMA') {
        const { targetTime, title, body } = event.data;
        
        if (temporizadorAlarma) {
            clearTimeout(temporizadorAlarma);
        }

        const ahora = Date.now();
        const delay = targetTime - ahora;

        console.log(`Service Worker: Alarma recibida. Tiempo faltante calculado: ${delay} ms.`);

        if (delay <= 0) {
            // Si el tiempo ya pasó, disparar de inmediato
            ejecutarNotificacion(title, body);
        } else {
            // Programar el temporizador con el retraso exacto
            temporizadorAlarma = setTimeout(() => {
                ejecutarNotificacion(title, body);
            }, delay);
        }
    }
});

// Escuchar eventos de notificación Push tradicionales por red
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

// Manejar el clic sobre la notificación para abrir la app
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        clients.openWindow('espera.html')
    );
});
