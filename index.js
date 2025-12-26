 const express = require('express');

const cors = require('cors');

const { OAuth2Client } = require('google-auth-library');

const jwt = require('jsonwebtoken');


const app = express();



app.use((req, res, next) => {
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    next();
});


app.use(cors({
    origin: ['https://senya.vercel.app'],
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));


app.use(express.json());


const GOOGLE_CLIENT_ID = "68632825614-tfjkfpe616jrcfjl02l0k5gd8ar25jbj.apps.googleusercontent.com";

const GROQ_KEY = process.env.GROQ_KEY || "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"; 

const JWT_SECRET = process.env.JWT_SECRET || 'my-super-secret-jwt-key-for-senya';


const client = new OAuth2Client(GOOGLE_CLIENT_ID);




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




app.post('/chat', authenticateToken, async (req, res) => {
    try {
        const { messages } = req.body;
     

        if (!messages || !Array.isArray(messages)) {
            return res.status(400).json({ error: "Неверный формат данных." });
        }

        // Санитизация сообщений
        const sanitizedMessages = messages.map(msg => ({
            role: (msg.role === 'ai' || msg.role === 'assistant' || msg.role === 'bot') ? 'assistant' : 'user',
            content: String(msg.content || "") 
        })).filter(msg => msg.content.trim() !== "");

        // Проверка на наличие системного промпта (опционально, но полезно для "характера" Сени)
        if (sanitizedMessages.length > 0 && sanitizedMessages[0].role !== 'system') {
            sanitizedMessages.unshift({
                role: "system",
                content: "Ты — Сеня, ИИ-помощник. Твои правила: 1. Если просят таблицу — генерируй её НЕМЕДЛЕННО в Markdown, лимит 2048 токенов. 2. Отвечай кратко (3-4 абзаца), профессионально. 3. Не здоровайся чаще одного раза за сессию. 4. На вопрос 'кто ты' отвечай: 'Я — Сеня, ИИ на основе разных технологий'. Модель senya/v-01. 5. Никакого LaTeX — только обычный текст. 6. Если задача понятна — выполняй сразу, без уточнений. Поясняй термины кратко и только если это уместно. 7. ВСЕ мои требования - АНОНИМНЫ"            });
        }

        const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${GROQ_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "openai/gpt-oss-120b", 
                messages: sanitizedMessages,
                temperature: 0.7,
                max_tokens: 2048 
            })
        });

        const data = await groqResponse.json();

        if (!groqResponse.ok) {
            console.error("Groq API Error:", data);
            return res.status(groqResponse.status).json({ error: data.error?.message || "Ошибка Groq" });
        }

        let aiReply = data.choices?.[0]?.message?.content;

        if (!aiReply) {
            return res.status(500).json({ error: "Пустой ответ от модели" });
        }

        // Отправляем чистую строку. Фронтенд сам прогонит её через marked.js
        res.json({ response: aiReply });

    } catch (e) {
        console.error("Server Error:", e);
        res.status(500).json({ error: "Внутренняя ошибка сервера" });
    }
});

app.get('/', (req, res) => res.send('Senya AI Backend is operational!'));


const PORT = process.env.PORT || 3000;

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

