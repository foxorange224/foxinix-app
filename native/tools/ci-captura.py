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
import html
import json
import os
import re
import signal
import struct
import subprocess
import sys
import time
import urllib.error
import urllib.request
import zlib

PKG = "io.foxinix.nativa"
ACT = "com.tns.NativeScriptActivity"

# El emulador de CI se cuelga de vez en cuando (el launcher muestra un
# "isn't responding" y adb no responde). El barrido no puede quedar
# colgado toda la hora: tiene un presupuesto de tiempo.
SMOKE_BUDGET = 15 * 60      # segundos


class TimeBudget(Exception):
    """Se pasó el presupuesto de tiempo del barrido."""


def _alarm(_signum, _frame) -> None:
    raise TimeBudget("se pasó el tiempo")

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
        # Timeout corto: si el emulador está colgado, cada comando
        # tardaba un minuto y el barrido se iba de tiempo.
        return subprocess.run(args, capture_output=True, text=True,
                              timeout=kw.get("timeout", 20)).stdout
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
    """Lista de nodos con sus atributos (usa regex: el XML es plano).

    uiautomator escapa los emojis como entidades numéricas ("&#128077;"),
    así que los valores se desescapan: si no, el emoji de la reacción
    nunca coincidiría con el de verdad.
    """
    out = []
    for m in re.finditer(r"<node\b([^>]*?)/?>", xml):
        attrs = {}
        for a in re.finditer(r"([\w-]+)=\"([^\"]*)\"", m.group(1)):
            attrs[a.group(1)] = html.unescape(a.group(2))
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
    subprocess.run(["adb", "shell", "input", "tap", str(c[0]), str(c[1])], timeout=15)
    return True


def type_text(text: str) -> None:
    # `input text` no entiende algunos caracteres: se pasan escapados.
    safe = text.replace("\\", "\\\\").replace(" ", "%s").replace("!", "\\!")
    subprocess.run(["adb", "shell", "input", "text", safe], timeout=15)


def edit_fields(xml: str) -> list[dict]:
    """Los campos de texto de la pantalla."""
    return [n for n in nodes(xml) if n.get("class", "").endswith("EditText")]


def dismiss_anhd() -> bool:
    """El emulador de CI a veces se cuelga y sale el diálogo del sistema
    ("Pixel Launcher isn't responding") por encima de la app: se toca
    "Wait" (o "Esperar") para seguir con el barrido."""
    xml = dump()
    for lbl in ("Wait", "Esperar"):
        b = find(xml, cls="Button", text=lbl)
        if b:
            print("diálogo del sistema (ANR):", lbl)
            tap(b)
            time.sleep(4)
            return True
    return False


def wait_edit_fields(timeout: int = 60) -> list[dict]:
    """Espera a que aparezcan los campos de texto de la pantalla.

    El plazo se comprueba SIEMPRE: si el diálogo del sistema aparece
    una y otra vez, el bucle tiene que terminar igual.
    """
    fin = time.time() + timeout
    while time.time() < fin:
        f = edit_fields(dump())
        if f:
            return f
        if dismiss_anhd():
            continue
        time.sleep(3)
    return []


def clear_field() -> None:
    """Vacía el campo enfocado (se va al final y borra hacia atrás)."""
    subprocess.run(["adb", "shell", "input", "keyevent", "123"], timeout=15)
    subprocess.run(
        ["adb", "shell", "input", "keyevent"] + ["67"] * 40, timeout=30)
    time.sleep(0.5)


def fill_field(index: int, text: str, masked: bool = False) -> str:
    """Escribe un texto en un campo y devuelve lo que quedó escrito.

    `adb shell input text` a veces pierde o reordena letras (en un run
    el "nsprobe" terminó como "nrspobe" y el login falló), así que se
    comprueba lo escrito y se reintenta hasta tres veces. El campo de
    contraseña sale enmascarado: de él sólo se mira el largo.
    """
    got = ""
    for _ in range(3):
        fields = edit_fields(dump())
        if index >= len(fields):
            return ""
        tap(fields[index])
        clear_field()
        type_text(text)
        time.sleep(1)
        hide_keyboard()
        fields = edit_fields(dump())
        if index >= len(fields):
            return ""
        got = (fields[index].get("text") or "").strip()
        if masked:
            ok = bool(got) and abs(len(got) - len(text)) <= 1
        else:
            ok = got == text
        if ok:
            return got
        print("   el campo quedó:", repr(got), "-> se reintenta")
    return got


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
    subprocess.run(["adb", "shell", "input", "keyevent", "4"], timeout=15)
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
    subprocess.run(["adb", "shell", "input", "keyevent", "4"], timeout=15)
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
        subprocess.run(["adb", "exec-out", "screencap", "-p"], stdout=f, timeout=30)
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
    link = None
    for _ in range(4):
        xml = dump()
        link = (find(xml, cls="TextView", text="Create account")
                or find(xml, cls="TextView", text="Crear cuenta"))
        if link:
            break
        if not dismiss_anhd():
            time.sleep(3)
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
    subprocess.run(["adb", "shell", "am", "force-stop", PKG], timeout=15)
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


