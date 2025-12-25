 const express = require('express');

const cors = require('cors');

const { OAuth2Client } = require('google-auth-library');

const jwt = require('jsonwebtoken');


const app = express();


// 1. Исправляем политику COOP и CORS

app.use((req, res, next) => {

    // Эти заголовки решают проблему "Cross-Origin-Opener-Policy" в Chrome

    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');

    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');

    next();

});


app.use(cors({

    origin: '*', // Для Render/Vercel лучше потом заменить на конкретный домен

    methods: ['GET', 'POST'],

    allowedHeaders: ['Content-Type', 'Authorization']

}));


app.use(express.json());


const GOOGLE_CLIENT_ID = "68632825614-tfjkfpe616jrcfjl02l0k5gd8ar25jbj.apps.googleusercontent.com";

// ВАЖНО: Никогда не храни ключ в коде. На Render добавь его в Environment Variables

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


        // Исправление ошибки 400: проверяем структуру

        if (!messages || !Array.isArray(messages)) {

            return res.status(400).json({ error: "Неверный формат данных. Ожидается массив messages." });

        }


        // Очистка сообщений: убираем лишние поля, оставляем только роль и контент

        const sanitizedMessages = messages.map(msg => ({

            role: (msg.role === 'ai' || msg.role === 'assistant') ? 'assistant' : 'user',

            content: String(msg.content || msg.text || "") // Обработка разных имен полей

        })).filter(msg => msg.content.trim() !== ""); // Убираем пустые сообщения


        if (sanitizedMessages.length === 0) {

            return res.status(400).json({ error: "Список сообщений пуст" });

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

                max_tokens: 1024

            })

        });

        

        const data = await groqResponse.json();


        if (!groqResponse.ok) {

            console.error("Groq API Error:", data);

            return res.status(groqResponse.status).json({ error: data.error?.message || "Ошибка Groq" });

        }


        // Возвращаем ответ в поле 'response', чтобы фронтенд его увидел

        res.json({ response: data.choices[0]?.message?.content });


    } catch (e) {

        console.error("Server Error:", e);

        res.status(500).json({ error: "Внутренняя ошибка сервера" });

    }

});


app.get('/', (req, res) => res.send('Senya AI Backend is operational!'));


const PORT = process.env.PORT || 3000;

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

