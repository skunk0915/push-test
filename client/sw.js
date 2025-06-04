self.addEventListener('push', function(event) {
  const data = event.data.json();
  self.registration.showNotification("通知", {
    body: data.message,
    icon: "icon-192.png"
  });
});