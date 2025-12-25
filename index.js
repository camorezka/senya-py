const express = require('express');
const cors = require('cors');
const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');

const app = express();
app.use(cors()); // Включить CORS
app.use(express.json());

// Ваши данные
const GOOGLE_CLIENT_ID = "68632825614-tfjkfpe616jrcfjl02l0k5gd8ar25jbj.apps.googleusercontent.com";
const GROQ_KEY = "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"; // В ПРОДАКШЕНЕ храните в ENV переменных!
const JWT_SECRET = process.env.JWT_SECRET || 'my-super-secret-jwt-key-for-senya'; // В ПРОДАКШЕНЕ ОБЯЗАТЕЛЬНО из ENV!

const client = new OAuth2Client(GOOGLE_CLIENT_ID);

// Роут для авторизации через Google
app.post('/auth/google', async (req, res) => {
    try {
        const ticket = await client.verifyIdToken({ idToken: req.body.token, audience: GOOGLE_CLIENT_ID });
        const payload = ticket.getPayload();
        
        // Создаем наш собственный JWT токен
        const user = { 
            id: payload.sub, 
            name: payload.name, 
            email: payload.email, 
            picture: payload.picture 
        };
        const jwtToken = jwt.sign(user, JWT_SECRET, { expiresIn: '1h' }); // Токен на 1 час

        res.json({ success: true, user: user, jwtToken: jwtToken });
    } catch (e) {
        console.error("Google Auth Error:", e.message);
        res.status(401).json({ success: false, error: e.message });
    }
});

// Middleware для проверки JWT токена
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Получаем токен из "Bearer TOKEN"

    if (token == null) return res.status(401).json({ error: 'Требуется авторизация.' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Недействительный токен.' }); // Токен невалиден или просрочен
        req.user = user; // Сохраняем данные пользователя в запросе
        next();
    });
}

// Роут для общения с ИИ (защищен JWT токеном)
app.post('/chat', authenticateToken, async (req, res) => {
    try {
        // 1. Проверяем, что сообщения вообще пришли
        if (!req.body.messages || !Array.isArray(req.body.messages)) {
            return res.status(400).json({ error: "Массив сообщений пуст или неверен" });
        }

        // 2. Очищаем сообщения перед отправкой в Groq.
        // Оставляем ТОЛЬКО 'role' и 'content'.
        // Заменяем роль 'ai' на 'assistant', чтобы API не выдавал ошибку discriminator.
        const sanitizedMessages = req.body.messages.map(msg => ({
            role: (msg.role === 'ai') ? 'assistant' : msg.role,
            content: String(msg.content)
        }));

        const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${GROQ_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "llama3-8b-8192",
                messages: sanitizedMessages, // Отправляем очищенный массив
                temperature: 0.7,
                max_tokens: 1024
            })
        });
        
        // Получаем JSON сразу, чтобы удобно вытащить ошибку если она есть
        const data = await groqResponse.json();

        if (!groqResponse.ok) {
            console.error("Groq API error details:", data);
            // Возвращаем более понятную ошибку пользователю
            const errorMsg = data.error?.message || JSON.stringify(data);
            return res.status(groqResponse.status).json({ error: `Groq API error: ${errorMsg}` });
        }

        const aiResponseContent = data.choices[0]?.message?.content || "Произошла неизвестная ошибка в ИИ.";
        res.json({ response: aiResponseContent });

    } catch (e) {
        console.error("Chat processing error:", e);
        res.status(500).json({ error: e.message });
    }
});

// Главная страница бэкенда
app.get('/', (req, res) => {
    res.send('Senya AI Backend is operational!');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Backend server running on port ${PORT}`));
