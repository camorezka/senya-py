import os
import sys
import logging
import asyncio
import requests

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse, JSONResponse
from starlette.middleware.sessions import SessionMiddleware
from authlib.integrations.starlette_client import OAuth



# ===== ЛОГИРОВАНИЕ =====
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    stream=sys.stdout
)
logger = logging.getLogger("service")

# ===== КОНФИГУРАЦИЯ =====
WEB_SERVER_PORT = int(os.getenv("PORT", 8080))
BASE_WEBHOOK_URL = os.getenv("BASE_WEBHOOK_URL", None)

os.environ["OAUTHLIB_INSECURE_TRANSPORT"] = "1"



GROQ_API_KEY = os.getenv("GROQ_API_KEY", "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")
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "68632825614-tfjkfpe616jrcfjl02l0k5gd8ar25jbj.apps.googleusercontent.com")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "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")
API_URL = "https://api.groq.com/openai/v1/chat/completions"
SECRET_KEY = 'CHANGE_ME_BRUH'
MODEL = "openai/gpt-oss-120b"



SYSTEM_PROMPT = """Ты — Сеня, мой личный ИИ-помощник. Никто другой, только Сеня. 
Отвечай на вопросы по текстам, кодам, домашке и проектам. Генерируй очень быстро, проффисеонально.
Не здоровайся каждый раз, 1 раз в чате и все. Лимит сообщения: 3-5 абзацев, пиши подробно, если просят.
Если спрашивают, кто ты — говори, что ты Сеня, ИИ, созданный на основе разных технологий. 
Никогда не называй свою модель. 
Не используй LaTeX, формулы только обычным текстом.
Пиши простыми словами, по существу. Сохраняй анонимность пользователя. 
Поясняй термины и приводь примеры, если нужно. """

MAX_HISTORY = 50
MAX_REQUESTS = 10

user_history = {}
user_requests = {}

# ===== Приложение =====
app = FastAPI()

# CORS для фронтенда на Vercel
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://senya.vercel.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Сессии с куки, чтобы OAuth state работал на мобильных
app.add_middleware(
    SessionMiddleware,
    secret_key=SECRET_KEY,
    same_site="none",   # кросс-доменная сессия
    https_only=True     # работает только на HTTPS
)

# ===== OAuth =====
oauth = OAuth()
oauth.register(
    name="google",
    client_id=GOOGLE_CLIENT_ID,
    client_secret=GOOGLE_CLIENT_SECRET,
    server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
    client_kwargs={"scope": "openid email profile"}
)

# ===== Маршруты =====
@app.get("/auth/google")
async def google_login(request: Request):
    redirect_uri = "https://senya-py.onrender.com/auth/google/callback"
    return await oauth.google.authorize_redirect(request, redirect_uri)

@app.get("/auth/google/callback")
async def google_callback(request: Request):
    try:
        token = await oauth.google.authorize_access_token(request)
        user = token["userinfo"]
        request.session["user"] = {
            "id": user["sub"],
            "name": user["name"],
            "email": user.get("email")
        }
    except Exception as e:
        logger.error(f"OAuth callback error: {e}")
        return JSONResponse({"error": "OAuth failed"}, status_code=400)
    
    # Редирект на фронтенд с параметром
    return RedirectResponse("https://senya.vercel.app?logged_in=1")

@app.get("/me")
async def me(request: Request):
    return request.session.get("user") or {}

@app.get("/ping")
async def ping():
    return {"status": "alive"}

# ===== Запуск =====
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=WEB_SERVER_PORT)
