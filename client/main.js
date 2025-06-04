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

  try {
    const message = document.getElementById('message').value;
    const timeInput = document.getElementById('time').value;
    
    if (!message || !timeInput) {
      alert('メッセージと時間を入力してください');
      return;
    }
    
    // 日時文字列をDate型に変換し、ISOString形式に変換
    // HTML datetime-localは「YYYY-MM-DDThh:mm」形式なので秒を追加
    const localTime = new Date(timeInput + ':00');
    
    if (isNaN(localTime.getTime())) {
      alert('有効な日時を入力してください');
      return;
    }
    
    // ローカル時間をUTCに変換（サーバー側のnew Date().toISOString()と一致させる）
    const time = localTime.toISOString();
    
    console.log('通知予約情報:', { message, localTime: localTime.toString(), time });

    const sw = await registerServiceWorker();
    const subscription = await subscribeUser(sw);
    
    console.log('サブスクリプション取得成功:', subscription);

    const response = await fetch('https://push-test-iujx.onrender.com/api/schedule', {
      method: 'POST',
      body: JSON.stringify({ subscription, message, time }),
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const responseData = await response.json();
    console.log('サーバーレスポンス:', responseData);
    
    if (!response.ok) {
      throw new Error('サーバーからエラーレスポンス: ' + (responseData.error || response.statusText));
    }

    alert(`通知を予約しました！\n予約時間: ${localTime.toLocaleString()}\nサーバー時間: ${time}`);
  } catch (error) {
    console.error('通知予約エラー:', error);
    alert('通知の予約中にエラーが発生しました: ' + error.message);
  }
});

// VAPIDキー変換関数
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}