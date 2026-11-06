"""Servidor de landing y SPA para foxinix.qzz.io (puerto 8844).

Sirve archivos estáticos del directorio landing/ y la SPA en
/, /login/, /register/, /app/ con fallback de History API.
"""
from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, RedirectResponse, Response
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

# W87: los tonos de sonido (/tonos/…) también se sirven en foxinix.qzz.io.
# La SPA vive en este dominio y toneSrc() usa rutas absolutas same-origin;
# sin este mount, el fallback de la SPA devolvía el index.html y el
# <audio> de Ajustes → Notificaciones fallaba con HTML en vez de MP3.
TONES_DIR = Path("/home/FoxOrange/Projects/chat/server/web/tonos")
app.mount("/tonos", StaticFiles(directory=str(TONES_DIR)), name="tones")

# Archivos raíz que NO son SPA (se sirven tal cual)
_ROOT_FILES = {
    "styles.css", "app.js", "sw.js", "manifest.webmanifest",
    "robots.txt", "sitemap.xml", "404.html",
    "icon.svg", "icon.webp", "icon-192.png", "icon-512.png",
    "apple-touch-icon.png", "favicon.ico", "CNAME",
}

# Rutas SPA con su HTML físico (clave sin barra final). W91: la portada
# se reestructuró (Foxinix-main) → app.html / login.html / register.html.
_SPA_ROUTES = {
    "login": "login.html",
    "register": "register.html",
    "app": "app.html",
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


# W86: páginas legales con URL limpia (sin .html). Los viejos caminos
# (.html y sin extensión) responden 301 para conservar lo indexado.
_LEGACY_LEGAL = {
    "privacy.html": "/privacy",    # nombre nuevo del archivo → URL limpia
    "terms.html": "/terms",
    "privacidad.html": "/privacy",  # nombres viejos → siguen con 301
    "terminos.html": "/terms",
    "privacidad": "/privacy",
    "terminos": "/terms",
}


@app.get("/privacy")
@app.get("/privacy/")
async def legal_privacidad() -> FileResponse:
    return FileResponse(LANDING_DIR / "privacy.html", media_type="text/html")


@app.get("/terms")
@app.get("/terms/")
async def legal_terminos() -> FileResponse:
    return FileResponse(LANDING_DIR / "terms.html", media_type="text/html")


@app.get("/{full_path:path}", response_model=None)
async def serve(full_path: str):
    # 0) Legales con URL vieja → URL limpia (301)
    legacy = _LEGACY_LEGAL.get(full_path.strip("/"))
    if legacy:
        return RedirectResponse(url=legacy, status_code=301)

    # 1) Buscar archivo real en disco (styles.css, app.js, etc.)
    f = _serve_file(full_path)
    if f:
        return f

    # 2) Ruta SPA conocida, con o sin barra final y con subrutas:
    #    /app, /app/, /app/group/123 → app.html (nunca el index de landing)
    key = full_path.strip("/")
    head = key.split("/", 1)[0] if key else ""
    if head in _SPA_ROUTES:
        return FileResponse(LANDING_DIR / _SPA_ROUTES[head], media_type="text/html")

    # 3) Fallback: index.html (SPA History API)
    return FileResponse(LANDING_DIR / "index.html", media_type="text/html")
