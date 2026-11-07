self.addEventListener("push", (event) => {
  let payload = {};

  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {
      body: event.data ? event.data.text() : "Você tem um novo lembrete."
    };
  }

  const title = payload.title || "Logísticas Bill";

  const options = {
    body: payload.body || payload.descricao || "Você tem um novo lembrete.",
    icon: payload.icon || "/icon-192.png",
    badge: payload.badge || "/icon-192.png",
    tag: payload.tag || `logisticas-bill-${payload.id || "lembrete"}`,
    renotify: false,
    data: {
      url: payload.url || "/programacoes",
      id: payload.id || null
    }
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = new URL(
    event.notification.data?.url || "/programacoes",
    self.location.origin
  ).href;

  event.waitUntil(
    clients.matchAll({
      type: "window",
      includeUncontrolled: true
    }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.startsWith(self.location.origin)) {
          if ("navigate" in client) {
            client.navigate(targetUrl);
          }

          return client.focus();
        }
      }

      return clients.openWindow(targetUrl);
    })
  );
});