#!/usr/bin/env node
/* W115 — política de contraseñas del frontend.
   La regla debe coincidir con server/app/schemas.py. Se ejecuta sin
   navegador porque password.js no importa nada.

   Uso: node tests/password_policy_test.mjs */
import { passwordError, PASSWORD_HINT } from '../landing/static/js/password.js';

const CASES = [
  ['válida', 'Abcdef1!', ''],
  ['corta', 'Abc1!', 'La contraseña necesita al menos 8 caracteres'],
  ['sin mayúscula', 'abcdef1!', 'La contraseña necesita al menos una mayúscula'],
  ['sin minúscula', 'ABCDEF1!', 'La contraseña necesita al menos una minúscula'],
  ['sin número', 'Abcdefgh!', 'La contraseña necesita al menos un número'],
  ['sin símbolo', 'Abcdef12', 'La contraseña necesita al menos un símbolo'],
  ['demasiado larga', 'A'.repeat(199) + 'a1!',
    'La contraseña no puede superar los 200 caracteres'],
  ['acentuada', 'Ábcdef1!', ''],
];

let fails = 0;
for (const [label, pw, want] of CASES) {
  const got = passwordError(pw);
  const ok = got === want;
  if (!ok) fails++;
  console.log((ok ? 'PASS' : 'FAIL'), label, ok ? '' : `→ ${JSON.stringify(got)}`);
}

if (!PASSWORD_HINT.includes('mayúscula') || !PASSWORD_HINT.includes('símbolo')) {
  fails++;
  console.log('FAIL pista incompleta →', PASSWORD_HINT);
}

console.log();
if (fails) {
  console.log(`✗ ${fails} FAIL`);
  process.exit(1);
}
console.log('✓ política de contraseñas OK (frontend)');
