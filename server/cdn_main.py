"""CDN de media para cdn.foxinix.qzz.io (puerto 8448).

Sirve SOLO archivos firmados (/media/{kind}/{fname}?exp=&sig=).
No expone API, no sirve HTML, no tiene auth por token.
El frontend usa CDN_BASE para las URLs de media.
"""
from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import media

app = FastAPI(title="Foxinix CDN", version="0.1.0")

# CORS: el landing (foxinix.qzz.io) carga imágenes con crossorigin="anonymous"
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://foxinix.qzz.io",
        "http://localhost:8844",
        "http://127.0.0.1:8844",
    ],
    allow_credentials=False,   # las imágenes firmadas no necesitan cookies
    allow_methods=["GET"],
    allow_headers=["*"],
)

# Solo el router pub: /media/{kind}/{fname} con firma exp+sig
app.include_router(media.pub)