def open_voice_rec() -> bool:
    """Toca el micrófono del compositor: debe salir la barra de grabación.

    W104. La barra se reconoce por el botón de cancelar ("cancel voice
    message"), que sólo existe mientras se graba: buscar el tiempo
    mm:ss no vale (las burbujas también muestran horas así).

    El emulador del CI se lanza con -no-audio: si allí no hay micrófono
    la app avisa con un toast y no abre la barra. Eso NO es un fallo del
    smoke (la app no se rompe), así que sólo se avisa.
    """
    print("== nota de voz ==")
    xml = dump()
    btn = find(xml, desc="voice message")
    if not btn:
        print("!! no se vio el botón del micrófono")
        print("   textos:", " | ".join(texts(xml)))
        return False
    tap(btn)
    time.sleep(6)
    xml = dump()
    cancel = find(xml, desc="cancel voice message")
    if not cancel:
        print("!! no apareció la barra de grabación")
        print("   textos:", " | ".join(texts(xml)))
        return False
    # El reloj de la barra: el mm:ss que está en la MISMA fila que el
    # botón de cancelar (las burbujas también muestran horas así).
    cbox = bounds_box(cancel.get("bounds", ""))
    clock = ""
    for n in nodes(xml):
        t = (n.get("text") or "").strip()
        if not re.fullmatch(r"\d{1,2}:\d{2}", t):
            continue
        box = bounds_box(n.get("bounds", ""))
        if not box or not cbox:
            continue
        if abs((box[1] + box[3]) // 2 - (cbox[1] + cbox[3]) // 2) <= 24:
            clock = t
            break
    print("barra de grabación:", clock or "(sin reloj)")
    return True


def cancel_voice_rec() -> None:
    """Cancela la grabación (la X) y vuelve al compositor normal."""
    xml = dump()
    if tap(find(xml, desc="cancel voice message")):
        time.sleep(3)
        return
    go_back()


def long_press(node: dict | None, ms: int = 900) -> bool:
    """Mantiene pulsado un nodo (un swipe sin movimiento)."""
    if not node:
        return False
    c = bounds_center(node.get("bounds", ""))
    if not c:
        return False
    subprocess.run(
        ["adb", "shell", "input", "swipe", str(c[0]), str(c[1]),
         str(c[0]), str(c[1]), str(ms)],
        timeout=30)
    return True


def find_message_text(xml: str) -> dict | None:
    """El texto de un mensaje de la conversación (para mantener pulsado).

    Se descartan la cabecera, el compositor, las horas y el separador
    del día. Se elige el texto más largo: los nombres de remitente y
    los avisos del sistema son más cortos que un mensaje de verdad.
    """
    _w, h = screen_size()
    best = None
    for n in nodes(xml):
        if not n.get("class", "").endswith("TextView"):
            continue
        t = (n.get("text") or "").strip()
        if len(t) < 3:
            continue
        if re.fullmatch(r"\d{1,2}:\d{2}", t):
            continue          # la hora de un mensaje
        if t.isupper():
            continue          # "HOY" / "TODAY"
        box = bounds_box(n.get("bounds", ""))
        if not box:
            continue
        _x1, y1, _x2, y2 = box
        if y1 < 80 or y2 > h - 110:
            continue          # cabecera o compositor
        if best is None or len(t) > len(best.get("text", "")):
            best = n
    return best


def open_msg_actions() -> bool:
    """Mantiene pulsado un mensaje: debe salir la hoja de acciones (W105).

    La hoja se reconoce por la acción "Responder" (su accessibilityLabel
    es "reply").
    """
    print("== acciones del mensaje ==")
    xml = dump()
    msg = find_message_text(xml)
    if not msg:
        print("!! no se encontró un mensaje que pulsar")
        print("   textos:", " | ".join(texts(xml)))
        return False
    print("mensaje:", repr(msg.get("text", ""))[:40], msg.get("bounds"))
    long_press(msg)
    time.sleep(4)
    xml = dump()
    if not find(xml, desc="reply"):
        print("!! no salió la hoja de acciones")
        print("   textos:", " | ".join(texts(xml)))
        return False
    print("hoja de acciones abierta")
    return True


def close_msg_actions() -> None:
    """Cierra la hoja de acciones (el botón "Cancelar").

    OJO: si la hoja ya se cerró sola (tocar "Responder" la cierra), NO
    se toca "atrás": eso sacaría la app de la conversación y el resto
    del barrido se haría sobre la lista de chats.
    """
    xml = dump()
    if tap(find(xml, desc="close message actions")):
        time.sleep(2)
        return
    if find(xml, desc="reply"):
        print("!! la hoja de acciones sigue abierta")


def has_reaction_chip(xml: str) -> bool:
    """¿Se ve la píldora de una reacción en una burbuja?

    El emoji de la píldora es un Label SIN accessibilityLabel (los de la
    hoja sí lo tienen: "react 👍").
    """
    for n in nodes(xml):
        if (n.get("text") or "").strip() == "👍" and not (n.get("content-desc") or ""):
            return True
    return False


def react_to_message() -> bool:
    """Reacciona con 👍 al mensaje de la hoja (W105).

    Si ya hay una reacción puesta, no se toca nada: el server la quita
    si se manda la misma otra vez.
    """
    xml = dump()
    if has_reaction_chip(xml):
        print("el mensaje ya tiene una reacción: no se toca")
        return True
    btn = find(xml, desc="react ")
    if not btn:
        print("!! no se vio la reacción rápida")
        return False
    tap(btn)
    time.sleep(4)
    xml = dump()
    if not has_reaction_chip(xml):
        print("!! no apareció la píldora de la reacción")
        print("   textos:", " | ".join(texts(xml)))
        return False
    print("reacción puesta")
    return True


def open_reply_bar() -> bool:
    """Toca "Responder": debe salir la barra de respuesta arriba del
    compositor (W105)."""
    xml = dump()
    if not tap(find(xml, desc="reply")):
        print("!! no se vio la acción Responder")
        return False
    time.sleep(3)
    xml = dump()
    if not find(xml, desc="cancel reply"):
        print("!! no apareció la barra de respuesta")
        print("   textos:", " | ".join(texts(xml)))
        return False
    print("barra de respuesta abierta")
    return True


def close_reply_bar() -> None:
    """Cierra la barra de respuesta (la X)."""
    xml = dump()
    if tap(find(xml, desc="cancel reply")):
        time.sleep(2)


def copy_message() -> bool:
    """Toca "Copiar texto": debe salir el aviso de mensaje copiado (W105).

    El aviso puede salir en español o en inglés (según el idioma de la
    app), así que se buscan las dos formas.
    """
    xml = dump()
    if not tap(find(xml, desc="copy message text")):
        print("!! no se vio la acción Copiar texto")
        return False
    time.sleep(2)
    xml = dump()
    if not (find(xml, contains="Message copied")
            or find(xml, contains="Mensaje copiado")):
        print("!! no salió el aviso de mensaje copiado")
        print("   textos:", " | ".join(texts(xml)))
        return False
    print("mensaje copiado")
    return True


def open_forward() -> bool:
    """Toca "Reenviar…": debe abrirse la pantalla de destinos (W105)."""
    xml = dump()
    if not tap(find(xml, desc="forward message")):
        print("!! no se vio la acción Reenviar")
        return False
    time.sleep(4)
    xml = dump()
    if not find(xml, desc="forward to: "):
        print("!! no se abrió la pantalla de reenviar")
        print("   textos:", " | ".join(texts(xml)))
        return False
    print("pantalla de reenviar abierta")
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


def upload_bytes(token: str, data: bytes, filename: str, mime: str) -> int:
    """Sube un archivo al server (multipart, campo 'file'). Devuelve el id."""
    boundary = "----FoxinixSmoke" + os.urandom(8).hex()
    body = b"".join([
        ("--%s\r\n" % boundary).encode(),
        ('Content-Disposition: form-data; name="file"; filename="%s"\r\n' % filename).encode(),
        ("Content-Type: %s\r\n\r\n" % mime).encode(),
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
    print("subida:", out.get("name"), out.get("mime"), out.get("width"),
          "x", out.get("height"), out.get("size"), "bytes")
    return int(out.get("id") or 0)


def wav_bytes(secs: float = 1.2, freq: int = 440, rate: int = 8000) -> bytes:
    """Un WAV corto (un tono) generado en memoria, sin dependencias.

    Es la nota de voz de prueba: sin ella la burbuja de voz no aparece
    en las capturas (no hay ningún mensaje de voz en la cuenta).
    """
    import math

    n = int(secs * rate)
    frames = bytearray()
    for i in range(n):
        # un tono suave con una envolvente para que no suene a pitido
        env = min(1.0, i / 400.0, (n - i) / 400.0)
        v = int(9000 * env * math.sin(2 * math.pi * freq * i / rate))
        frames += struct.pack("<h", v)
    data = bytes(frames)
    head = b"RIFF" + struct.pack("<I", 36 + len(data)) + b"WAVE"
    head += b"fmt " + struct.pack("<IHHIIHH", 16, 1, 1, rate, rate * 2, 2, 16)
    head += b"data" + struct.pack("<I", len(data))
    return head + data


def chat_has_voice(token: str, chat_id: int) -> bool:
    """¿Tiene este chat alguna nota de voz?"""
    st, out = api_json("GET", f"/chats/{chat_id}/messages?limit=50", token=token)
    if st != 200 or not out:
        return False
    for m in out.get("messages") or []:
        if m.get("kind") == "voice" and m.get("media"):
            return True
    return False


def ensure_real_voice(token: str, chat_id: int) -> bool:
    """Deja una nota de voz REAL en el chat (si no hay ninguna).

    Sin ella, la burbuja de voz (el reproductor) no sale en las capturas.
    """
    if chat_has_voice(token, chat_id):
        print("ya hay una nota de voz en el chat", chat_id)
        return True
    media_id = upload_bytes(token, wav_bytes(), "nota-de-voz.wav", "audio/wav")
    if not media_id:
        return False
    st, out = api_json("POST", f"/chats/{chat_id}/messages", token=token, payload={
        "kind": "voice",
        "media_id": media_id,
        "body": "",
        "dur": 1,
        "peaks": json.dumps([12, 28, 45, 60, 48, 70, 55, 30, 22, 40]),
    })
    if not (200 <= st < 300):
        print("!! no se pudo enviar la nota de voz:", st)
        return False
    print("nota de voz enviada al chat", chat_id)
    return True


def send_image_message(token: str, chat_id: int, media_id: int) -> bool:
    """Manda el mensaje de imagen al chat."""
    st, out = api_json("POST", f"/chats/{chat_id}/messages", token=token,
                       payload={"kind": "image", "media_id": media_id, "body": ""})
    if not (200 <= st < 300):
        print("!! no se pudo enviar la imagen:", st)
        return False
    return True


def ensure_test_media(user: str, pwd: str) -> tuple[int, str]:
    """Deja los medios de prueba en la cuenta. Devuelve (chat_id, título).

    - Una imagen REAL (>100 px): sin ella el visor no se abre nunca
      (las imágenes de prueba medían 1x1 px).
    - Una nota de voz: sin ella la burbuja con el reproductor no sale
      en las capturas.

    Si ya están, no escribe nada (el smoke puede correr mil veces).
    """
    token = api_login(user, pwd)
    if not token:
        return 0, ""
    found, title = find_chat_with_image(token)
    if found:
        print("imagen real ya presente en el chat", found, repr(title))
    else:
        print("no hay ninguna imagen real: se sube una")
        st, out = api_json("GET", "/chats", token=token)
        if st != 200 or not out or not out.get("chats"):
            print("!! la cuenta no tiene chats donde enviar la imagen")
            return 0, ""
        # El chat más reciente de la lista (el server los ordena por actividad).
        chat = out["chats"][0]
        chat_id = int(chat["id"])
        media_id = upload_bytes(token, png_bytes(), "visor.png", "image/png")
        if not media_id:
            return 0, ""
        if not send_image_message(token, chat_id, media_id):
            return 0, ""
        print("imagen enviada al chat", chat_id)
        found, title = chat_id, chat_ui_title(chat)
    # La nota de voz va al mismo chat (el que se abre en el barrido).
    ensure_real_voice(token, found)
    return found, title


def run() -> int:
    out_dir = sys.argv[1] if len(sys.argv) > 1 else "/tmp/opencode/capturas"
    user = sys.argv[2] if len(sys.argv) > 2 else "nsprobe"
    pwd = sys.argv[3] if len(sys.argv) > 3 else "NSProbe!2026"
    os.makedirs(out_dir, exist_ok=True)

    # Los medios de prueba (imagen real y nota de voz) se dejan ANTES de
    # arrancar la app: así las burbujas ya están en el historial cuando
    # se abre la conversación.
    print("== medios de prueba ==")
    image_chat, image_title = ensure_test_media(user, pwd)
    if not image_chat:
        print("!! no se pudo dejar una imagen real; el paso del visor puede fallar")

    print("== arrancando la app ==")
    subprocess.run(["adb", "shell", "am", "force-stop", PKG], timeout=15)
    subprocess.run(["adb", "shell", "am", "start", "-W", "-n", f"{PKG}/{ACT}"], timeout=90)
    time.sleep(12)

    xml = dump()
    print("== login ==")

    # Barrido: se visita el registro (y se vuelve) ANTES de rellenar:
    # LoginView guarda los campos en refs locales y al desmontarse
    # (go('register')) los pierde.
    visit_register(out_dir)

    def edit_texts() -> list[dict]:
        return edit_fields(dump())

    # El login se reintenta: a veces el emulador pierde o reordena las
    # letras al escribir y el server responde "usuario o contraseña
    # incorrectos".
    for intento in range(1, 4):
        fields = wait_edit_fields()
        print("campos encontrados:", len(fields))
        if not fields:
            break

        # --- usuario ---
        fill_field(0, user)

        # --- contraseña (el teclado tapa el campo si no se cierra) ---
        fields = edit_texts()
        if len(fields) > 1:
            fill_field(1, pwd, masked=True)
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
            subprocess.run(["adb", "shell", "input", "keyevent", "66"], timeout=15)
        else:
            print("botón de entrada:", btn.get("text"))
        time.sleep(12)
        xml = dump()
        if dismiss_anhd():
            xml = dump()
        if not on_login_screen(xml):
            break
        print("!! el login no entró; se reintenta (intento", intento, ")")
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

        # W105: mantener pulsado un mensaje abre la hoja de acciones.
        if open_msg_actions():
            shot(out_dir, "12-acciones")
            # La reacción rápida: al tocarla se cierra la hoja y la
            # burbuja muestra la píldora de la reacción.
            if react_to_message():
                shot(out_dir, "13-reaccion")
            # La acción "Responder": sale la barra de respuesta arriba
            # del compositor.
            if open_msg_actions() and open_reply_bar():
                shot(out_dir, "14-respuesta")
                close_reply_bar()
            close_msg_actions()

            # La acción "Copiar texto": sale el aviso de copiado.
            if open_msg_actions():
                copy_message()
                close_msg_actions()

            # La acción "Reenviar…": se abre la pantalla de destinos.
            if open_msg_actions():
                if open_forward():
                    shot(out_dir, "15-reenviar")
                    back_out(dump())   # de vuelta a la conversación
                else:
                    close_msg_actions()

        # W104: el micrófono del compositor debe abrir la barra de
        # grabación (si el emulador no tiene micrófono, sólo avisa).
        if open_voice_rec():
            shot(out_dir, "11-voz-grabando")
            cancel_voice_rec()

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


def main() -> int:
    """El barrido con un presupuesto de tiempo.

    Si el emulador se cuelga, el script termina solo (y avisa) en vez
    de dejar el job de CI colgado media hora.
    """
    signal.signal(signal.SIGALRM, _alarm)
    signal.alarm(SMOKE_BUDGET)
    try:
        return run()
    except TimeBudget:
        print("!! se pasó el tiempo del barrido (", SMOKE_BUDGET, "s)")
        return 1
    finally:
        signal.alarm(0)


if __name__ == "__main__":
    sys.exit(main())
