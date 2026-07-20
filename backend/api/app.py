from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
from api.routes import documents, chat, auth

app = FastAPI(
    title="DocFlow API",
    description="Корпоративный ИИ-поиск по документам",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

static_dir = Path(__file__).parent.parent / "static"
app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")

app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(documents.router, prefix="/documents", tags=["documents"])
app.include_router(chat.router, prefix="/chat", tags=["chat"])


@app.get("/", response_class=HTMLResponse)
def root():
    html = (static_dir / "index.html").read_text(encoding="utf-8")
    return HTMLResponse(html)


@app.get("/health")
def health():
    return {"status": "healthy"}
