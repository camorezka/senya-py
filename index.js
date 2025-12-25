import express from "express";
import cors from "cors";
import session from "express-session";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import fetch from "node-fetch";

const app = express();
const PORT = process.env.PORT || 8080;

const FRONTEND_URL = "https://senya.vercel.app";

// === Middleware ===
app.set("trust proxy", 1); // если за прокси (Vercel, Render)
app.use(cors({
  origin: FRONTEND_URL,
  credentials: true,
}));
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || "super_secret_key",
  resave: false,
  saveUninitialized: false,
  cookie: {
    sameSite: "none",
    secure: true,
    httpOnly: true,
    maxAge: 24*60*60*1000
  }
}));

app.use(passport.initialize());
app.use(passport.session());

// === Passport ===
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

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

// === Routes ===

// Google login
app.get("/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

// Google callback
app.get("/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/" }),
  (req, res) => {
    // редирект на фронт с info о сессии
    res.redirect(FRONTEND_URL + "?login=success");
  }
);

// Проверка пользователя
app.get("/me", (req, res) => {
  res.json(req.user || null);
});

// Чат
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

// Пинг
app.get("/ping", (_, res) => res.json({ status: "alive" }));

// Запуск сервера
app.listen(PORT, () => console.log(`Server running on ${PORT}`));
