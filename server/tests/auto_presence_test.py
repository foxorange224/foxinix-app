#!/usr/bin/env python3
"""W116 — el "Ausente" automático no sobrevive al cierre de la app.

Comprueba contra un servidor real que:
  1. Un `busy` marcado con `status_auto=true` vuelve a `online` al cerrarse
     la última WebSocket (última pestaña/dispositivo).
  2. Un `busy` manual (sin `status_auto`) sigue siendo `busy` al cerrar.
  3. Con dos conexiones abiertas, sólo la última desconexión limpia el auto.

Requiere un servidor con registro abierto y poder leer el código de
verificación (mail.log local). Uso:

    FOXMSG_DATA=/tmp/foxinix-test \\
      server/.venv/bin/python server/tests/auto_presence_test.py

Variables: BASE (http://127.0.0.1:8899), WSBASE (ws://127.0.0.1:8899),
MAIL_LOG (por defecto server/data/mail.log).
"""
from __future__ import annotations

import asyncio
import json
import os
import time
import uuid
from pathlib import Path

import httpx
import websockets

BASE = os.environ.get("BASE", "http://127.0.0.1:8899").rstrip("/")
WSBASE = os.environ.get("WSBASE", BASE.replace("http://", "ws://")).rstrip("/")
ROOT = Path(__file__).resolve().parents[2]
MAIL_LOG = Path(os.environ.get("MAIL_LOG", ROOT / "server" / "data" / "mail.log"))

PASSWORD = "W116Probe!2026"
TAG = uuid.uuid4().hex[:8]
USERNAME = "w116" + TAG
EMAIL = USERNAME + "@probe.test"


def code_from_mail() -> str:
    for _ in range(100):
        if MAIL_LOG.is_file():
            lines = [ln for ln in MAIL_LOG.read_text(encoding="utf-8").splitlines() if ln.strip()]
            if lines:
                return lines[-1].rsplit(" | ", 1)[-1].strip()
        time.sleep(0.1)
    raise SystemExit(f"no apareció el código en {MAIL_LOG}")


async def get_status(c: httpx.AsyncClient, token: str) -> str:
    r = await c.get("/api/users/me", headers={"Authorization": f"Bearer {token}"})
    r.raise_for_status()
    return (r.json().get("user") or {}).get("status_preset", "")


async def set_status(
    c: httpx.AsyncClient, token: str, preset: str, auto: bool = False, text: str = ""
) -> None:
    body = {"status_preset": preset, "status_text": text}
    if auto:
        body["status_auto"] = True
    r = await c.put(
        "/api/auth/profile", json=body,
        headers={"Authorization": f"Bearer {token}"},
    )
    r.raise_for_status()
    assert r.json()["user"]["status_preset"] == preset, r.text


async def register_or_login(c: httpx.AsyncClient) -> str:
    r = await c.post("/api/auth/register", json={
        "email": EMAIL, "username": USERNAME, "password": PASSWORD,
    })
    if r.status_code == 201:
        pending = r.json()["tokens"]["access"]
        code = code_from_mail()
        v = await c.post(
            "/api/auth/verify", json={"code": code},
            headers={"Authorization": f"Bearer {pending}"},
        )
        assert v.status_code == 200, v.text
        return v.json()["tokens"]["access"]
    assert r.status_code == 409, r.text
    r = await c.post("/api/auth/login", json={
        "identifier": USERNAME, "password": PASSWORD,
    })
    assert r.status_code == 200, r.text
    return r.json()["tokens"]["access"]


async def connect(token: str):
    ws = await websockets.connect(f"{WSBASE}/ws?token={token}")
    hello = json.loads(await asyncio.wait_for(ws.recv(), 5))
    assert hello.get("type") == "connected", hello
    return ws


async def main() -> int:
    async with httpx.AsyncClient(base_url=BASE, timeout=15) as c:
        token = await register_or_login(c)

        # 1) Auto: al cerrar la única conexión debe volver a online.
        await set_status(c, token, "busy", auto=True, text="auto W116")
        ws = await connect(token)
        await ws.close()
        await asyncio.sleep(0.5)
        assert await get_status(c, token) == "online", "el auto-away no se limpió"

        # 2) Manual: debe persistir al cerrar.
        await set_status(c, token, "busy", text="manual W116")
        ws = await connect(token)
        await ws.close()
        await asyncio.sleep(0.5)
        assert await get_status(c, token) == "busy", "el Ausente manual se perdió"

        # 3) Dos conexiones: sólo la última desconexión limpia el auto.
        await set_status(c, token, "busy", auto=True, text="dos pestañas")
        ws1 = await connect(token)
        ws2 = await connect(token)
        await ws1.close()
        await asyncio.sleep(0.5)
        assert await get_status(c, token) == "busy", "se limpió con otra pestaña abierta"
        await ws2.close()
        await asyncio.sleep(0.5)
        assert await get_status(c, token) == "online", "no se limpió al cerrar la última"

        await set_status(c, token, "online")
        print("W116 OK: auto-away efímero; Ausente manual persistente")
        return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
