const express = require("express");
const bodyParser = require("body-parser");
const webpush = require("web-push");
const sqlite3 = require("sqlite3").verbose();
const cron = require("node-cron");

const app = express();
const port = process.env.PORT || 3000;

// CORS設定を追加
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

app.use(bodyParser.json());

// VAPIDキー（Renderの.envから取得）
webpush.setVapidDetails(
  "mailto:your@email.com",
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

// DB初期化
// 注意: メモリデータベースはサーバー再起動時にデータが消失します
// 本番環境ではファイルベースのDBやPostgreSQLなどの持続的なストレージを使用することを推奨します
const db = new sqlite3.Database(":memory:");
db.serialize(() => {
  db.run(
    "CREATE TABLE IF NOT EXISTS notifications (" +
    "id INTEGER PRIMARY KEY AUTOINCREMENT," +
    "message TEXT NOT NULL," +
    "time TEXT NOT NULL," +
    "subscription TEXT NOT NULL," +
    "sent INTEGER DEFAULT 0" +
    ")"
  );
  console.log("データベース初期化完了");
});

// 通知予約API
app.post("/api/schedule", (req, res) => {
  try {
    console.log("通知予約リクエスト受信:", req.body);
    
    const { message, time, subscription } = req.body;
    
    if (!message || !time || !subscription) {
      console.error("必須パラメータが不足しています:", { message, time, subscription: !!subscription });
      return res.status(400).json({ error: "必須パラメータが不足しています" });
    }
    
    console.log("予約時間:", time);
    
    const stmt = db.prepare("INSERT INTO notifications (message, time, subscription) VALUES (?, ?, ?)");
    stmt.run(message, time, JSON.stringify(subscription));
    stmt.finalize();
    
    // 保存後にデータを確認
    db.all("SELECT * FROM notifications", [], (err, rows) => {
      if (err) {
        console.error("DB確認エラー:", err);
      } else {
        console.log("現在のDB内容:", rows.map(r => ({ id: r.id, message: r.message, time: r.time, sent: r.sent })));
      }
    });
    
    res.json({ status: "scheduled", time: time });
  } catch (error) {
    console.error("通知予約処理エラー:", error);
    res.status(500).json({ error: "サーバーエラーが発生しました" });
  }
});

// 毎分通知チェック
cron.schedule("* * * * *", () => {
  try {
    const now = new Date().toISOString();
    console.log("通知チェック実行: " + now);
    
    // まず全ての通知を確認
    db.all("SELECT * FROM notifications", [], (err, allRows) => {
      if (err) {
        console.error("全通知確認エラー:", err);
      } else {
        console.log("データベース内の全通知数: " + allRows.length + "件");
        if (allRows.length > 0) {
          console.log("全通知データ:", allRows.map(r => ({ id: r.id, message: r.message, time: r.time, sent: r.sent })));
        }
      }
      
      // 次に送信対象の通知を確認
      db.all("SELECT * FROM notifications WHERE time <= ? AND sent = 0", [now], (err, rows) => {
        if (err) {
          console.error("送信対象通知確認エラー:", err);
          return;
        }
        
        console.log("送信対象の通知: " + rows.length + "件");
        if (rows.length > 0) {
          console.log("送信対象:", rows.map(r => ({ id: r.id, message: r.message, time: r.time })));
        } else {
          // 送信対象がない場合の詳細情報
          console.log("送信対象の通知がありません。以下の原因が考えられます:");
          console.log("1. データベースに通知が保存されていない");
          console.log("2. 指定された時間が現在時刻より後の時間である");
          console.log("3. すでに送信済みの通知であるため、sent=1になっている");
          console.log("現在時刻: " + now);
        }

        rows.forEach(row => {
          try {
            const subscription = JSON.parse(row.subscription);
            const payload = JSON.stringify({ 
              message: row.message,
              title: "予約通知",
              icon: "/icon-192.png"
            });

            console.log("通知送信開始 ID:" + row.id + ", メッセージ:" + row.message);
            
            webpush.sendNotification(subscription, payload)
              .then(() => {
                console.log("通知送信成功 ID:" + row.id);
                db.run("UPDATE notifications SET sent = 1 WHERE id = ?", [row.id]);
              })
              .catch(err => {
                console.error("Push送信失敗 ID:" + row.id + ":", err);
              });
          } catch (error) {
            console.error("通知処理エラー ID:" + row.id + ":", error);
          }
        });
      });
    });
  } catch (error) {
    console.error("通知チェック全体エラー:", error);
  }
});

app.listen(port, () => {
  console.log("Server is running on port " + port);
});