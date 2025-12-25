import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();

app.use(express.json());

app.use(cors({
    origin: "https://senya.vercel.app",
    methods: ["POST"]
}));

const GOOGLE_CLIENT_ID =
    "68632825614-tfjkfpe616jrcfjl02l0k5gd8ar25jbj.apps.googleusercontent.com";

const GOOGLE_CLIENT_SECRET =
    "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";

app.post("/auth/google", async (req, res) => {
    try {
        const { token } = req.body;

        const googleRes = await fetch(
            `https://oauth2.googleapis.com/tokeninfo?id_token=${token}`
        );

        const user = await googleRes.json();

        if (user.aud !== GOOGLE_CLIENT_ID) {
            return res.status(401).json({
                message: "Неверный токен"
            });
        }

        // === ТУТ ТВОЯ ЛОГИКА ИИ ===
        // регистрация, база, сессия, jwt и т.д.

        console.log("Google user:", {
            email: user.email,
            name: user.name
        });

        res.json({
            message: `Успешный вход: ${user.email}`
        });

    } catch (err) {
        res.status(500).json({
            message: "Ошибка сервера"
        });
    }
});

app.listen(3000, () => {
    console.log("Server running on port 3000");
});
