const express = require("express");
const bodyParser = require("body-parser");
const webpush = require("web-push");
const sqlite3 = require("sqlite3").verbose();
const cron = require("node-cron");

const app = express();
const port = process.env.PORT || 3000;

app.use(bodyParser.json());

// VAPIDキー（Renderの.envから取得）
webpush.setVapidDetails(
  "mailto:your@email.com",
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

// DB初期化
const db = new sqlite3.Database(":memory:");
db.serialize(() => {
  db.run(\`
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message TEXT NOT NULL,
      time TEXT NOT NULL,
      subscription TEXT NOT NULL,
      sent INTEGER DEFAULT 0
    )
  \`);
});

// 通知予約API
app.post("/api/schedule", (req, res) => {
  const { message, time, subscription } = req.body;
  const stmt = db.prepare("INSERT INTO notifications (message, time, subscription) VALUES (?, ?, ?)");
  stmt.run(message, time, JSON.stringify(subscription));
  stmt.finalize();
  res.json({ status: "scheduled" });
});

// 毎分通知チェック
cron.schedule("* * * * *", () => {
  const now = new Date().toISOString();

  db.all("SELECT * FROM notifications WHERE time <= ? AND sent = 0", [now], (err, rows) => {
    if (err) return console.error(err);

    rows.forEach(row => {
      const subscription = JSON.parse(row.subscription);
      const payload = JSON.stringify({ message: row.message });

      webpush.sendNotification(subscription, payload)
        .then(() => {
          db.run("UPDATE notifications SET sent = 1 WHERE id = ?", [row.id]);
        })
        .catch(err => {
          console.error("Push送信失敗:", err);
        });
    });
  });
});

app.listen(port, () => {
  console.log(\`Server is running on port \${port}\`);
});