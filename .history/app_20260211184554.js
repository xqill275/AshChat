const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const mysql = require("mysql2/promise");
const { z } = require("zod");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: true, credentials: true },
});

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

const JWT_SECRET = process.env.JWT_SECRET || "change_me_dev_secret";

const db = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASS || "",
  database: process.env.DB_NAME || "discord_clone",
  connectionLimit: 10,
});

function signToken(user) {
  return jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: "7d" });
}

function authMiddleware(req, res, next) {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ error: "Not logged in" });

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

/* --------------------
   AUTH REST ENDPOINTS
-------------------- */

app.post("/auth/register", async (req, res) => {
  const schema = z.object({
    username: z.string().min(3).max(32),
    email: z.string().email(),
    password: z.string().min(6).max(200),
  });

  const body = schema.safeParse(req.body);
  if (!body.success) return res.status(400).json(body.error);

  const { username, email, password } = body.data;
  const password_hash = await bcrypt.hash(password, 10);

  try {
    const [result] = await db.query(
      "INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)",
      [username, email, password_hash]
    );

    const user = { id: result.insertId, username };
    const token = signToken(user);

    res.cookie("token", token, { httpOnly: true, sameSite: "lax" });
    res.json({ user });
  } catch (e) {
    res.status(400).json({ error: "Username/email already used?" });
  }
});

app.post("/auth/login", async (req, res) => {
  const schema = z.object({
    email: z.string().email(),
    password: z.string(),
  });

  const body = schema.safeParse(req.body);
  if (!body.success) return res.status(400).json(body.error);

  const { email, password } = body.data;

  const [rows] = await db.query("SELECT * FROM users WHERE email = ?", [email]);
  const user = rows[0];
  if (!user) return res.status(401).json({ error: "Invalid credentials" });

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: "Invalid credentials" });

  const token = signToken({ id: user.id, username: user.username });
  res.cookie("token", token, { httpOnly: true, sameSite: "lax" });
  res.json({ user: { id: user.id, username: user.username } });
});

app.post("/auth/logout", (req, res) => {
  res.clearCookie("token");
  res.json({ ok: true });
});

app.get("/me", authMiddleware, (req, res) => {
  res.json({ user: req.user });
});

/* --------------------
   DATA ENDPOINTS
-------------------- */

// list channels
app.get("/channels", authMiddleware, async (req, res) => {
  const [rows] = await db.query("SELECT id, name FROM channels ORDER BY id ASC");
  res.json({ channels: rows });
});

// message history
app.get("/channels/:id/messages", authMiddleware, async (req, res) => {
  const channelId = Number(req.params.id);
  const limit = Math.min(Number(req.query.limit || 50), 100);

  const [rows] = await db.query(
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

/* --------------------
   SOCKET.IO (REALTIME)
-------------------- */

io.use((socket, next) => {
  // cookie parsing from handshake headers
  const cookieHeader = socket.handshake.headers.cookie || "";
  const tokenMatch = cookieHeader.split(";").map(s => s.trim()).find(s => s.startsWith("token="));
  if (!tokenMatch) return next(new Error("unauthorized"));
  const token = decodeURIComponent(tokenMatch.split("=")[1]);

  try {
    socket.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    next(new Error("unauthorized"));
  }
});

io.on("connection", (socket) => {
  const user = socket.user; // {id, username}

  socket.on("channel:join", ({ channelId }) => {
    socket.join(`channel:${channelId}`);
  });

  socket.on("message:send", async ({ channelId, content }) => {
    if (!content || !content.trim()) return;

    const clean = String(content).slice(0, 2000);

    // store in DB
    const [result] = await db.query(
      "INSERT INTO messages (channel_id, user_id, content) VALUES (?, ?, ?)",
      [channelId, user.id, clean]
    );

    const message = {
      id: result.insertId,
      channel_id: channelId,
      content: clean,
      created_at: new Date().toISOString(),
      username: user.username,
    };

    // broadcast
    io.to(`channel:${channelId}`).emit("message:new", { channelId, message });
  });

  // (Later) voice signaling events will go here
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log("Server running on http://localhost:" + PORT));
