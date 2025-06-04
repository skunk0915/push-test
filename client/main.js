const publicVapidKey = "BI8nx4IDiOyGLe2wIR9NyU_N3zg_FB60DzB4jKNqQaTlcDwsrZtgymyBItYzC_aeIAB4ryifYGfdZif2YEWCARQ"; // 後でRenderから取得

async function registerServiceWorker() {
  try {
    // サービスワーカーの正しいパスを指定
    // さくらサーバー上での完全なパスを使用
    const swPath = window.location.hostname.includes('sakura.ne.jp') 
      ? '/push-test/client/sw.js'  // さくらサーバー用パス
      : 'sw.js';                   // ローカル開発環境用パス
    
    console.log('サービスワーカー登録開始:', swPath);
    const sw = await navigator.serviceWorker.register(swPath);
    console.log('サービスワーカー登録成功:', sw);
    return sw;
  } catch (error) {
    console.error('サービスワーカー登録エラー:', error);
    throw error;
  }
}

// プッシュ通知がサポートされているかチェックする関数
function isPushNotificationSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window;
}

// iOSデバイスかどうかチェックする関数
function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

async function subscribeUser(sw) {
  try {
    // プッシュ通知のサポート状況をチェック
    if (!isPushNotificationSupported()) {
      if (isIOS()) {
        throw new Error('iOSデバイスでは、ホーム画面に追加したPWAでのみプッシュ通知が使用できます。\n「共有」ボタンから「ホーム画面に追加」を選択してください。');
      } else {
        throw new Error('このブラウザはプッシュ通知をサポートしていません');
      }
    }
    
    // pushManagerが存在するか確認
    if (!sw.pushManager) {
      throw new Error('サービスワーカーのpushManagerが利用できません');
    }
    
    // 既存の購読情報があれば再利用
    let subscription = await sw.pushManager.getSubscription();
    
    if (subscription) {
      console.log('既存の購読情報を使用します');
      return subscription;
    }
    
    console.log('新規購読を開始します');
    
    // 通知権限の確認
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      throw new Error('通知権限が付与されていません');
    }
    
    // 新規購読を作成
    subscription = await sw.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicVapidKey)
    });
    
    console.log('購読成功:', subscription);
    return subscription;
  } catch (error) {
    console.error('プッシュ通知購読エラー:', error);
    throw new Error('プッシュ通知の購読に失敗しました: ' + error.message);
  }
}

// ページ読み込み時にPWAの状態をチェックする
document.addEventListener('DOMContentLoaded', () => {
  // iOSのPWA状態をチェック
  if (isIOS() && !isInStandaloneMode()) {
    const pwaPrompt = document.createElement('div');
    pwaPrompt.style.padding = '10px';
    pwaPrompt.style.backgroundColor = '#f8d7da';
    pwaPrompt.style.color = '#721c24';
    pwaPrompt.style.borderRadius = '5px';
    pwaPrompt.style.margin = '10px 0';
    pwaPrompt.style.textAlign = 'center';
    pwaPrompt.innerHTML = '<strong>iOSデバイスをご利用の方へ</strong><br>プッシュ通知を使用するには、「共有」ボタンから「ホーム画面に追加」を選択してください。';
    document.body.insertBefore(pwaPrompt, document.body.firstChild);
  }
});

// iOSのスタンドアロンモード（PWA）かチェック
function isInStandaloneMode() {
  return (window.navigator.standalone === true) || (window.matchMedia('(display-mode: standalone)').matches);
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

    // iOSの場合は特別な処理
    if (isIOS() && !isInStandaloneMode()) {
      alert('iOSではホーム画面に追加したPWAでのみプッシュ通知が使用できます。\n「共有」ボタンから「ホーム画面に追加」を選択してください。');
      return;
    }

    const sw = await registerServiceWorker();
    const subscription = await subscribeUser(sw);
    
    console.log('サブスクリプション取得成功:', subscription);

    console.log('サーバーにリクエスト送信開始...');
    
    // リクエストデータのログ出力
    const requestData = { subscription, message, time };
    console.log('リクエストデータ:', JSON.stringify(requestData));
    
    // リクエストのタイムアウトを設定
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10秒タイムアウト
    
    let response;
    let responseData;
    
    try {
      response = await fetch('https://push-test-iujx.onrender.com/api/schedule', {
        method: 'POST',
        body: JSON.stringify(requestData),
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        mode: 'cors',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      console.log('サーバーからのレスポンス受信:', response.status, response.statusText);
      
      try {
        responseData = await response.json();
        console.log('サーバーレスポンス:', responseData);
      } catch (jsonError) {
        console.error('JSON解析エラー:', jsonError);
        throw new Error('サーバーからのレスポンスを解析できませんでした');
      }
      
      if (!response.ok) {
        throw new Error('サーバーからエラーレスポンス: ' + (responseData.error || response.statusText));
      }
    } catch (fetchError) {
      clearTimeout(timeoutId);
      console.error('フェッチエラー:', fetchError);
      throw new Error('サーバーへの接続に失敗しました: ' + fetchError.message);
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