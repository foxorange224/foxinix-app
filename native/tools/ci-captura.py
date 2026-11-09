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
    # Se abre el SEGUNDO: el primero suele ser un grupo recién creado (sin
    # mensajes) y el segundo tiene conversación para ver las burbujas.
    print("== conversación ==")
    xml = dump()
    rows = find_all(xml, desc="chat:")
    row = rows[1] if len(rows) > 1 else (rows[0] if rows else None)
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
