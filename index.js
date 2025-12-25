
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
app.set("trust proxy", 1); 

app.use(cors({
  origin: FRONTEND_URL,
  credentials: true,
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json());

app.use(session({
  secret: "senya_ultra_secure_key_99", 
  resave: true, // Для Safari/iOS лучше оставить true, чтобы кука обновлялась
  saveUninitialized: false,
  rolling: true, // Обновляет куку при каждом запросе
  proxy: true,
  cookie: {
    sameSite: "none", 
    secure: true,     
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24 * 7 // 7 дней
  }
}));

app.use(passport.initialize());
app.use(passport.session());

// === Passport ===
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

// === Routes ===

app.get("/", (req, res) => {
  res.send("Senya API Online");
});

app.get("/auth/google", (req, res, next) => {
  // Очистка старой сессии перед входом
  req.logout((err) => {
    passport.authenticate("google", { scope: ["profile", "email"], prompt: "select_account" })(req, res, next);
  });
});

app.get("/auth/google/callback",
  passport.authenticate("google", { failureRedirect: FRONTEND_URL + "?error=auth" }),
  (req, res) => {
    res.redirect(FRONTEND_URL + "?login=success");
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

    const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer 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`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: "Ты — Сеня, мой личный ИИ-помощник. Никто другой, только Сеня. Отвечай на вопросы по текстам, кодам, домашке и проектам. Генерируй очень быстро, профессионально. Не здоровайся каждый раз, 1 раз в чате и все. Лимит сообщения: 3-5 абзацев, пиши подробно, если просят. Если спрашивают, кто ты — говори, что ты Сеня, ИИ, созданный на основе разных технологий. Никогда не называй свою модель. Не используй LaTeX, формулы только обычным текстом. Пиши простыми словами, по существу. Сохраняй анонимность пользователя. Поясняй термины и приводь примеры, если нужно. " },
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

app.listen(PORT, () => console.log(`Server running on ${PORT}`));
