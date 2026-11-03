"""Servidor de landing y SPA para foxinix.qzz.io (puerto 8844).

Sirve archivos estáticos del directorio landing/ y la SPA en
/, /login/, /register/, /app/ con fallback de History API.
"""
from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles

LANDING_DIR = Path("/home/FoxOrange/Projects/chat/landing")

app = FastAPI(title="Foxinix Landing", version="0.1.0")


@app.middleware("http")
async def no_cache_html(request: Request, call_next: Response) -> Response:
    """HTML siempre fresco (no-cache + revalidación). CSS/JS/imagen
    siguen con su cache normal del CDN."""
    response = await call_next(request)
    ct = response.headers.get("content-type", "")
    if "text/html" in ct:
        response.headers["cache-control"] = "no-cache, must-revalidate"
    return response

# Archivos estáticos (CSS, JS, imágenes, etc.)
app.mount("/static", StaticFiles(directory=str(LANDING_DIR / "static")), name="static")
app.mount("/assets", StaticFiles(directory=str(LANDING_DIR / "assets")), name="assets")

# Archivos raíz que NO son SPA (se sirven tal cual)
_ROOT_FILES = {
    "styles.css", "app.js", "sw.js", "manifest.webmanifest",
    "robots.txt", "sitemap.xml", "404.html",
    "privacidad.html", "terminos.html",
    "icon.svg", "icon.webp", "icon-192.png", "icon-512.png",
    "apple-touch-icon.png", "favicon.ico", "CNAME",
}

# Rutas SPA con su index.html físico (clave sin barra final)
_SPA_ROUTES = {
    "login": "login/index.html",
    "register": "register/index.html",
    "app": "app/index.html",
}


def _serve_file(rel: str) -> FileResponse | None:
    """Si el archivo existe en LANDING_DIR, lo sirve. Si no, None."""
    # Prevenir path traversal
    target = (LANDING_DIR / rel).resolve()
    if not str(target).startswith(str(LANDING_DIR.resolve())):
        return None
    if target.is_file():
        return FileResponse(target)
    return None


@app.get("/")
async def root() -> FileResponse:
    return FileResponse(LANDING_DIR / "index.html", media_type="text/html")


@app.get("/{full_path:path}")
async def serve(full_path: str) -> FileResponse:
    # 1) Buscar archivo real en disco (styles.css, app.js, privacidad.html, etc.)
    f = _serve_file(full_path)
    if f:
        return f

    # 2) Ruta SPA conocida, con o sin barra final (/login y /login/)
    key = full_path.strip("/")
    if key in _SPA_ROUTES:
        return FileResponse(LANDING_DIR / _SPA_ROUTES[key], media_type="text/html")

    # 3) Fallback: index.html (SPA History API)
    return FileResponse(LANDING_DIR / "index.html", media_type="text/html")
