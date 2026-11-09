#!/usr/bin/env python3
"""ci-captura.py — maneja la app nativa en el emulador y saca capturas.

Se usa en el smoke de CI (.github/workflows/native-smoke.yml): instala la
APK, la abre, inicia sesión con la cuenta de pruebas (buscando los campos
con uiautomator, para no depender de coordenadas fijas) y guarda un PNG
de cada pantalla.

Uso: python3 ci-captura.py <salida> [usuario] [contraseña]
"""
from __future__ import annotations

import binascii
import json
import os
import re
import struct
import subprocess
import sys
import time
import urllib.error
import urllib.request
import zlib

PKG = "io.foxinix.nativa"
ACT = "com.tns.NativeScriptActivity"

# ---------------------------------------------------------------- API
# El script habla con la API real (la misma que usa la app) para dejar
# una imagen REAL en la cuenta de pruebas: las imágenes que había
# medían 1x1 px (invisibles en la burbuja), así que el visor no se
# abría nunca. Sólo escribe cuando de verdad no hay ninguna grande.
API_BASE = "https://api.foxinix.qzz.io"
# OJO: el proxy bloquea el User-Agent por defecto de Python-urllib
# (403): hay que mandar uno de navegador.
UA = "Mozilla/5.0 (X11; Linux x86_64) FoxinixSmoke/1.0"
# Una imagen cuenta como "real" si el server la mide por encima de esto
# (las de prueba medían 1x1).
IMG_MIN_PX = 100


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


def bounds_box(bounds: str) -> tuple[int, int, int, int] | None:
    """(x1, y1, x2, y2) de un atributo bounds="[…] […]". """
    m = re.match(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]", bounds or "")
    if not m:
        return None
    x1, y1, x2, y2 = (int(v) for v in m.groups())
    return (x1, y1, x2, y2)


def bounds_center(bounds: str) -> tuple[int, int] | None:
    box = bounds_box(bounds)
    if not box:
        return None
    x1, y1, x2, y2 = box
    return (x1 + x2) // 2, (y1 + y2) // 2


def screen_size() -> tuple[int, int]:
    """Tamaño de la pantalla del emulador (para swipe relativo)."""
    out = sh("adb", "shell", "wm", "size")
    m = re.search(r"(\d+)x(\d+)", out)
    return (int(m.group(1)), int(m.group(2))) if m else (320, 640)


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


