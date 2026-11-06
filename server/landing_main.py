"""Servidor de landing y SPA para foxinix.qzz.io (puerto 8844).

Sirve archivos estáticos del directorio landing/ y la SPA en
/, /login/, /register/, /app/ con fallback de History API.
"""
from __future__ import annotations

import hashlib
import re
import time
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, RedirectResponse, Response
from fastapi.staticfiles import StaticFiles

LANDING_DIR = Path("/home/FoxOrange/Projects/chat/landing")

app = FastAPI(title="Foxinix Landing", version="0.1.0")


# ------------------------------------------- cache-busting (W79 port)
# W79 portado al landing: cada módulo JS se sirve con sus imports
# relativos reescritos a `?v=<BUILD_ID>` (hash de TODOS los assets del
# front) y el HTML lleva `?v=<BUILD_ID>` en cada referencia. Así, al
# desplegar CUALQUIER archivo cambian TODAS las URLs y ni Cloudflare ni
# el navegador pueden servir un bundle viejo. Sin esto, CF guardaba
# /static/js/main.js con HIT age>700 pese al max-age=1 del origen y el
# usuario corría JS de despliegues anteriores hasta que había purge.
#
# Diferencia con server/app/main.py (API): allí BUILD_ID se calcula al
# arrancar (cada deploy reinicia el servicio). El landing lee el repo
# en vivo y un deploy de JS NO lo reinicia, así que el build se
# revalida aquí por (mtime, tamaño) en cada petición: un deploy nuevo
# cambia las URLs al instante, sin reinicio y sin purge manual.
_BUILD_ID = "0"
_JS_CACHE: dict[str, tuple[float, int, str, bytes, str]] = {}
_HASH_CACHE: dict[str, tuple[float, int, str]] = {}

# from './x.js' | import './x.js' | import('./x.js') | export ... from './x.js'
_IMPORT_RE = re.compile(
    r"(?P<head>(?:\bfrom|\bimport)\s*\(?\s*)"
    r"(?P<q>['\"])(?P<spec>\.{1,2}/[^'\"\n]+?\.js)(?P<old>\?[^'\"\n]*)?(?P=q)"
)

# Referencias versionables en el HTML: /static/... (como en la API) más
# los archivos de la portada que viven en la raíz y /assets/... (og,
# logos, favicons), todos cacheados por CF igual que el JS.
_STATIC_REF_RE = re.compile(
    r"(/static/[A-Za-z0-9._/-]+?|/theme\.js|/styles\.css|/app\.js"
    r"|/assets/[A-Za-z0-9._/-]+?)(\?[^\"'\s)]*)?(?=['\"\s\)>])"
)


def _rewrite_imports(text: str, build_id: str) -> str:
    """Agrega `?v=<build_id>` a cada import relativo de un módulo JS."""

    def repl(m: re.Match) -> str:
        q = m.group("q")
        return f"{m.group('head')}{q}{m.group('spec')}?v={build_id}{q}"

    return _IMPORT_RE.sub(repl, text)


def _asset_files() -> list[str]:
    """Todos los assets versionables del landing, ordenados (rel a LANDING_DIR)."""
    out: list[str] = []
    for root in ("static", "assets"):
        d = LANDING_DIR / root
        if not d.is_dir():
            continue
        for p in sorted(d.rglob("*")):
            if p.is_file() and p.suffix in (".js", ".css", ".svg", ".png", ".ico", ".gif"):
                out.append(str(p.relative_to(LANDING_DIR)).replace("\\", "/"))
    for name in ("theme.js", "styles.css", "app.js", "sw.js"):
        if (LANDING_DIR / name).is_file():
            out.append(name)
    return out


def _current_build_id() -> str:
    """BUILD_ID al vuelo: hashea assets con caché por (mtime, tamaño).

    Solo relee los archivos que cambiaron desde la última petición, así
    que se puede calcular en cada request sin costo apreciable.
    """
    h = hashlib.sha256()
    for rel in _asset_files():
        p = LANDING_DIR / rel
        try:
            st = p.stat()
        except OSError:
            continue
        cached = _HASH_CACHE.get(rel)
        if cached is None or cached[0] != st.st_mtime or cached[1] != st.st_size:
            fh = hashlib.sha256(p.read_bytes()).hexdigest()[:12]
            _HASH_CACHE[rel] = (st.st_mtime, st.st_size, fh)
        else:
            fh = cached[2]
        h.update(rel.encode("utf-8"))
        h.update(fh.encode("utf-8"))
    return h.hexdigest()[:12]


