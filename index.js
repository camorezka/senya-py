import express from "express";
import cors from "cors";
import session from "express-session";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import fetch from "node-fetch";

const app = express();
const PORT = process.env.PORT || 8080;

/* ===== CORS ===== */
app.use(cors({
  origin: "https://senya.vercel.app",
  credentials: true
}));

app.use(express.json());

/* ===== SESSION ===== */
app.use(session({
  secret: process.env.SESSION_SECRET || "secret_key",
  resave: false,
  saveUninitialized: false,
  cookie: {
    sameSite: "none",
    secure: true
  }
}));

/* ===== PASSPORT ===== */
app.use(passport.initialize());
app.use(passport.session());

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

/* ===== AUTH ROUTES ===== */
app.get("/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

app.get("/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/" }),
  (req, res) => {
    res.redirect("https://senya.vercel.app?logged_in=1");
  }
);

/* ===== ME ===== */
app.get("/me", (req, res) => {
  res.json(req.user || {});
});

/* ===== CHAT ===== */
app.post("/chat", async (req, res) => {
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
          { role: "system", content: "Ты — Сеня, личный ИИ-помощник. Пиши просто и по делу." },
          { role: "user", content: text }
        ]
      })
    });

    const data = await r.json();
    const answer = data?.choices?.[0]?.message?.content || "Ошибка ответа";

    res.json({ answer });
  } catch (e) {
    console.error(e);
    res.json({ answer: "Сервер временно недоступен" });
  }
});

/* ===== PING ===== */
app.get("/ping", (_, res) => res.json({ status: "alive" }));

/* ===== START SERVER ===== */
app.listen(PORT, () => {
  console.log(`Senya backend running on port ${PORT}`);
});
