self.addEventListener('push', function(event) {
  try {
    const data = event.data.json();
    
    // サーバーから送信されたデータを使用
    self.registration.showNotification(data.title || "予約通知", {
      body: data.message,
      icon: data.icon || "icon-192.png",
      vibrate: [100, 50, 100],
      data: {
        timestamp: new Date().getTime()
      }
    });
    
    console.log('通知を表示しました:', data);
  } catch (error) {
    console.error('通知処理中にエラーが発生しました:', error);
  }
});