// routes/servers.js
const express = require("express");
const db = require("../db");
const auth = require("../middleware/auth");

const router = express.Router();

// Get servers user belongs to
router.get("/", auth, async (req, res) => {
  const [rows] = await db.execute(`
    SELECT s.id, s.name
    FROM servers s
    JOIN server_members sm ON sm.server_id = s.id
    WHERE sm.user_id = ?
  `, [req.user.id]);

  res.json({ servers: rows });
});

// Create server
// requires 
router.post("/", auth, async (req, res) => {
  const name = String(req.body?.name ?? "").trim();
  if (!name) return res.status(400).json({ error: "Name required" });

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [serverResult] = await conn.execute(
      "INSERT INTO servers (name, owner_id) VALUES (?, ?)",
      [name, req.user.id]
    );

    const serverId = serverResult.insertId;

    await conn.execute(
      "INSERT INTO server_members (server_id, user_id, role) VALUES (?, ?, 'owner')",
      [serverId, req.user.id]
    );

    await conn.execute(
      "INSERT INTO channels (name, type, server_id) VALUES ('general', 'TEXT', ?)",
      [serverId]
    );

    await conn.commit();
    res.json({ id: serverId, name });

  } catch {
  console.error("SERVER CREATE ERROR:", err);
  await conn.rollback();
  res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

module.exports = router;
