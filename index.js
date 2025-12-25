const express = require('express');
const cors = require('cors');
const { OAuth2Client } = require('google-auth-library');

const app = express();
const CLIENT_ID = "68632825614-tfjkfpe616jrcfjl02l0k5gd8ar25jbj.apps.googleusercontent.com";
const client = new OAuth2Client(CLIENT_ID);

app.use(cors()); // Разрешает запросы с вашего домена Vercel
app.use(express.json());

app.post('/auth/google', async (req, res) => {
    try {
        const { token } = req.body;
        const ticket = await client.verifyIdToken({
            idToken: token,
            audience: CLIENT_ID,
        });
        const payload = ticket.getPayload();

        res.json({
            success: true,
            user: { name: payload.name, email: payload.email }
        });
    } catch (e) {
        res.status(400).json({ success: false });
    }
});

app.listen(process.env.PORT || 3000);
