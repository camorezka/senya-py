
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
  allowedHeaders: ["Content-Type", "Authorization", "Cookie"]
}));

app.use(express.json());

app.use(session({
  name: 'senya.sid', // Явное имя для куки
  secret: "senya_iphone_fix_secret_2024", 
  resave: true, // Важно для Safari
  saveUninitialized: false,
  rolling: true, // Обновляет куку при каждом действии
  proxy: true,
  cookie: {
    sameSite: "none", // Кросс-доменные куки
    secure: true,     // Обязательно для SameSite: none
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000 // 1 неделя
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
  res.json({ status: "ok", service: "Senya AI Backend" });
});

app.get("/auth/google", (req, res, next) => {
  passport.authenticate("google", { 
    scope: ["profile", "email"],
    prompt: "select_account" 
  })(req, res, next);
});

app.get("/auth/google/callback",
  passport.authenticate("google", { failureRedirect: FRONTEND_URL + "?auth_error=1" }),
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

app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
