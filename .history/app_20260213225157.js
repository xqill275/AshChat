/*********************************
 * Setup & Dependencies
 *********************************/
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const path = require("path");
const http = require("http");
const jwt = require("jsonwebtoken");
const { Server } = require("socket.io");

const db = require("./db");
const authRoutes = require("./routes/auth");
const channelRoutes = require("./routes/channels");

/*********************************
 * App & Server
 *********************************/
const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || "change_me_dev_secret";

/*********************************
 * Middleware
 *********************************/
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

/*********************************
 * Routes
 *********************************/
app.use("/auth", authRoutes);
app.use("/channels", channelRoutes);

app.get("/", (_req, res) => {
  res.redirect("/register.html");
});

/*********************************
 * Socket.IO
 *********************************/
const io = new Server(server, {
  cors: { origin: true, credentials: true },
});

/*********************************
 * Voice Room State
 *********************************/
const voiceRooms = new Map();

function getVoiceRoom(channelId) {
  const key = String(channelId);
  if (!voiceRooms.has(key)) {
    voiceRooms.set(key, new Set());
  }
  return voiceRooms.get(key);
}

function leaveAllVoiceRooms(socket) {
  for (const [channelId, members] of voiceRooms.entries()) {
    if (!members.has(socket.id)) continue;

    members.delete(socket.id);
    socket.to(`voice:${channelId}`).emit("voice:user_left", {
      channelId,
      socketId: socket.id,
    });

    if (members.size === 0) {
      voiceRooms.delete(channelId);
    }
  }
}


 //Socket Auth (JWT from cookie)

io.use((socket, next) => {
  const cookieHeader = socket.handshake.headers.cookie ?? "";

  const tokenPair = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith("token="));

  if (!tokenPair) {
    return next(new Error("unauthorized"));
  }

  const token = decodeURIComponent(tokenPair.split("=")[1]);

  try {
    socket.user = jwt.verify(token, JWT_SECRET); // { id, username }
    next();
  } catch {
    next(new Error("unauthorized"));
  }
});


 // Socket Events

io.on("connection", (socket) => {
  // Channel Chat 
  socket.on("channel:join", ({ channelId }) => {
    socket.join(`channel:${channelId}`);
  });

  socket.on("message:send", async ({ channelId, content }) => {
    const text = String(content ?? "").trim();
    if (!text) return;

    const messageText = text.slice(0, 2000);
    const user = socket.user;

    const [result] = await db.execute(
      "INSERT INTO messages (channel_id, user_id, content) VALUES (?, ?, ?)",
      [channelId, user.id, messageText]
    );

    const message = {
      id: result.insertId,
      channel_id: Number(channelId),
      user_id: user.id,
      username: user.username,
      content: messageText,
      created_at: new Date().toISOString(),
    };

    io.to(`channel:${channelId}`).emit("message:new", {
      channelId,
      message,
    });
  });

  // Voice Chat
  socket.on("voice:join", ({ channelId }) => {
    const room = getVoiceRoom(channelId);
    room.add(socket.id);

    socket.join(`voice:${channelId}`);

    const peers = [...room]
      .filter((id) => id !== socket.id)
      .map((id) => ({
        socketId: id,
        username: io.sockets.sockets.get(id)?.user?.username || "user",
      }));

    socket.emit("voice:peers", { channelId, peers });

    socket.to(`voice:${channelId}`).emit("voice:user_joined", {
      channelId,
      socketId: socket.id,
      username: socket.user.username,
    });
  });

  socket.on("voice:leave", ({ channelId }) => {
    const room = voiceRooms.get(String(channelId));
    if (!room) return;

    room.delete(socket.id);
    socket.leave(`voice:${channelId}`);

    socket.to(`voice:${channelId}`).emit("voice:user_left", {
      channelId,
      socketId: socket.id,
    });

    if (room.size === 0) {
      voiceRooms.delete(String(channelId));
    }
  });

  socket.on("disconnect", () => {
    leaveAllVoiceRooms(socket);
  });

  // WebRTC Signaling
  socket.on("webrtc:offer", ({ to, channelId, sdp }) => {
    io.to(to).emit("webrtc:offer", {
      from: socket.id,
      channelId,
      sdp,
    });
  });

  socket.on("webrtc:answer", ({ to, channelId, sdp }) => {
    io.to(to).emit("webrtc:answer", {
      from: socket.id,
      channelId,
      sdp,
    });
  });

  socket.on("webrtc:ice", ({ to, channelId, candidate }) => {
    io.to(to).emit("webrtc:ice", {
      from: socket.id,
      channelId,
      candidate,
    });
  });
});


 // Start Server

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
