#!/usr/bin/env python3
"""W115 — política de contraseñas del servidor.

Comprueba que registro, restablecer y cambiar contraseña aplican la MISMA
regla (8-200, mayúscula, minúscula, número y símbolo) y devuelven mensajes
legibles. La web/nativa replica la regla en `landing/static/js/password.js`
(ver `tests/password_policy_test.mjs`).

Uso (desde la raíz del repo):
    server/.venv/bin/python server/tests/password_policy_test.py
"""
from __future__ import annotations

import sys
from pathlib import Path

from pydantic import ValidationError

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.schemas import ChangePasswordIn, RegisterIn, ResetIn  # noqa: E402

FAILS = 0


def check(label: str, model, payload: dict, want_ok: bool, want_msg: str = "") -> None:
    global FAILS
    try:
        model(**payload)
        ok, msg = True, ""
    except ValidationError as e:
        ok = False
        msg = e.errors()[0]["msg"].replace("Value error, ", "")
    good = ok == want_ok and (ok or msg == want_msg)
    if not good:
        FAILS += 1
    print(("PASS" if good else "FAIL"), label, "" if good else f"→ ok={ok} msg={msg!r}")


REG = {"email": "policy@example.com", "username": "policyuser"}
RESET = {"identifier": "policy@example.com", "code": "123456"}
CHG = {"current_password": "Actual1!"}

CASES = [
    ("válida", "Abcdef1!", True, ""),
    ("corta", "Abc1!", False, "La contraseña necesita al menos 8 caracteres"),
    ("sin mayúscula", "abcdef1!", False, "La contraseña necesita al menos una mayúscula"),
    ("sin minúscula", "ABCDEF1!", False, "La contraseña necesita al menos una minúscula"),
    ("sin número", "Abcdefgh!", False, "La contraseña necesita al menos un número"),
    ("sin símbolo", "Abcdef12", False, "La contraseña necesita al menos un símbolo"),
    ("demasiado larga", "A" * 199 + "a1!", False,
     "La contraseña no puede superar los 200 caracteres"),
    ("acentuada", "Ábcdef1!", True, ""),
]

for label, pw, want_ok, want_msg in CASES:
    check("registro: " + label, RegisterIn, {**REG, "password": pw}, want_ok, want_msg)
    check("reset: " + label, ResetIn, {**RESET, "password": pw}, want_ok, want_msg)
    check("cambio: " + label, ChangePasswordIn, {**CHG, "new_password": pw}, want_ok, want_msg)

print()
if FAILS:
    print(f"✗ {FAILS} FAIL")
    raise SystemExit(1)
print("✓ política de contraseñas OK (registro, reset y cambio)")
