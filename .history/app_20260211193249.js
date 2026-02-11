require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const path = require("path");

const authRoutes = require("./routes/auth");
const channelRoutes = require("./routes/channels");



const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use("/channels", channelRoutes);

// Static pages (login/register/app)
app.use(express.static(path.join(__dirname, "public")));


app.get("/", (req, res) => {
  res.redirect("/login.html");
});

// API routes
app.use("/auth", authRoutes);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
