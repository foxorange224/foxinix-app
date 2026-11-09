#!/usr/bin/env python3
"""ci-captura.py — maneja la app nativa en el emulador y saca capturas.

Se usa en el smoke de CI (.github/workflows/native-smoke.yml): instala la
APK, la abre, inicia sesión con la cuenta de pruebas (buscando los campos
con uiautomator, para no depender de coordenadas fijas) y guarda un PNG
de cada pantalla.

Uso: python3 ci-captura.py <salida> [usuario] [contraseña]
"""
from __future__ import annotations

import os
import re
import subprocess
import sys
import time

PKG = "io.foxinix.nativa"
ACT = "com.tns.NativeScriptActivity"


def sh(*args: str, **kw) -> str:
    try:
        return subprocess.run(args, capture_output=True, text=True, timeout=kw.get("timeout", 60)).stdout
    except Exception as e:  # noqa: BLE001
        print("cmd falló:", " ".join(args), e)
        return ""


def dump() -> str:
    """Devuelve el XML de la pantalla (uiautomator)."""
    out = sh("adb", "exec-out", "uiautomator", "dump", "/dev/tty")
    i = out.find("<?xml")
    j = out.rfind("</hierarchy>")
    return out[i : j + len("</hierarchy>")] if i >= 0 and j > i else ""


def bounds_center(bounds: str) -> tuple[int, int] | None:
    m = re.match(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]", bounds or "")
    if not m:
        return None
    x1, y1, x2, y2 = (int(v) for v in m.groups())
    return (x1 + x2) // 2, (y1 + y2) // 2


def nodes(xml: str) -> list[dict]:
    """Lista de nodos con sus atributos (usa regex: el XML es plano)."""
    out = []
    for m in re.finditer(r"<node\b([^>]*?)/?>", xml):
        attrs = {}
        for a in re.finditer(r"([\w-]+)=\"([^\"]*)\"", m.group(1)):
            attrs[a.group(1)] = a.group(2)
        out.append(attrs)
    return out


def find(xml: str, *, cls: str = "", text: str = "", contains: str = "",
         desc: str = "") -> dict | None:
    for n in nodes(xml):
        if cls and not n.get("class", "").endswith(cls):
            continue
        if text and n.get("text", "") != text:
            continue
        if contains and contains.lower() not in n.get("text", "").lower():
            continue
        if desc and not n.get("content-desc", "").startswith(desc):
            continue
        return n
    return None


def tap(node: dict | None) -> bool:
    if not node:
        return False
    c = bounds_center(node.get("bounds", ""))
    if not c:
        return False
    subprocess.run(["adb", "shell", "input", "tap", str(c[0]), str(c[1])], timeout=30)
    return True


def type_text(text: str) -> None:
    # `input text` no entiende algunos caracteres: se pasan escapados.
    safe = text.replace("\\", "\\\\").replace(" ", "%s").replace("!", "\\!")
    subprocess.run(["adb", "shell", "input", "text", safe], timeout=30)


def shot(out_dir: str, name: str) -> None:
    path = os.path.join(out_dir, name + ".png")
    with open(path, "wb") as f:
        subprocess.run(["adb", "exec-out", "screencap", "-p"], stdout=f, timeout=60)
    print("captura:", path, os.path.getsize(path), "bytes")


def main() -> int:
    out_dir = sys.argv[1] if len(sys.argv) > 1 else "/tmp/opencode/capturas"
    user = sys.argv[2] if len(sys.argv) > 2 else "nsprobe"
    pwd = sys.argv[3] if len(sys.argv) > 3 else "NSProbe!2026"
    os.makedirs(out_dir, exist_ok=True)

    print("== arrancando la app ==")
    subprocess.run(["adb", "shell", "am", "force-stop", PKG], timeout=30)
    subprocess.run(["adb", "shell", "am", "start", "-W", "-n", f"{PKG}/{ACT}"], timeout=90)
    time.sleep(12)

    xml = dump()
    print("== login ==")
    fields = [n for n in nodes(xml) if n.get("class", "").endswith("EditText")]
    print("campos encontrados:", len(fields))
    if fields:
        tap(fields[0])
        type_text(user)
        time.sleep(1)
        tap(fields[1])
        type_text(pwd)
        time.sleep(1)
        shot(out_dir, "1-login-relleno")
        btn = find(xml, cls="Button", contains="Ingresar") or find(xml, contains="Ingresar")
        if not tap(btn):
            # si no se encuentra el botón, se manda Enter desde el campo
            subprocess.run(["adb", "shell", "input", "keyevent", "66"], timeout=30)
        time.sleep(10)
    shot(out_dir, "2-tras-login")

    # Si hay lista de chats, se abre el primero para ver la conversación.
    # Las filas llevan accessibilityLabel="chat: <nombre>" (W103), así que
    # se buscan por content-desc y no por el texto de un chat en concreto.
    xml = dump()
    row = find(xml, desc="chat:") or find(xml, contains="nsprobe")
    if tap(row):
        time.sleep(6)
        shot(out_dir, "3-conversacion")
    else:
        print("no se encontró ninguna fila de chat para abrir")

    print("== logcat ==")
    log = sh("adb", "logcat", "-d", "-t", "300")
    tail = "\n".join(log.splitlines()[-80:])
    print(tail)
    with open(os.path.join(out_dir, "logcat.txt"), "w", encoding="utf-8") as f:
        f.write(log)
    return 0


if __name__ == "__main__":
    sys.exit(main())
