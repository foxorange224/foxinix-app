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


def find_all(xml: str, *, cls: str = "", contains: str = "", desc: str = "") -> list[dict]:
    """Todos los nodos que cumplen el filtro (en orden de aparición)."""
    out = []
    for n in nodes(xml):
        if cls and not n.get("class", "").endswith(cls):
            continue
        if contains and contains.lower() not in n.get("text", "").lower():
            continue
        if desc and not n.get("content-desc", "").startswith(desc):
            continue
        out.append(n)
    return out


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


def keyboard_shown() -> bool:
    """¿Está abierto el teclado en pantalla?"""
    out = sh("adb", "shell", "dumpsys", "input_method")
    for line in out.splitlines():
        if "mInputShown=true" in line or "mVisible=true" in line:
            return True
    return False


def hide_keyboard() -> None:
    """Cierra el teclado (si está abierto) para poder tocar los campos
    de verdad: con el teclado arriba, las coordenadas del campo de
    contraseña caen sobre el teclado y el texto acaba en el campo
    equivocado."""
    if not keyboard_shown():
        return
    subprocess.run(["adb", "shell", "input", "keyevent", "4"], timeout=30)
    time.sleep(1)


def texts(xml: str) -> list[str]:
    """Todos los textos visibles de la pantalla (para diagnosticar)."""
    out = []
    for n in nodes(xml):
        t = (n.get("text") or "").strip()
        if t:
            out.append(t)
        d = (n.get("content-desc") or "").strip()
        if d:
            out.append("[" + d + "]")
    return out


def shot(out_dir: str, name: str) -> None:
    path = os.path.join(out_dir, name + ".png")
    with open(path, "wb") as f:
        subprocess.run(["adb", "exec-out", "screencap", "-p"], stdout=f, timeout=60)
    print("captura:", path, os.path.getsize(path), "bytes")


# La app se abre en inglés por defecto (W97), así que el botón de
# entrada puede estar en cualquiera de los dos idiomas.
LOGIN_LABELS = ("Sign in", "Ingresar", "Log in", "Entrar", "Login")


def on_login_screen(xml: str) -> bool:
    """¿Seguimos en la pantalla de entrada? (el botón de entrar está)"""
    for lbl in LOGIN_LABELS:
        if find(xml, cls="Button", contains=lbl):
            return True
    return False


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

    def edit_texts() -> list[dict]:
        return [n for n in nodes(dump()) if n.get("class", "").endswith("EditText")]

    fields = edit_texts()
    print("campos encontrados:", len(fields))
    if fields:
        # --- usuario ---
        tap(fields[0])
        type_text(user)
        time.sleep(1)
        hide_keyboard()

        # --- contraseña (el teclado tapa el campo si no se cierra) ---
        fields = edit_texts()
        if len(fields) > 1:
            tap(fields[1])
            type_text(pwd)
            time.sleep(1)
        hide_keyboard()

        xml = dump()
        shot(out_dir, "1-login-relleno")
        btn = None
        for lbl in LOGIN_LABELS:
            btn = find(xml, cls="Button", contains=lbl)
            if btn:
                break
        if not btn:
            # último recurso: el primer botón con texto de la pantalla
            # (el de la web es el de ancho completo, el único con texto).
            for n in nodes(xml):
                if n.get("class", "").endswith("Button") and (n.get("text") or "").strip():
                    btn = n
                    break
        if not tap(btn):
            # si no se encuentra el botón, se manda Enter desde el campo
            subprocess.run(["adb", "shell", "input", "keyevent", "66"], timeout=30)
        else:
            print("botón de entrada:", btn.get("text"))
        time.sleep(12)
    xml = dump()
    shot(out_dir, "2-tras-login")

    # Android 13+ pide permiso para los avisos: el diálogo del sistema
    # tapa la app, así que se acepta (si aparece) para ver la pantalla.
    for lbl in ("Allow", "Permitir", "Allow all", "OK"):
        dlg = find(xml, cls="Button", text=lbl)
        if dlg:
            print("diálogo del sistema:", lbl)
            tap(dlg)
            time.sleep(3)
            xml = dump()
            shot(out_dir, "2-tras-login")
            break

    # Si el login falló, sigue el botón de entrada en pantalla: se avisa
    # en el log y se sacan los textos de la pantalla para diagnosticarlo.
    if on_login_screen(xml):
        print("!! el login no entró (sigue la pantalla de entrada)")
        print("   textos:", " | ".join(texts(xml)))

    # La barra de pestañas: se comprueba que exista, se abre la pestaña
    # de Personas (el panel con más texto) y se vuelve a los chats.
    xml = dump()
    # Se guarda el XML de la pantalla: sirve para ver dónde están las
    # cosas (alturas y posiciones) cuando una captura no se entiende.
    with open(os.path.join(out_dir, "ui-tras-login.xml"), "w", encoding="utf-8") as f:
        f.write(xml)
    tabs = find_all(xml, desc="tab:")
    for t in tabs:
        print("pestaña:", t.get("content-desc"), t.get("bounds"))
    if find(xml, desc="tab: people"):
        print("barra de pestañas: OK")
        tap(find(xml, desc="tab: people"))
        time.sleep(6)
        shot(out_dir, "3-personas")
        xml = dump()
        tap(find(xml, desc="tab: chats"))
        time.sleep(4)
    else:
        print("!! no se ve la barra de pestañas")

    # Si hay lista de chats, se abre uno para ver la conversación.
    # Las filas llevan accessibilityLabel="chat: <nombre>" (W103), así que
    # se buscan por content-desc y no por el texto de un chat en concreto.
    # Se abre el SEGUNDO: el primero suele ser un grupo recién creado (sin
    # mensajes) y el segundo tiene conversación para ver las burbujas.
    xml = dump()
    rows = find_all(xml, desc="chat:")
    row = rows[1] if len(rows) > 1 else (rows[0] if rows else None)
    if tap(row):
        time.sleep(8)
        shot(out_dir, "4-conversacion")
    else:
        print("no se encontró ninguna fila de chat para abrir")
        print("   textos:", " | ".join(texts(xml)))

    print("== logcat ==")
    # Sólo el log de la app: el resto es ruido del emulador.
    # OJO: el flag de logcat pide --pid=<pid> (con el igual); con el
    # valor separado no filtra y devuelve vacío.
    pid = sh("adb", "shell", "pidof", PKG).strip().split()[0] if sh("adb", "shell", "pidof", PKG).strip() else ""
    log = ""
    if pid:
        log = sh("adb", "logcat", "-d", "--pid=" + pid)
    if not log:
        log = sh("adb", "logcat", "-d", "-t", "2000")
    tail = "\n".join(log.splitlines()[-120:])
    print(tail)
    with open(os.path.join(out_dir, "logcat.txt"), "w", encoding="utf-8") as f:
        f.write(log)
    return 0


if __name__ == "__main__":
    sys.exit(main())
