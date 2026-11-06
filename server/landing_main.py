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
    siguen con su cache normal del CDN. W92: además, headers básicos
    de endurecimiento en TODA respuesta (nosniff, clickjacking,
    referrer y features que la app no usa)."""
    response = await call_next(request)
    ct = response.headers.get("content-type", "")
    if "text/html" in ct:
        response.headers["cache-control"] = "no-cache, must-revalidate"
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "SAMEORIGIN")
    response.headers.setdefault(
        "Referrer-Policy", "strict-origin-when-cross-origin")
    response.headers.setdefault(
        "Permissions-Policy", "geolocation=(), payment=(), usb=()")
    return response

# W92: sets de emoji self-hosted. Viven en server/web/ (compartidos con
# el dominio API) y DEBEN montarse antes que /static, si no el montaje
# general se come la ruta y da 404 → el estilo 'twemoji'/'noto' no
# cargaba en foxinix.qzz.io y el SW reintentaba el manifest en vano.
EMOJI_DIR = Path("/home/FoxOrange/Projects/chat/server/web/emoji")
EMOJI_NOTO_DIR = Path("/home/FoxOrange/Projects/chat/server/web/emoji-noto")
app.mount("/static/emoji-noto", StaticFiles(directory=str(EMOJI_NOTO_DIR)),
          name="emoji-noto")
app.mount("/static/emoji", StaticFiles(directory=str(EMOJI_DIR)),
          name="emoji")


@app.get("/static/emoji-manifest.json")
async def emoji_manifest() -> FileResponse:
    return FileResponse(
        Path("/home/FoxOrange/Projects/chat/server/web/emoji-manifest.json"))


# Archivos estáticos (CSS, JS, imágenes, etc.)
app.mount("/static", StaticFiles(directory=str(LANDING_DIR / "static")), name="static")
app.mount("/assets", StaticFiles(directory=str(LANDING_DIR / "assets")), name="assets")

# W87: los tonos de sonido (/tonos/…) también se sirven en foxinix.qzz.io.
# La SPA vive en este dominio y toneSrc() usa rutas absolutas same-origin;
# sin este mount, el fallback de la SPA devolvía el index.html y el
# <audio> de Ajustes → Notificaciones fallaba con HTML en vez de MP3.
TONES_DIR = Path("/home/FoxOrange/Projects/chat/server/web/tonos")
app.mount("/tonos", StaticFiles(directory=str(TONES_DIR)), name="tones")

# Rutas SPA con su HTML físico (clave sin barra final). W91: la portada
# se reestructuró (Foxinix-main) → app.html / login.html / register.html.
# W92: profile/verify/forgot/reset existen en el router de la SPA
# (ROUTE_PATHS) y sin entrada aquí el fallback devolvía la PORTADA:
# los enlaces de email (/reset?token=…, /verify?…) aterrizaban mal.
# El shell es idéntico en todos, así que todos apuntan a app.html.
_SPA_ROUTES = {
    "login": "login.html",
    "register": "register.html",
    "app": "app.html",
    "profile": "app.html",
    "verify": "app.html",
    "forgot": "app.html",
    "reset": "app.html",
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

    # 3) Ruta desconocida → 404 real. Antes devolvía index.html con 200
    #    (mal SEO: cualquier basura indexaba como portada). Las rutas
    #    de la SPA están todas cubiertas arriba, así que el fallback
    #    solo lo necesitaban bots y enlaces rotos.
    return FileResponse(LANDING_DIR / "404.html", status_code=404,
                        media_type="text/html")
