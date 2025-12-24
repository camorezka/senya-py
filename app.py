import asyncio
import logging
import os
import sys
import aiohttp
from aiohttp import web

# ===== ЛОГИРОВАНИЕ =====
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    stream=sys.stdout
)
logger = logging.getLogger("service")

# ===== КОНФИГУРАЦИЯ =====
WEB_SERVER_HOST = "0.0.0.0"
WEB_SERVER_PORT = int(os.getenv("PORT", 8080))
BASE_WEBHOOK_URL = os.getenv("BASE_WEBHOOK_URL")  # необязательно




import asyncio
import os
import requests

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from starlette.middleware.sessions import SessionMiddleware
from authlib.integrations.starlette_client import OAuth

# ================= НАСТРОЙКИ =================

os.environ["OAUTHLIB_INSECURE_TRANSPORT"] = "1"

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "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")
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "68632825614-tfjkfpe616jrcfjl02l0k5gd8ar25jbj.apps.googleusercontent.com")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "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")

API_URL = "https://api.groq.com/openai/v1/chat/completions"
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

# ================= APP =================

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # для Vercel
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(
    SessionMiddleware,
    secret_key="CHANGE_ME_SECRET",
    same_site="lax",
    https_only=False,
)

oauth = OAuth()
oauth.register(
    name="google",
    client_id=GOOGLE_CLIENT_ID,
    client_secret=GOOGLE_CLIENT_SECRET,
    server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
    client_kwargs={"scope": "openid email profile"},
)

user_history = {}
user_requests = {}
registered_users = {}

# ================= LOGIC =================

def ask_senya(user_id: str, text: str) -> str:
    if user_requests.get(user_id, 0) >= MAX_REQUESTS:
        return "Лимит запросов исчерпан."

    user_requests[user_id] = user_requests.get(user_id, 0) + 1

    if user_id not in user_history:
        user_history[user_id] = [{"role": "system", "content": SYSTEM_PROMPT}]

    user_history[user_id].append({"role": "user", "content": text})

    payload = {
        "model": MODEL,
        "messages": user_history[user_id],
        "temperature": 0.7
    }

    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json"
    }

    r = requests.post(API_URL, headers=headers, json=payload)
    r.raise_for_status()

    answer = r.json()["choices"][0]["message"]["content"]
    user_history[user_id].append({"role": "assistant", "content": answer})

    if len(user_history[user_id]) > MAX_HISTORY:
        user_history[user_id] = user_history[user_id][-MAX_HISTORY:]

    return answer

# ================= ROUTES =================

@app.post("/chat")
async def chat(req: Request):
    data = await req.json()
    user_id = data.get("user_id", "guest")
    text = data.get("text", "")
    answer = await asyncio.to_thread(ask_senya, user_id, text)
    return {"answer": answer}

@app.get("/auth/google")
async def google_login(request: Request):
    redirect_uri = "https://ТВОЙ_BACKEND/auth/google/callback"
    return await oauth.google.authorize_redirect(request, redirect_uri)

@app.get("/auth/google/callback")
async def google_callback(request: Request):
    token = await oauth.google.authorize_access_token(request)
    user = token["userinfo"]

    request.session["user"] = {
        "id": user["sub"],
        "name": user["name"],
        "email": user.get("email")
    }

    return RedirectResponse("https://ТВОЙ_VERCEL")

@app.get("/me")
async def me(request: Request):
    return request.session.get("user")















# ===== KEEP ALIVE =====
async def keep_alive():
    while True:
        try:
            url = f"{BASE_WEBHOOK_URL}/ping" if BASE_WEBHOOK_URL else "http://localhost/ping"
            async with aiohttp.ClientSession() as session:
                async with session.get(url) as resp:
                    logger.info(f"🔁 Keep-alive ping: {resp.status}")
        except Exception as e:
            logger.error(f"🚨 Keep-alive error: {e}")
        await asyncio.sleep(300)

# ===== HANDLERS =====
async def ping_handler(request):
    return web.Response(text="✅ Service is alive")

async def health_handler(request):
    return web.json_response({
        "status": "ok",
        "service": "simple-backend"
    })

# ===== START / STOP =====
async def on_startup(app):
    logger.info("🚀 Service started")
    asyncio.create_task(keep_alive())

async def on_shutdown(app):
    logger.info("🛑 Service stopped")

# ===== APP =====











def create_app():
    app = web.Application()
    app.router.add_get("/ping", ping_handler)
    app.router.add_get("/health", health_handler)
    app.on_startup.append(on_startup)
    app.on_shutdown.append(on_shutdown)
    return app

# ===== MAIN =====
if __name__ == "__main__":
    try:
        app = create_app()
        web.run_app(app, host=WEB_SERVER_HOST, port=WEB_SERVER_PORT)
    except Exception as e:
        logger.critical(f"💥 Critical error: {e}")
        sys.exit(1)
