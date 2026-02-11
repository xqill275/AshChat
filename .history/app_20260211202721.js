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

app.get("/", (req, res) => {
  res.redirect("/register.html");

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
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
