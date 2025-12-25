import express from "express";
import cors from "cors";
import session from "express-session";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import fetch from "node-fetch";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors({
  origin: "https://senya.vercel.app",
  credentials: true
}));

app.use(express.json());

app.use(session({
  secret: process.env.SESSION_SECRET || "secret_key",
  resave: false,
  saveUninitialized: false,
  cookie: {
    sameSite: "none",
    secure: true,
    maxAge: 24*60*60*1000
  }
}));

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

app.get("/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

app.get("/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/" }),
  (req, res) => {
    res.redirect("https://senya.vercel.app?logged_in=1");
  }
);

app.get("/me", (req, res) => {
  res.json(req.user || {});
});

app.post("/chat", async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.json({ answer: "Пустой запрос" });
    // здесь твой fetch к API
  } catch (e) {
    console.error(e);
    res.status(500).json({ answer: "Сервер временно недоступен" });
  }
});

// раздаём фронтенд
app.use(express.static(path.join(__dirname, "../senya-h/public")));
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../senya-h/public/index.html"));
});

app.listen(PORT, () => console.log(`Backend запущен на ${PORT}`));
