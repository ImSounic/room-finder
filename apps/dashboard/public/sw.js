self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(data.title || "Room Finder", {
      body: data.body || "",
      data: { url: data.url || "/" },
      icon: "/icon.png",
      tag: data.url || "room-finder",
    }),
  );
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data.url));
});
