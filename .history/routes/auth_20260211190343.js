const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const db = require("../db");
const auth = require("../middleware/auth");

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || "change_me_dev_secret";

function signToken(user) {
  return jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: "7d" });
}

function setAuthCookie(res, token) {
  // For localhost dev (HTTP). If you deploy HTTPS, set secure: true.
  res.cookie("token", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/",
    maxAge: 1000 * 60 * 60 * 24 * 7,
  });
}

router.post("/register", async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || username.length < 3) return res.status(400).json({ error: "Username too short" });
  if (!email) return res.status(400).json({ error: "Email required" });
  if (!password || password.length < 6) return res.status(400).json({ error: "Password too short" });

  const password_hash = await bcrypt.hash(password, 10);

  try {
    const [result] = await db.execute(
      "INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)",
      [username, email, password_hash]
    );

    const user = { id: result.insertId, username };
    const token = signToken(user);
    setAuthCookie(res, token);

    res.json({ user });
  } catch (e) {
    // likely duplicate username/email
    res.status(400).json({ error: "Username or email already exists" });
  }
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email) return res.status(400).json({ error: "Email required" });
  if (!password) return res.status(400).json({ error: "Password required" });

  const [rows] = await db.execute("SELECT id, username, password_hash FROM users WHERE email = ?", [email]);
  const user = rows[0];
  if (!user) return res.status(401).json({ error: "Invalid credentials" });

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: "Invalid credentials" });

  const token = signToken({ id: user.id, username: user.username });
  setAuthCookie(res, token);

  res.json({ user: { id: user.id, username: user.username } });
});

router.get("/me", auth, (req, res) => {
  res.json({ user: req.user });
});

router.post("/logout", (req, res) => {
  res.clearCookie("token", { path: "/" });
  res.json({ ok: true });
});

module.exports = router;
