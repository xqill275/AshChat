const express = require("express");
const db = require("../db");
const auth = require("../middleware/auth");

const router = express.Router();

// Sidebar channel list
router.get("/", auth, async (req, res) => {
const [rows] = await db.execute(
  "SELECT id, name, type FROM channels ORDER BY id ASC"
);
res.json({ channels: rows });
});

// Create a new channel
router.post("/", auth, async (req, res) => {
  const name = String(req.body?.name || "").trim();

  if (!name) return res.status(400).json({ error: "Channel name required" });
  if (name.length > 64) return res.status(400).json({ error: "Channel name too long" });

  // basic "discord-like" formatting: lowercase + replace spaces with dashes
  const cleanName = name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-_]/g, "");

  if (!cleanName) return res.status(400).json({ error: "Invalid channel name" });

  try {
    const [result] = await db.execute(
      "INSERT INTO channels (name) VALUES (?)",
      [cleanName]
    );

    res.json({ channel: { id: result.insertId, name: cleanName } });
  } catch (e) {
    // if you have UNIQUE(name) this will catch duplicates
    res.status(400).json({ error: "Channel name already exists (or DB error)" });
  }
});

router.delete("/:id", auth, async (req, res) => {
  const channelId = Number(req.params.id);
  if (!Number.isFinite(channelId)) return res.status(400).json({ error: "Invalid channel id" });

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute("DELETE FROM messages WHERE channel_id = ?", [channelId]);
    const [result] = await conn.execute("DELETE FROM channels WHERE id = ?", [channelId]);
    await conn.commit();

    if (result.affectedRows === 0) return res.status(404).json({ error: "Channel not found" });
    res.json({ ok: true });
  } catch (e) {
    await conn.rollback();
    res.status(500).json({ error: "Failed to delete channel" });
  } finally {
    conn.release();
  }
});

// Chat history for a channel
router.get("/:id/messages", auth, async (req, res) => {
  const channelId = Number(req.params.id);
  const limit = Math.min(Number(req.query.limit || 50), 100);

  const [rows] = await db.execute(
    `SELECT m.id, m.content, m.created_at, u.username
     FROM messages m
     JOIN users u ON u.id = m.user_id
     WHERE m.channel_id = ?
     ORDER BY m.created_at DESC
     LIMIT ?`,
    [channelId, limit]
  );

  res.json({ messages: rows.reverse() });
});

module.exports = router;
