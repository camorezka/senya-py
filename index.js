const express = require('express');
const cors = require('cors');
const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');
const fetch = require('node-fetch'); // Для выполнения HTTP-запросов к Groq

const app = express();

// Секретный ключ для подписи JWT токенов. В ПРОДАКШЕНЕ ИСПОЛЬЗУЙТЕ СЛОЖНЫЙ КЛЮЧ ИЗ ПЕРЕМЕННЫХ ОКРУЖЕНИЯ!
const JWT_SECRET = process.env.JWT_SECRET || 'my-super-secret-jwt-key';

// Данные из задания
const GOOGLE_CLIENT_ID = "68632825614-tfjkfpe616jrcfjl02l0k5gd8ar25jbj.apps.googleusercontent.com";
const GROQ_API_KEY = "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";
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "llama3-8b-8192"; // Используем Llama3, т.к. "openai/gpt-oss-120b" - это не формат Groq

const client = new OAuth2Client(GOOGLE_CLIENT_ID);

app.use(cors()); // Включаем CORS для всех запросов
app.use(express.json());

// Заглушка для главной страницы бэкенда
app.get('/', (req, res) => {
    res.send('Senya AI Backend is running!');
});

// Middleware для проверки JWT токена
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) return res.sendStatus(401); // Если токена нет

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403); // Если токен невалидный
        req.user = user;
        next();
    });
}

// 1. Авторизация Google
app.post('/auth/google', async (req, res) => {
    const { token } = req.body;
    try {
        const ticket = await client.verifyIdToken({
            idToken: token,
            audience: GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        
        // Создаем JWT токен для нашего приложения
        const user = { 
            id: payload.sub, // Уникальный ID пользователя Google
            name: payload.name,
            email: payload.email,
            picture: payload.picture
        };
        const jwtToken = jwt.sign(user, JWT_SECRET, { expiresIn: '1h' }); // Токен действует 1 час

        res.json({
            success: true,
            user: {
                name: user.name,
                email: user.email,
                picture: user.picture
            },
            jwtToken: jwtToken // Отправляем наш JWT токен на фронтенд
        });

    } catch (error) {
        console.error('Google Auth Error:', error);
        res.status(401).json({ success: false, error: 'Недействительный токен Google' });
    }
});

// 2. Проксирование запросов к Groq API (защищено JWT токеном)
app.post('/chat', authenticateToken, async (req, res) => {
    const { messages, model = MODEL } = req.body; // Получаем историю сообщений и модель

    if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: 'Неверный формат сообщений.' });
    }

    try {
        const groqResponse = await fetch(GROQ_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${GROQ_API_KEY}` // Используем API ключ Groq
            },
            body: JSON.stringify({
                model: model,
                messages: messages,
                temperature: 0.7, // Можно настроить "креативность" ИИ
                max_tokens: 1024,
            })
        });

        if (!groqResponse.ok) {
            const errorText = await groqResponse.text();
            console.error('Groq API Error:', groqResponse.status, errorText);
            throw new Error(`Ошибка Groq API: ${groqResponse.status} - ${errorText}`);
        }

        const groqData = await groqResponse.json();
        // Извлекаем ответ ИИ
        const aiResponseContent = groqData.choices[0]?.message?.content || "Не удалось получить ответ от ИИ.";

        res.json({ response: aiResponseContent });

    } catch (error) {
        console.error('Error processing chat:', error);
        res.status(500).json({ error: error.message });
    }
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Backend server running on port ${PORT}`));
