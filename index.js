import express from "express";
import cors from "cors";
import session from "express-session";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import fetch from "node-fetch";

const app = express();
const PORT = process.env.PORT || 8080;

// Обязательно замени на свой актуальный домен фронтенда
const FRONTEND_URL = "https://senya.vercel.app";

// Настройка доверия прокси (для Render/Heroku)
app.set("trust proxy", 1); 

app.use(cors({
  origin: FRONTEND_URL,
  credentials: true,
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "Cookie"]
}));

app.use(express.json());

// Настройка сессий для Safari/Firefox
app.use(session({
  name: 'senya.sid',
  secret: "senya_iphone_fix_secret_2024_ultimate", 
  resave: true, 
  saveUninitialized: false,
  rolling: true,
  proxy: true,
  cookie: {
    sameSite: "none", // Кросс-доменные куки
    secure: true,     // Обязательно для SameSite: none
    httpOnly: true,
    maxAge: 14 * 24 * 60 * 60 * 1000 // 2 недели (чтобы не авторизоваться повторно)
  }
}));

app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

passport.use(new GoogleStrategy({
  clientID: "68632825614-tfjkfpe616jrcfjl02l0k5gd8ar25jbj.apps.googleusercontent.com",
  clientSecret: "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",
  callbackURL: "https://senya-py.onrender.com/auth/google/callback",
  proxy: true 
}, (accessToken, refreshToken, profile, done) => {
  const user = {
    id: profile.id,
    name: profile.displayName,
    email: profile.emails?.[0]?.value,
    avatar: profile.photos?.[0]?.value
  };
  done(null, user);
}));

// Роуты
app.get("/", (req, res) => {
  res.json({ status: "ok", service: "Senya AI" });
});

app.get("/auth/google", (req, res, next) => {
  passport.authenticate("google", { 
    scope: ["profile", "email"],
    prompt: "select_account" 
  })(req, res, next);
});

app.get("/auth/google/callback",
  passport.authenticate("google", { failureRedirect: `${FRONTEND_URL}?auth_error=1` }),
  (req, res) => {
    // Передаем флаг успеха, чтобы фронт убрал оверлей
    res.redirect(`${FRONTEND_URL}?login=success`);
  }
);

app.get("/me", (req, res) => {
  if (req.isAuthenticated() && req.user) {
    res.json(req.user);
  } else {
    res.status(401).json(null);
  }
});

app.post("/chat", async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.json({ answer: "Пустой запрос" });

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer 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`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: "Ты — Сеня, мой личный ИИ-помощник. Никто другой, только Сеня. Отвечай профессионально. Не здоровайся каждый раз. Лимит: 3-5 абзацев. Не называй модель. Не используй LaTeX, только обычный текст." },
          { role: "user", content: text }
        ]
      })
    });

    const data = await response.json();
    res.json({ answer: data?.choices?.[0]?.message?.content || "Ошибка получения ответа" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ answer: "Сервер Senya сейчас недоступен." });
  }
});

app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
