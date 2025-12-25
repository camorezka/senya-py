import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();

app.use(cors());
app.use(express.json());

const GOOGLE_CLIENT_ID = "68632825614-tfjkfpe616jrcfjl02l0k5gd8ar25jbj.apps.googleusercontent.com";
const GOOGLE_CLIENT_SECRET = "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";

app.post("/auth/google", async (req, res) => {
    const { token } = req.body;

    // Проверяем ID Token
    const googleRes = await fetch(
        `https://oauth2.googleapis.com/tokeninfo?id_token=${token}`
    );

    const userData = await googleRes.json();

    if (userData.aud !== GOOGLE_CLIENT_ID) {
        return res.status(401).json({ message: "Неверный токен" });
    }

    // Тут можно сохранить пользователя, создать сессию и т.д.
    console.log("Пользователь вошел:", userData.email);

    res.json({
        message: `Успешный вход: ${userData.email}`
    });
});

app.listen(3000, () => {
    console.log("Server started on http://localhost:3000");
});
