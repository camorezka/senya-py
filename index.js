const express = require('express');
const cors = require('cors');
const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');

const app = express();

// Константа с системным промптом
const SYSTEM_PROMPT = {
    role: "system",
    content: "Ты — Сеня, мой личный ИИ-помощник. Никто другой, только Сеня. Отвечай на вопросы по текстам, кодам, домашке и проектам. Генерируй очень быстро, профессионально. Не здоровайся каждый раз, 1 раз в чате и все. Лимит сообщения: 3-5 абзацев, пиши подробно, если просят. Если спрашивают, кто ты — говори, что ты Сеня, ИИ, созданный на основе разных технологий. Никогда не называй свою модель. Не используй LaTeX, формулы только обычным текстом. Пиши простыми словами, по существу. Сохраняй анонимность пользователя. Поясняй термины и приводь примеры, если нужно."
};

// 1. Исправляем политику COOP и CORS
app.use((req, res, next) => {
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    next();
});

app.use(cors({
    origin: '*', 
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

const GOOGLE_CLIENT_ID = "68632825614-tfjkfpe616jrcfjl02l0k5gd8ar25jbj.apps.googleusercontent.com";
const GROQ_KEY = process.env.GROQ_KEY || "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"; 
const JWT_SECRET = process.env.JWT_SECRET || 'my-super-secret-jwt-key-for-senya';

const client = new OAuth2Client(GOOGLE_CLIENT_ID);

// Авторизация через Google
app.post('/auth/google', async (req, res) => {
    try {
        const { token } = req.body;
        if (!token) return res.status(400).json({ success: false, error: "Токен не предоставлен" });

        const ticket = await client.verifyIdToken({ 
            idToken: token, 
            audience: GOOGLE_CLIENT_ID 
        });
        const payload = ticket.getPayload();
        
        const user = { 
            id: payload.sub, 
            name: payload.name, 
            email: payload.email, 
            picture: payload.picture 
        };
        const jwtToken = jwt.sign(user, JWT_SECRET, { expiresIn: '24h' });

        res.json({ success: true, user: user, jwtToken: jwtToken });
    } catch (e) {
        console.error("Google Auth Error:", e.message);
        res.status(401).json({ success: false, error: "Ошибка авторизации" });
    }
});

// Middleware проверки JWT
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ error: 'Требуется авторизация.' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Сессия истекла.' });
        req.user = user;
        next();
    });
}

// Роут чата
app.post('/chat', authenticateToken, async (req, res) => {
    try {
        const { messages } = req.body;

        if (!messages || !Array.isArray(messages)) {
            return res.status(400).json({ error: "Неверный формат данных. Ожидается массив messages." });
        }

        // Очистка сообщений: убираем лишние поля
        const sanitizedMessages = messages.map(msg => ({
            role: (msg.role === 'ai' || msg.role === 'assistant') ? 'assistant' : 'user',
            content: String(msg.content || msg.text || "")
        })).filter(msg => msg.content.trim() !== "");

        if (sanitizedMessages.length === 0) {
            return res.status(400).json({ error: "Список сообщений пуст" });
        }

        // ВАЖНО: Добавляем системный промпт В НАЧАЛО массива
        const finalMessages = [SYSTEM_PROMPT, ...sanitizedMessages];

        const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${GROQ_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "llama-3.3-70b-versatile", // Исправил модель на рабочую для Groq (llama-3.3-70b)
                messages: finalMessages, // Отправляем сообщения вместе с промптом
                temperature: 0.7,
                max_tokens: 1024
            })
        });
        
        const data = await groqResponse.json();

        if (!groqResponse.ok) {
            console.error("Groq API Error:", data);
            return res.status(groqResponse.status).json({ error: data.error?.message || "Ошибка Groq" });
        }

        res.json({ response: data.choices[0]?.message?.content });

    } catch (e) {
        console.error("Server Error:", e);
        res.status(500).json({ error: "Внутренняя ошибка сервера" });
    }
});

app.get('/', (req, res) => res.send('Senya AI Backend is operational!'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