def scroll_down() -> None:
    """Baja el contenido de la pantalla (el dedo sube): en pantallas
    chicas el final de la vista (los enlaces) queda fuera de cuadro."""
    w, h = screen_size()
    subprocess.run(
        ["adb", "shell", "input", "swipe",
         str(w // 2), str(int(h * 0.75)), str(w // 2), str(int(h * 0.3))],
        timeout=30,
    )
    time.sleep(1.5)


def go_back() -> None:
    """Botón atrás de Android: la app lo maneja y cierra la vista."""
    subprocess.run(["adb", "shell", "input", "keyevent", "4"], timeout=30)
    time.sleep(4)


def back_out(xml: str) -> None:
    """Vuelve atrás: primero el botón etiquetado (que es el que ve el
    usuario), y si no está, el botón del sistema. El visor de imagen
    usa 'close' (la X) en vez de 'back'."""
    for label in ("back", "close"):
        n = find(xml, desc=label)
        if n:
            tap(n)
            time.sleep(4)
            return
    go_back()


def find_at(xml: str) -> dict | None:
    """Primer nodo cuyo texto empieza con '@' (la fila de resultado del
    buscador de Personas muestra @usuario debajo del nombre)."""
    for n in nodes(xml):
        if (n.get("text") or "").startswith("@"):
            return n
    return None


def find_chat_row(xml: str, title: str) -> dict | None:
    """La fila del chat con ESE título exacto.

    Las filas llevan accessibilityLabel="chat: <título>". La coincidencia
    es exacta (no startswith) porque dos chats pueden compartir prefijo
    ("Prueba nativa 123" y "Prueba nativa 1234").
    """
    if not title:
        return None
    want = "chat: " + title
    for n in nodes(xml):
        if n.get("content-desc") == want:
            return n
    return None


def is_profile(xml: str) -> bool:
    """¿Estamos en la ficha de usuario? (título Perfil/Profile)"""
    return bool(find(xml, cls="TextView", text="Profile")
                or find(xml, cls="TextView", text="Perfil"))


def shot(out_dir: str, name: str) -> str:
    path = os.path.join(out_dir, name + ".png")
    with open(path, "wb") as f:
        subprocess.run(["adb", "exec-out", "screencap", "-p"], stdout=f, timeout=60)
    print("captura:", path, os.path.getsize(path), "bytes")
    # El XML de la pantalla va al lado de la captura: sirve para mirar
    # posiciones y alturas cuando un PNG no se entiende (lo sube el CI).
    xml = dump()
    with open(os.path.join(out_dir, name + ".xml"), "w", encoding="utf-8") as f:
        f.write(xml)
    return xml


# La app se abre en inglés por defecto (W97), así que el botón de
# entrada puede estar en cualquiera de los dos idiomas.
LOGIN_LABELS = ("Sign in", "Ingresar", "Log in", "Entrar", "Login")


def on_login_screen(xml: str) -> bool:
    """¿Seguimos en la pantalla de entrada? (el botón de entrar está)"""
    for lbl in LOGIN_LABELS:
        if find(xml, cls="Button", contains=lbl):
            return True
    return False


def visit_register(out_dir: str) -> None:
    """Abre el registro desde el login, saca la captura y vuelve.

    En pantallas chicas el enlace de vuelta queda abajo del todo: si no
    aparece se baja el scroll. Y si aun así falla, se reinicia la app
    para no dejar el barrido sin pantalla de entrada (el botón atrás de
    Android en el registro no vuelve al login: sale de la app).
    """
    print("== registro ==")
    xml = dump()
    link = (find(xml, cls="TextView", text="Create account")
            or find(xml, cls="TextView", text="Crear cuenta"))
    if not tap(link):
        print("!! no se encontró 'Create account' en el login")
        return
    time.sleep(6)
    shot(out_dir, "5-registro")
    for _ in range(3):
        xml = dump()
        back = (find(xml, cls="TextView", text="I already have an account")
                or find(xml, cls="TextView", text="Ya tengo cuenta"))
        if tap(back):
            time.sleep(5)
            if on_login_screen(dump()):
                print("volví al login")
                return
            break
        scroll_down()
    print("!! no se volvió al login desde el registro; se reinicia la app")
    subprocess.run(["adb", "shell", "am", "force-stop", PKG], timeout=30)
    subprocess.run(["adb", "shell", "am", "start", "-W", "-n", f"{PKG}/{ACT}"], timeout=90)
    time.sleep(12)


def open_profile() -> bool:
    """Personas → busca por prefijo y abre el primer resultado (Perfil).

    El server busca con LIKE 'q%' sobre username o display_name
    (mínimo 2 chars, sin contar la propia cuenta): con "ns" aparece
    nsprobe2, la cuenta de pruebas (verificado contra la API).
    """
    print("== perfil ==")
    xml = dump()
    field = find(xml, cls="EditText")
    if not tap(field):
        print("!! no está el buscador de Personas")
        return False
    time.sleep(1)
    type_text("ns")
    time.sleep(5)  # la búsqueda va al server
    # El teclado tapa los resultados en pantallas chicas: se cierra
    # (el texto queda y la lista se ve entera).
    hide_keyboard()
    xml = dump()
    row = find_at(xml)
    if not row:
        print("!! la búsqueda no devolvió resultados")
        print("   textos:", " | ".join(texts(xml)))
        return False
    tap(row)
    time.sleep(6)
    xml = dump()
    if is_profile(xml):
        return True
    # El toque en la etiqueta no abrió la fila: se prueba con el nombre.
    if tap(find(xml, text="nsprobe2")):
        time.sleep(6)
        if is_profile(dump()):
            return True
    print("!! no se pudo abrir el Perfil")
    print("   textos:", " | ".join(texts(xml)))
    return False


def open_media() -> bool:
    """Toca la imagen de la burbuja para abrirla a pantalla completa.

    Se elige la imagen más grande que no esté en la cabecera (56px) ni
    en el compositor: los avatares de mensaje son de 28px y las
    miniaturas de las burbujas, bastante más grandes.
    """
    print("== visor ==")
    xml = dump()
    _w, h = screen_size()
    best, best_area = None, 0
    for n in nodes(xml):
        if not n.get("class", "").endswith("ImageView"):
            continue
        box = bounds_box(n.get("bounds", ""))
        if not box:
            continue
        x1, y1, x2, y2 = box
        if y1 < 56 or y2 > h - 70:
            continue
        area = (x2 - x1) * (y2 - y1)
        if area > best_area:
            best, best_area = n, area
    if not best or best_area < 2500:
        print("!! no se vio ninguna imagen en la conversación")
        print("   textos:", " | ".join(texts(xml)))
        return False
    print("imagen de la burbuja:", best.get("bounds"), best_area, "px²")
    tap(best)
    time.sleep(7)  # la imagen original viene del CDN
    return True


# ---------------------------------------------------------------- API
# Auto-reparación del paso del visor: las imágenes de prueba que había
# en la cuenta medían 1x1 px (el server guarda las dimensiones reales),
# así que la burbuja quedaba invisible y el visor no se abría nunca.
# Antes de barrer, el script comprueba por API si hay alguna imagen de
# verdad (>100 px) en algún chat; si no, sube un PNG real y lo manda al
# chat que va a abrir. Sólo escribe cuando de verdad falta.

def api(method: str, path: str, token: str = "", body: bytes | None = None,
        headers: dict | None = None, timeout: int = 60) -> tuple[int, bytes]:
    """Petición HTTP a la API. Devuelve (código, cuerpo)."""
    url = API_BASE + path
    h = {"User-Agent": UA, "Accept": "application/json"}
    if token:
        h["Authorization"] = "Bearer " + token
    if headers:
        h.update(headers)
    req = urllib.request.Request(url, data=body, headers=h, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, r.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read()
    except Exception as e:  # noqa: BLE001
        print("api falló:", method, path, e)
        return 0, b""


def api_json(method: str, path: str, token: str = "", payload: dict | None = None):
    """Petición JSON a la API. Devuelve (código, objeto o None).

    Cualquier 2xx es éxito (el alta de mensajes/media devuelve 201).
    """
    body = None
    headers = {}
    if payload is not None:
        body = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"
    st, raw = api(method, path, token=token, body=body, headers=headers)
    if not (200 <= st < 300):
        print("api", method, path, "->", st, raw[:200])
        return st, None
    try:
        return st, json.loads(raw.decode("utf-8"))
    except Exception as e:  # noqa: BLE001
        print("respuesta no JSON:", method, path, e)
        return st, None


def api_login(user: str, pwd: str) -> str:
    """Devuelve el access token de la cuenta de pruebas (o '')."""
    st, out = api_json("POST", "/auth/login", payload={"identifier": user, "password": pwd})
    if not (200 <= st < 300) or not out:
        print("!! no se pudo iniciar sesión por API:", st)
        return ""
    return (out.get("tokens") or {}).get("access") or ""


def chat_ui_title(c: dict) -> str:
    """El título tal como lo muestra la app (ChatListView.titleOf).

    La fila lleva accessibilityLabel="chat: <título>", así que el
    script tiene que calcular EXACTAMENTE el mismo texto para abrirla
    por su etiqueta en vez de por posición (la posición cambia cuando
    se manda un mensaje nuevo).
    """
    t = c.get("title") or {}
    if c.get("type") == "group":
        return t.get("display_name") or t.get("name") or ""
    return t.get("display_name") or t.get("username") or ""


def chat_has_real_image(token: str, chat_id: int) -> bool:
    """¿Tiene este chat algún mensaje de imagen con tamaño real?"""
    st, out = api_json("GET", f"/chats/{chat_id}/messages?limit=50", token=token)
    if st != 200 or not out:
        return False
    for m in out.get("messages") or []:
        if m.get("kind") != "image":
            continue
        md = m.get("media") or {}
        w, h = int(md.get("width") or 0), int(md.get("height") or 0)
        if w > IMG_MIN_PX and h > IMG_MIN_PX:
            return True
    return False


def find_chat_with_image(token: str) -> tuple[int, str]:
    """(id, título) de un chat que ya tiene una imagen real.

    Sólo mira los primeros chats de la lista: son los que se ven en la
    pantalla sin desplazar, así que el barrido puede abrir ese chat.
    Si ninguno tiene una imagen grande, devuelve (0, '').
    """
    st, out = api_json("GET", "/chats", token=token)
    if st != 200 or not out:
        return 0, ""
    chats = out.get("chats") or []
    for c in chats[:8]:
        cid = c.get("id")
        if not cid:
            continue
        # El last_message con media ya trae las dimensiones: si es una
        # imagen real, el chat sirve sin pedir el historial entero.
        lm = c.get("last_message") or {}
        md = lm.get("media") or {}
        if (lm.get("kind") == "image" and int(md.get("width") or 0) > IMG_MIN_PX
                and int(md.get("height") or 0) > IMG_MIN_PX):
            return int(cid), chat_ui_title(c)
        if chat_has_real_image(token, int(cid)):
            return int(cid), chat_ui_title(c)
    return 0, ""


def png_bytes(width: int = 320, height: int = 200) -> bytes:
    """Un PNG naranja (zorro) generado en memoria, sin dependencias.

    Se arma a mano (zlib + struct) para no depender de Pillow en el
    runner: el server lo recodifica a WebP y guarda las dimensiones
    reales, que es lo que hace visible la burbuja.
    """
    # Lienzo RGB con el zorro de la marca.
    px = bytearray()
    for y in range(height):
        for x in range(width):
            # fondo transparente-ish oscuro (RGB) y cabeza naranja
            r, g, b = 0x1E, 0x1F, 0x22
            cx, cy = width * 0.5, height * 0.55
            dx, dy = (x - cx) / (width * 0.30), (y - cy) / (height * 0.34)
            if dx * dx + dy * dy <= 1.0:
                r, g, b = 0xFF, 0x75, 0x1F
                # orejas
                if (abs(x - cx) > width * 0.16 and y < cy - height * 0.05):
                    r, g, b = 0xFF, 0x8A, 0x3D
                # hocico
                if dy > 0.25 and abs(dx) < 0.35:
                    r, g, b = 0xF2, 0x3F, 0x43
                # ojos
                if abs(dx) > 0.22 and abs(dx) < 0.45 and abs(dy) < 0.18:
                    r, g, b = 0x1E, 0x1F, 0x22
            px += bytes((r, g, b))

    raw = bytearray()
    stride = width * 3
    for y in range(height):
        raw.append(0)  # filtro "none"
        raw += px[y * stride:(y + 1) * stride]

    def chunk(tag: bytes, data: bytes) -> bytes:
        return (struct.pack(">I", len(data)) + tag + data
                + struct.pack(">I", binascii.crc32(tag + data) & 0xFFFFFFFF))

    ihdr = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr)
            + chunk(b"IDAT", zlib.compress(bytes(raw), 9))
            + chunk(b"IEND", b""))


def upload_png(token: str, data: bytes, filename: str = "visor.png") -> int:
    """Sube el PNG al server (multipart, campo 'file'). Devuelve el id."""
    boundary = "----FoxinixSmoke" + os.urandom(8).hex()
    body = b"".join([
        ("--%s\r\n" % boundary).encode(),
        ('Content-Disposition: form-data; name="file"; filename="%s"\r\n' % filename).encode(),
        b"Content-Type: image/png\r\n\r\n",
        data,
        ("\r\n--%s--\r\n" % boundary).encode(),
    ])
    st, raw = api("POST", "/media", token=token, body=body, headers={
        "Content-Type": "multipart/form-data; boundary=" + boundary,
    })
    if not (200 <= st < 300):
        print("!! la subida falló:", st, raw[:200])
        return 0
    try:
        out = json.loads(raw.decode("utf-8"))
    except Exception:  # noqa: BLE001
        print("!! respuesta de subida no JSON")
        return 0
    print("subida:", out.get("name"), out.get("width"), "x", out.get("height"),
          out.get("size"), "bytes")
    return int(out.get("id") or 0)


def send_image_message(token: str, chat_id: int, media_id: int) -> bool:
    """Manda el mensaje de imagen al chat."""
    st, out = api_json("POST", f"/chats/{chat_id}/messages", token=token,
                       payload={"kind": "image", "media_id": media_id, "body": ""})
    if not (200 <= st < 300):
        print("!! no se pudo enviar la imagen:", st)
        return False
    return True


def ensure_real_image(user: str, pwd: str) -> tuple[int, str]:
    """Deja una imagen REAL en la cuenta. Devuelve (chat_id, título).

    Si ya hay una imagen grande en algún chat visible, no escribe nada y
    devuelve ese chat. Si no, sube un PNG de 320x200 y lo manda al chat
    más reciente (el primero de la lista) para que el barrido lo encuentre.
    """
    token = api_login(user, pwd)
    if not token:
        return 0, ""
    found, title = find_chat_with_image(token)
    if found:
        print("imagen real ya presente en el chat", found, repr(title))
        return found, title
    print("no hay ninguna imagen real: se sube una")
    st, out = api_json("GET", "/chats", token=token)
    if st != 200 or not out or not out.get("chats"):
        print("!! la cuenta no tiene chats donde enviar la imagen")
        return 0, ""
    # El chat más reciente de la lista (el server los ordena por actividad).
    chat = out["chats"][0]
    chat_id = int(chat["id"])
    media_id = upload_png(token, png_bytes())
    if not media_id:
        return 0, ""
    if not send_image_message(token, chat_id, media_id):
        return 0, ""
    print("imagen enviada al chat", chat_id)
    return chat_id, chat_ui_title(chat)


def main() -> int:
    out_dir = sys.argv[1] if len(sys.argv) > 1 else "/tmp/opencode/capturas"
    user = sys.argv[2] if len(sys.argv) > 2 else "nsprobe"
    pwd = sys.argv[3] if len(sys.argv) > 3 else "NSProbe!2026"
    os.makedirs(out_dir, exist_ok=True)

    # La imagen real se deja ANTES de arrancar la app: así la burbuja
    # ya está en el historial cuando se abre la conversación.
    print("== imagen real para el visor ==")
    image_chat, image_title = ensure_real_image(user, pwd)
    if not image_chat:
        print("!! no se pudo dejar una imagen real; el paso del visor puede fallar")

    print("== arrancando la app ==")
    subprocess.run(["adb", "shell", "am", "force-stop", PKG], timeout=30)
    subprocess.run(["adb", "shell", "am", "start", "-W", "-n", f"{PKG}/{ACT}"], timeout=90)
    time.sleep(12)

    xml = dump()
    print("== login ==")

    # Barrido: se visita el registro (y se vuelve) ANTES de rellenar:
    # LoginView guarda los campos en refs locales y al desmontarse
    # (go('register')) los pierde.
    visit_register(out_dir)

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

    # ===== barrido de pantallas =====
    # Se guarda el XML de la pantalla: sirve para ver dónde están las
    # cosas (alturas y posiciones) cuando una captura no se entiende.
    xml = dump()
    with open(os.path.join(out_dir, "ui-tras-login.xml"), "w", encoding="utf-8") as f:
        f.write(xml)
    tabs = find_all(xml, desc="tab:")
    for t in tabs:
        print("pestaña:", t.get("content-desc"), t.get("bounds"))
    if not find(xml, desc="tab: people"):
        print("!! no se ve la barra de pestañas")

    # --- Personas: cabecera, ficha de usuario (perfil) y grupo nuevo ---
    print("== personas ==")
    if tap(find(dump(), desc="tab: people")):
        time.sleep(6)
        shot(out_dir, "3-personas")

        if open_profile():
            shot(out_dir, "9-perfil")
            back_out(dump())  # de vuelta a Personas

        print("== grupo nuevo ==")
        xml = dump()
        if tap(find(xml, desc="new group")):
            time.sleep(6)
            shot(out_dir, "10-grupo-nuevo")
            back_out(dump())  # de vuelta a Personas
        else:
            print("!! no está el botón de grupo nuevo")
            print("   textos:", " | ".join(texts(xml)))

        # de vuelta a la lista de chats
        xml = dump()
        if find(xml, desc="tab: chats"):
            tap(find(xml, desc="tab: chats"))
            time.sleep(4)

    # --- Archivados (la lista filtrada, con su título) ---
    print("== archivados ==")
    xml = dump()
    if tap(find(xml, desc="tab: archived")):
        time.sleep(5)
        shot(out_dir, "6-archivados")
        xml = dump()
        if find(xml, desc="tab: chats"):
            tap(find(xml, desc="tab: chats"))
            time.sleep(4)
    else:
        print("!! no se pudo abrir Archivados")

    # Si hay lista de chats, se abre uno para ver la conversación.
    # Las filas llevan accessibilityLabel="chat: <nombre>" (W103), así que
    # se buscan por content-desc y no por el texto de un chat en concreto.
    # Se abre el chat que tiene la imagen REAL (el que dejó la
    # auto-reparación), no "el segundo": al mandar el mensaje nuevo el
    # chat cambia de posición en la lista.
    print("== conversación ==")
    xml = dump()
    row = find_chat_row(xml, image_title) if image_title else None
    if row is None and image_title:
        # La fila puede estar más abajo de la lista: se desplaza y se
        # busca otra vez.
        print("el chat", repr(image_title), "no está a la vista; se busca")
        for _ in range(6):
            scroll_down()
            xml = dump()
            row = find_chat_row(xml, image_title)
            if row:
                break
    if row is None:
        # Sin chat conocido: se cae al segundo de la lista (como antes).
        rows = find_all(xml, desc="chat:")
        row = rows[1] if len(rows) > 1 else (rows[0] if rows else None)
        print("se abre el chat por posición (sin título conocido)")
    if tap(row):
        time.sleep(8)
        shot(out_dir, "4-conversacion")

        if open_media():
            shot(out_dir, "7-visor")
            back_out(dump())  # visor → conversación
        back_out(dump())      # conversación → lista de chats
    else:
        print("no se encontró ninguna fila de chat para abrir")
        print("   textos:", " | ".join(texts(xml)))

    # --- Ajustes (se entra por la pestaña, que es donde está el hueco) ---
    print("== ajustes ==")
    xml = dump()
    if tap(find(xml, desc="tab: settings")):
        time.sleep(5)
        shot(out_dir, "8-ajustes")
        back_out(dump())
    else:
        print("!! no se pudo abrir Ajustes")

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
