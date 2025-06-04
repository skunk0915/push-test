const publicVapidKey = "あなたの公開VAPIDキーをここに"; // 後でRenderから取得

async function registerServiceWorker() {
  const sw = await navigator.serviceWorker.register('/sw.js');
  return sw;
}

async function subscribeUser(sw) {
  const subscription = await sw.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicVapidKey)
  });
  return subscription;
}

document.getElementById('notify-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const message = document.getElementById('message').value;
  const time = document.getElementById('time').value;

  const sw = await registerServiceWorker();
  const subscription = await subscribeUser(sw);

  await fetch('https://your-render-server.onrender.com/api/schedule', {
    method: 'POST',
    body: JSON.stringify({ subscription, message, time }),
    headers: {
      'Content-Type': 'application/json'
    }
  });

  alert('通知を予約しました！');
});

// VAPIDキー変換関数
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}