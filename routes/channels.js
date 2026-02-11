const express = require("express");
const db = require("../db");
const auth = require("../middleware/auth");

const router = express.Router();

// Sidebar channel list
router.get("/", auth, async (req, res) => {
  const [rows] = await db.execute(
    "SELECT id, name FROM channels ORDER BY id ASC"
  );
  res.json({ channels: rows });
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
