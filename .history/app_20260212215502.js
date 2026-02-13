require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");

const db = require("./db");

const authRoutes = require("./routes/auth");
const channelRoutes = require("./routes/channels");

const app = express();
const server = http.createServer(app);

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

app.use("/auth", authRoutes);
app.use("/channels", channelRoutes);

const io = new Server(server, { cors: { origin: true, credentials: true } });

const JWT_SECRET = process.env.JWT_SECRET || "change_me_dev_secret";

const voiceRooms = new Map();

function roomSet(channelId) {
  const key = String(channelId);
  if (!voiceRooms.has(key)) voiceRooms.set(key, new Set());
  return voiceRooms.get(key);
}

app.get("/", (req, res) => {
  res.redirect("/register.html");
});

// ---- Socket auth: read JWT from cookie ----
io.use((socket, next) => {
  const cookieHeader = socket.handshake.headers.cookie || "";
  const tokenPair = cookieHeader
    .split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith("token="));

  if (!tokenPair) return next(new Error("unauthorized"));

  const token = decodeURIComponent(tokenPair.split("=")[1]);

  try {
    socket.user = jwt.verify(token, JWT_SECRET); // {id, username}
    next();
  } catch {
    next(new Error("unauthorized"));
  }
});

io.on("connection", (socket) => {
  // join room for a channel
  socket.on("channel:join", ({ channelId }) => {
    socket.join(`channel:${channelId}`);
  });

  // send message -> save -> broadcast
  socket.on("message:send", async ({ channelId, content }) => {
    const user = socket.user; // {id, username}
    const clean = String(content || "").trim();
    if (!clean) return;

    const msgText = clean.slice(0, 2000);

    const [result] = await db.execute(
      "INSERT INTO messages (channel_id, user_id, content) VALUES (?, ?, ?)",
      [channelId, user.id, msgText]
    );

    const message = {
      id: result.insertId,
      channel_id: Number(channelId),
      user_id: user.id,
      username: user.username,
      content: msgText,
      created_at: new Date().toISOString(),
    };

    io.to(`channel:${channelId}`).emit("message:new", { channelId, message });
  });

  socket.on("voice:join", ({ channelId }) => {
  const key = String(channelId);

  const set = roomSet(key);
  set.add(socket.id);

  socket.join(`voice:${key}`);

  // send the joiner the current peers to connect to
  const peers = Array.from(set)
    .filter((sid) => sid !== socket.id)
    .map((sid) => ({
      socketId: sid,
      username: io.sockets.sockets.get(sid)?.user?.username || "user",
    }));

  socket.emit("voice:peers", { channelId: key, peers });

  // notify existing peers
  socket.to(`voice:${key}`).emit("voice:user_joined", {
    channelId: key,
    socketId: socket.id,
    username: socket.user.username,
  });
});

socket.on("voice:leave", ({ channelId }) => {
  const key = String(channelId);
  const set = voiceRooms.get(key);
  if (set) set.delete(socket.id);

  socket.leave(`voice:${key}`);
  socket.to(`voice:${key}`).emit("voice:user_left", { channelId: key, socketId: socket.id });

  if (set && set.size === 0) voiceRooms.delete(key);
});

socket.on("disconnect", () => {
  for (const [key, set] of voiceRooms.entries()) {
    if (set.has(socket.id)) {
      set.delete(socket.id);
      socket.to(`voice:${key}`).emit("voice:user_left", { channelId: key, socketId: socket.id });
      if (set.size === 0) voiceRooms.delete(key);
    }
  }
});

// WebRTC signaling relay
socket.on("webrtc:offer", ({ to, channelId, sdp }) => {
  io.to(to).emit("webrtc:offer", { from: socket.id, channelId, sdp });
});

socket.on("webrtc:answer", ({ to, channelId, sdp }) => {
  io.to(to).emit("webrtc:answer", { from: socket.id, channelId, sdp });
});

socket.on("webrtc:ice", ({ to, channelId, candidate }) => {
  io.to(to).emit("webrtc:ice", { from: socket.id, channelId, candidate });
});

});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
