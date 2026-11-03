"""Servidor de landing y SPA para foxinix.qzz.io (puerto 8844).

Sirve archivos estáticos del directorio landing/ y la SPA en
/, /login/, /register/, /app/ con fallback de History API via 404.html.
"""
from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

LANDING_DIR = Path("/home/FoxOrange/Projects/chat/landing")

app = FastAPI(title="Foxinix Landing", version="0.1.0")

# Archivos estáticos (CSS, JS, imágenes, etc.)
app.mount("/static", StaticFiles(directory=str(LANDING_DIR / "static")), name="static")

# Archivos sueltos en la raíz del landing
app.mount("/assets", StaticFiles(directory=str(LANDING_DIR / "assets")), name="assets")


def _spa_file(rel: str) -> FileResponse:
    """Devuelve el index.html de la ruta SPA correspondiente."""
    landing = LANDING_DIR
    if rel in ("", "/"):
        return FileResponse(landing / "index.html", media_type="text/html")
    if rel == "/login/":
        return FileResponse(landing / "login" / "index.html", media_type="text/html")
    if rel == "/register/":
        return FileResponse(landing / "register" / "index.html", media_type="text/html")
    if rel == "/app/":
        return FileResponse(landing / "app" / "index.html", media_type="text/html")
    # Fallback: index.html para cualquier otra ruta (SPA History API)
    return FileResponse(landing / "index.html", media_type="text/html")


@app.get("/")
async def root() -> FileResponse:
    return _spa_file("/")


@app.get("/login/")
async def login() -> FileResponse:
    return _spa_file("/login/")


@app.get("/register/")
async def register() -> FileResponse:
    return _spa_file("/register/")


@app.get("/app/")
async def app_view() -> FileResponse:
    return _spa_file("/app/")


# Catch-all para rutas profundas de la SPA (History API)
@app.get("/{full_path:path}")
async def spa_fallback(full_path: str) -> FileResponse:
    # No interceptar archivos estáticos ni rutas de API
    if full_path.startswith(("static/", "assets/", "api/")):
        from fastapi import HTTPException

        raise HTTPException(status_code=404, detail="No encontrado")
    return _spa_file("/")
