//channels.js
/*********************************
 * Dependencies
 *********************************/
const express = require("express");
const db = require("../db");
const auth = require("../middleware/auth");

const router = express.Router();

/*********************************
 * Helpers
 *********************************/
function normalizeChannelName(name) {
  return name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-_]/g, "");
}

function parseChannelType(type) {
  return String(type || "TEXT").toUpperCase() === "VOICE"
    ? "VOICE"
    : "TEXT";
}

/*********************************
 * Routes
 *********************************/

/**
 * GET /
 * Sidebar channel list
 */
router.get("/", auth, async (req, res) => {
  const serverId = Number(req.query.serverId);

  if (!Number.isFinite(serverId)) {
    return res.status(400).json({ error: "Invalid server id" });
  }

  // Verify user belongs to server
  const [member] = await db.execute(
    "SELECT 1 FROM server_members WHERE server_id = ? AND user_id = ?",
    [serverId, req.user.id]
  );

  if (!member.length) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const [rows] = await db.execute(
    "SELECT id, name, type FROM channels WHERE server_id = ? ORDER BY id ASC",
    [serverId]
  );

  res.json({ channels: rows });
});


/**
 * POST /
 * Create a new channel
 */
router.post("/", auth, async (req, res) => {
  const rawName = String(req.body?.name ?? "").trim();
  const serverId = Number(req.body?.serverId);

  if (!Number.isFinite(serverId)) {
    return res.status(400).json({ error: "Invalid server id" });
  }

  if (!rawName) {
    return res.status(400).json({ error: "Channel name required" });
  }

  const name = normalizeChannelName(rawName);
  if (!name) {
    return res.status(400).json({ error: "Invalid channel name" });
  }

  const type = parseChannelType(req.body?.type);

  // Verify membership
const [rows] = await db.execute(
  "SELECT role FROM server_members WHERE server_id = ? AND user_id = ?",
  [serverId, req.user.id]
);

if (!rows.length) {
  return res.status(403).json({ error: "Not a member" });
}

const role = rows[0].role;

if (role !== "owner" && role !== "admin") {
  return res.status(403).json({ error: "Only owners or admins can create channels" });
}

  try {
    const [result] = await db.execute(
      "INSERT INTO channels (name, type, server_id) VALUES (?, ?, ?)",
      [name, type, serverId]
    );

    res.json({
      channel: {
        id: result.insertId,
        name,
        type,
      },
    });
  } catch {
    res.status(400).json({
      error: "Channel name already exists (or DB error)",
    });
  }
});


/**
 * DELETE /:id
 * Delete a channel and its messages
 */
router.delete("/:id", auth, async (req, res) => {
  const channelId = Number(req.params.id);

  const [channel] = await conn.execute(
    "SELECT server_id FROM channels WHERE id = ?",
    [channelId]
  );

  if (!channel.length) {
    return res.status(404).json({ error: "Channel not found" });
  }

  const serverId = channel[0].server_id;

  const [member] = await conn.execute(
    "SELECT 1 FROM server_members WHERE server_id = ? AND user_id = ?",
    [serverId, req.user.id]
  );

  if (!member.length) {
    return res.status(403).json({ error: "Forbidden" });
  }


  if (!Number.isFinite(channelId)) {
    return res.status(400).json({ error: "Invalid channel id" });
  }

  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    await conn.execute(
      "DELETE FROM messages WHERE channel_id = ?",
      [channelId]
    );

    const [result] = await conn.execute(
      "DELETE FROM channels WHERE id = ?",
      [channelId]
    );

    await conn.commit();

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Channel not found" });
    }

    res.json({ ok: true });
  } catch {
    await conn.rollback();
    res.status(500).json({ error: "Failed to delete channel" });
  } finally {
    conn.release();
  }
});

/**
 * GET /:id/messages
 * Chat history for a channel
 */
router.get("/:id/messages", auth, async (req, res) => {
  const channelId = Number(req.params.id);
  if (!Number.isFinite(channelId)) {
    return res.status(400).json({ error: "Invalid channel id" });
  }

  const limit = Math.min(Number(req.query.limit ?? 50), 100);

  const [rows] = await db.execute(
    `
    SELECT
      m.id,
      m.content,
      m.created_at,
      u.username
    FROM messages m
    JOIN users u ON u.id = m.user_id
    WHERE m.channel_id = ?
    ORDER BY m.created_at DESC
    LIMIT ?
    `,
    [channelId, limit]
  );

  res.json({ messages: rows.reverse() });
});

module.exports = router;
