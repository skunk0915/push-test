# PWA通知システム 設計概要

## 📦 プロジェクト構成

```
push-test/
├── client/   # さくらサーバーでホストされるPWA
│   ├── index.html
│   ├── main.js
│   ├── sw.js
│   ├── manifest.json
│   └── icon-192.png
├── server/   # Renderで動作するNode.jsサーバー
│   ├── index.js
│   ├── package.json
│   └── .env（Render側で管理）
```

---

## 🧠 機能概要

### PWA（client側）

- 通知内容と時刻をフォームで入力
- Service Worker 登録と Push 通知許可
- Push Subscription 情報をサーバーへPOST

### Node.jsサーバー（server側）

- Push Subscription + メッセージ + 時刻をDBに保存
- `node-cron` で毎分チェックし、指定時刻に通知送信
- 通知は `web-push` ライブラリを使って送信

---

## 🔐 VAPIDキー（Push認証用）

- 生成方法：
  ```js
  const webpush = require('web-push');
  const vapidKeys = webpush.generateVAPIDKeys();
  ```
- 使い方：
  - `VAPID_PUBLIC_KEY` → PWAの `main.js` に埋め込む
  - `VAPID_PRIVATE_KEY` → Renderの環境変数に登録

---

## 🌐 Render設定

- インスタンスタイプ：Free（512MB RAM, 自動スリープあり）
- Build command: `npm install`
- Start command: `node index.js`
- Root directory: `server/`
- Environment variables:
  - `VAPID_PUBLIC_KEY=...`
  - `VAPID_PRIVATE_KEY=...`

---

## ☁ さくら設定

- `client/` フォルダをFTPでアップロード
- HTTPSを有効化（Let's Encrypt）
- Service Worker登録時にHTTPSでないと動作しないので注意

---

## 🚀 補足

- 無料Renderインスタンスは15分間アクセスがないとスリープ
- 通知が遅れることがあるため、必要ならping等で防止可能
- SQLiteはメモリDB：本番運用時はPostgreSQLなど推奨

---

## ✅ 今後の拡張候補

- 通知の繰り返し設定（毎日/毎週など）
- ユーザー認証の導入
- ローカル通知（オフライン時用）との併用
- GitHub Actionsによる自動デプロイ