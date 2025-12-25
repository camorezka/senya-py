import express from "express";
import cors from "cors";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";
import crypto from "crypto";

const app = express();
const PORT = process.env.PORT || 8080;

const FRONTEND_URL = "https://senya.vercel.app"; // фронтенд
const JWT_SECRET = process.env.JWT_SECRET || "super_secret_key";
const REFRESH_SECRET = process.env.REFRESH_SECRET || "super_refresh_key";

// --- Middlewares ---
app.use(express.json());
app.use(cookieParser());
app.use(cors({
  origin: FRONTEND_URL,
  credentials: true,
  methods: ["GET","POST","OPTIONS"],
  allowedHeaders: ["Content-Type","Authorization"]
}));

// --- Passport Google OAuth ---
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: "https://senya-py.onrender.com/auth/google/callback"
}, (accessToken, refreshToken, profile, done) => {
  const user = {
    id: profile.id,
    name: profile.displayName,
    email: profile.emails?.[0]?.value
  };
  done(null, user);
}));
app.use(passport.initialize());

// --- Google login (с state) ---
app.get("/auth/google", (req, res, next) => {
  const state = crypto.randomBytes(16).toString("hex");
  res.cookie("oauth_state", state, { httpOnly: true, secure: true, sameSite: "lax" });
  passport.authenticate("google", { scope: ["profile", "email"], state })(req, res, next);
});

// --- Google callback ---
app.get("/auth/google/callback",
  passport.authenticate("google", { session: false, failureRedirect: "/" }),
  (req, res) => {
    const stateCookie = req.cookies.oauth_state;
    const stateQuery = req.query.state;
    if (!stateCookie || stateCookie !== stateQuery) {
      return res.status(403).send("CSRF validation failed");
    }

    const user = req.user;

    // создаём access и refresh токены
    const accessToken = jwt.sign(user, JWT_SECRET, { expiresIn: "15m" });
    const refreshToken = jwt.sign(user, REFRESH_SECRET, { expiresIn: "7d" });

    // отправляем refresh токен в HttpOnly cookie
    res.cookie("refresh_token", refreshToken, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 7*24*60*60*1000 });

    // редирект на фронт с access токеном
    res.redirect(`${FRONTEND_URL}/?token=${accessToken}`);
  }
);

// --- Refresh токен ---
app.post("/refresh_token", (req, res) => {
  try {
    const token = req.cookies.refresh_token;
    if (!token) throw new Error("No refresh token");

    const user = jwt.verify(token, REFRESH_SECRET);
    const newAccess = jwt.sign(user, JWT_SECRET, { expiresIn: "15m" });
    res.json({ token: newAccess });
  } catch {
    res.status(401).json({ token: null });
  }
});

// --- Проверка access токена ---
app.get("/me", (req, res) => {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.split(" ")[1];
    if (!token) throw new Error("No token");

    const user = jwt.verify(token, JWT_SECRET);
    res.json({ user });
  } catch {
    res.json({ user: null });
  }
});

// --- Чат (твой код) ---
app.post("/chat", async (req,res) => {
  try {
    const { text } = req.body;
    if (!text) return res.json({ answer: "Пустой запрос" });

    const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-120b",
        messages: [
          { role: "system", content: "Ты — Сеня, личный ИИ‑помощник. Пиши просто и по делу." },
          { role: "user", content: text }
        ]
      })
    });

    const data = await r.json();
    res.json({ answer: data?.choices?.[0]?.message?.content || "Нет ответа" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ answer: "Сервер недоступен" });
  }
});

app.get("/ping", (_, res) => res.json({ status: "alive" }));

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
