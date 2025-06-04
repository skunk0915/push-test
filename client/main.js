const publicVapidKey = "BI8nx4IDiOyGLe2wIR9NyU_N3zg_FB60DzB4jKNqQaTlcDwsrZtgymyBItYzC_aeIAB4ryifYGfdZif2YEWCARQ"; // 後でRenderから取得

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
  const timeInput = document.getElementById('time').value;
  
  // 日時文字列をDate型に変換し、ISOString形式に変換
  // HTML datetime-localは「YYYY-MM-DDThh:mm」形式なので秒を追加
  const localTime = new Date(timeInput + ':00');
  
  // ローカル時間をUTCに変換（サーバー側のnew Date().toISOString()と一致させる）
  const time = localTime.toISOString();

  const sw = await registerServiceWorker();
  const subscription = await subscribeUser(sw);

  await fetch('https://push-test-iujx.onrender.com/api/schedule', {
    method: 'POST',
    body: JSON.stringify({ subscription, message, time }),
    headers: {
      'Content-Type': 'application/json'
    }
  });

  alert(`通知を予約しました！\n予約時間: ${localTime.toLocaleString()}`);
});

// VAPIDキー変換関数
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}