@app.middleware("http")
async def hashed_js_modules(request: Request, call_next):
    """Sirve /static/**/*.js con los imports reescritos al build actual.

    El ETag es el del cuerpo YA reescrito: si cambia el BUILD_ID (aunque
    el archivo no cambie) el ETag cambia y el navegador no se queda con
    un 304 que apunta a imports viejos. Cache-Control no-cache: con la
    URL ya versionada por ?v= el304 barato revalida y CF no sirve copia
    vieja.
    """
    global _BUILD_ID
    path = request.url.path
    if path.startswith("/static/") and path.endswith(".js"):
        rel = path[len("/static/"):]
        try:
            p = (LANDING_DIR / "static" / rel).resolve()
            p.relative_to((LANDING_DIR / "static").resolve())
        except (ValueError, OSError):
            p = None
        if p is not None and p.is_file():
            _BUILD_ID = _current_build_id()
            try:
                st = p.stat()
                cached = _JS_CACHE.get(str(p))
                if (cached is None or cached[0] != st.st_mtime
                        or cached[1] != st.st_size or cached[2] != _BUILD_ID):
                    raw = p.read_bytes()
                    body = _rewrite_imports(
                        raw.decode("utf-8", "replace"), _BUILD_ID
                    ).encode("utf-8")
                    etag = '"' + hashlib.sha256(body).hexdigest()[:32] + '"'
                    _JS_CACHE[str(p)] = (st.st_mtime, st.st_size, _BUILD_ID, body, etag)
                else:
                    body, etag = cached[3], cached[4]
            except OSError:
                body, etag, st = b"", '"0"', None
            if st is not None:
                inm = request.headers.get("if-none-match", "")
                if etag in [x.strip() for x in inm.split(",") if x.strip()]:
                    return Response(
                        status_code=304,
                        headers={"ETag": etag, "Cache-Control": "no-cache"},
                    )
                return Response(
                    content=body,
                    media_type="text/javascript; charset=utf-8",
                    headers={
                        "ETag": etag,
                        "Cache-Control": "no-cache",
                        "Last-Modified": time.strftime(
                            "%a, %d %b %Y %H:%M:%S GMT", time.gmtime(st.st_mtime)
                        ),
                    },
                )
    return await call_next(request)


@app.middleware("http")
async def no_cache_html(request: Request, call_next) -> Response:
    """HTML siempre fresco (no-cache + revalidación). CSS/JS/imagen
    siguen con su cache normal del CDN. W92: además, headers básicos
    de endurecimiento en TODA respuesta (nosniff, clickjacking,
    referrer y features que la app no usa).

    W96: además versiona las referencias del HTML con `?v=<BUILD_ID>`
    (port de W79). El FileResponse trae etag/last-modified DEL ARCHIVO:
    al reescribir el cuerpo hay que descartarlos (el cuerpo ya no es el
    del archivo) y recalcular content-length; si no, un 304 del archivo
    viejo serviría HTML con referencias viejas.
    """
    # W96 (transición): el navegador puede tener HTML cacheado con el
    # etag DEL ARCHIVO. Si el archivo no cambió, FileResponse devuelve
    # 304 y el usuario se quedaría con referencias sin ?v= (y con el JS
    # viejo del borde de CF). Sin validadores en la petición, el HTML
    # siempre viaja completo y ya versionado. Solo los mounts estáticos
    # (/static, /assets, /tonos, /media) conservan sus 304.
    path = request.url.path
    if not path.startswith(("/static", "/assets", "/tonos", "/media")):
        hs = request.scope.get("headers") or []
        keep = [(k, v) for k, v in hs
                if k.lower() not in (b"if-none-match", b"if-modified-since")]
        if len(keep) != len(hs):
            request.scope["headers"] = keep
    response = await call_next(request)
    ct = response.headers.get("content-type", "")
    if "text/html" in ct:
        response.headers["cache-control"] = "no-cache, must-revalidate"
    # W92: endurecimiento en TODA respuesta. Van ANTES de la reescritura
    # del HTML (W96) porque esa rama devuelve una Response NUEVA copiando
    # estos headers: si quedaran después, el HTML versionado se perdería.
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "SAMEORIGIN")
    response.headers.setdefault(
        "Referrer-Policy", "strict-origin-when-cross-origin")
    response.headers.setdefault(
        "Permissions-Policy", "geolocation=(), payment=(), usb=()")
    if "text/html" in ct:
        if (request.method == "GET" and response.status_code == 200
                and hasattr(response, "body_iterator")):
            # Leer el FileResponse entero y reescribirlo como Response
            # propio: el iterator no se puede re-leer y el content-length
            # viejo ya no corresponde.
            body = b""
            async for chunk in response.body_iterator:
                body += chunk
            build_id = _current_build_id()
            html = _STATIC_REF_RE.sub(
                lambda m: f"{m.group(1)}?v={build_id}",
                body.decode("utf-8", "replace"),
            )
            headers = {
                k: v for k, v in response.headers.items()
                if k.lower() not in ("content-length", "etag", "last-modified",
                                     "accept-ranges", "content-disposition")
            }
            return Response(
                content=html,
                status_code=response.status_code,
                headers=headers,
                media_type="text/html; charset=utf-8",
            )
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
