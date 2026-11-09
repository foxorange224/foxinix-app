#!/usr/bin/env python3
"""icons.py — extrae los <symbol> del sprite de la web a PNG para la app nativa.

La web dibuja sus iconos con un sprite SVG inline en app.html (símbolos
con viewBox "0 -960 960 960" y relleno currentColor). La app nativa no
tiene SVG: cada icono se rasteriza a PNG en blanco puro y se tiñe en
runtime con `tintColor` (NS aplica un ColorFilter en Android).

Salida: App_Resources/Android/src/main/res/drawable-*/ic_fox_<nombre>.png
        (también App_Resources/iOS/... si se llega a compilar en un Mac)

Uso: python3 tools/icons.py
"""
from __future__ import annotations

import os
import re
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
APP_HTML = os.path.join(os.path.dirname(ROOT), "landing", "app.html")
ANDROID_RES = os.path.join(ROOT, "App_Resources", "Android", "src", "main", "res")

# densidades Android (factor de la base de 24dp)
DENSITIES = {"mdpi": 1.0, "hdpi": 1.5, "xhdpi": 2.0, "xxhdpi": 3.0, "xxxhdpi": 4.0}
BASE = 24

# Iconos que NO son cuadrados (ancho × alto en dp de la base mdpi).
# El resto se rasteriza cuadrado a BASE × BASE.
OVERRIDE = {
    "logo-word": (75, 30),   # 500 × 200 (marca + palabra)
}

# Iconos que usa la app nativa ahora (se puede ampliar libremente).
WANTED = [
    "back", "send", "clip", "search", "plus", "x", "check", "dots",
    "users", "user", "userplus", "chat", "image", "file", "mic",
    "smile", "pin", "bell-off", "phone", "lock", "key", "refresh",
    "download", "eye", "eye-off", "chevron-down", "alert", "info",
    "star", "star-fill", "archive", "forward", "reply", "play",
    "pause", "vol", "mute", "expand", "collapse",
    "logo-mark", "logo-word",
]


def symbols(html: str) -> dict[str, str]:
    out = {}
    for m in re.finditer(r'<symbol id="i-([^"]+)"([^>]*)>(.*?)</symbol>', html, re.S):
        name, attrs, body = m.group(1), m.group(2), m.group(3)
        vb = re.search(r'viewBox="([^"]+)"', attrs)
        out[name] = (vb.group(1) if vb else "0 -960 960 960", body.strip())
    return out


def to_svg(viewBox: str, body: str) -> str:
    # currentColor → blanco puro: el tinte lo pone la app (tintColor).
    body = body.replace("currentColor", "#FFFFFF")
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{viewBox}" '
        f'fill="#FFFFFF">{body}</svg>'
    )


def main() -> int:
    if not os.path.exists(APP_HTML):
        print("No se encontró", APP_HTML)
        return 1
    html = open(APP_HTML, encoding="utf-8").read()
    all_syms = symbols(html)
    print(f"símbolos en el sprite: {len(all_syms)}")

    os.makedirs(ANDROID_RES, exist_ok=True)
    made = 0
    missing = []
    with tempfile.TemporaryDirectory() as tmp:
        for name in WANTED:
            if name not in all_syms:
                missing.append(name)
                continue
            viewBox, body = all_syms[name]
            svg_path = os.path.join(tmp, f"{name}.svg")
            with open(svg_path, "w", encoding="utf-8") as f:
                f.write(to_svg(viewBox, body))
            # OJO: AAPT2 rechaza guiones en el nombre de un recurso
            # (y getIdentifier(...) en 'drawable' devolvería 0), así que
            # "bell-off" va a disco como "bell_off".
            res_name = "ic_fox_" + name.replace("-", "_")
            bw, bh = OVERRIDE.get(name, (BASE, BASE))
            for dens, k in DENSITIES.items():
                out_dir = os.path.join(ANDROID_RES, f"drawable-{dens}")
                os.makedirs(out_dir, exist_ok=True)
                out_png = os.path.join(out_dir, res_name + ".png")
                w = int(round(bw * k))
                h = int(round(bh * k))
                r = subprocess.run(
                    ["rsvg-convert", "-w", str(w), "-h", str(h), "-o", out_png, svg_path],
                    capture_output=True,
                )
                if r.returncode != 0:
                    print("  falló", name, dens, r.stderr.decode()[:200])
                    return 1
            made += 1
    print(f"iconos rasterizados: {made} (5 densidades c/u)")
    if missing:
        print("no están en el sprite:", ", ".join(missing))
    return 0


if __name__ == "__main__":
    sys.exit(main())
