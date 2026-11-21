/* test-w115-i18n.mjs — comprueba la política de contraseñas (W115) en la
   app nativa: el módulo compartido llega desde la web sin cambios y
   RegisterView lo usa antes de enviar.

   No necesita la API ni credenciales (todo es local).

   Uso: node tools/test-w115-i18n.mjs
*/
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const WEB = path.join(ROOT, '..', 'landing', 'static', 'js');

let pass = 0;
let fail = 0;

function ok(name, cond, detail = '') {
  if (cond) {
    pass++;
    console.log('PASS  ' + name + (detail ? '  [' + detail + ']' : ''));
  } else {
    fail++;
    console.log('FAIL  ' + name + (detail ? '  [' + detail + ']' : ''));
  }
}

const read = (p) => fs.readFileSync(p, 'utf8');

/* 1. El core nativo es una copia exacta del módulo web. */
const webPw = read(path.join(WEB, 'password.js'));
const corePw = read(path.join(ROOT, 'app', 'core', 'password.js'));
ok('core/password.js copia el módulo web (solo cabecera generada)',
  corePw.endsWith(webPw));

/* 2. La regla cubre los cinco requisitos. */
for (const msg of [
  'La contraseña necesita al menos 8 caracteres',
  'La contraseña necesita al menos una mayúscula',
  'La contraseña necesita al menos una minúscula',
  'La contraseña necesita al menos un número',
  'La contraseña necesita al menos un símbolo',
]) {
  ok('regla incluye: ' + msg, webPw.includes(msg));
}
ok('expone PASSWORD_HINT', webPw.includes('export const PASSWORD_HINT'));

/* 3. RegisterView valida con el módulo y muestra la pista. */
const reg = read(path.join(ROOT, 'app', 'views', 'RegisterView.vue'));
ok('RegisterView importa passwordError/PASSWORD_HINT',
  /import\s*\{\s*passwordError,\s*PASSWORD_HINT\s*\}\s*from\s*'\.\.\/core\/password\.js'/.test(reg));
ok('RegisterView llama a passwordError(password.value)',
  reg.includes('passwordError(password.value)'));
ok('RegisterView define pwHint desde PASSWORD_HINT',
  reg.includes('const pwHint = PASSWORD_HINT;'));
ok('RegisterView pinta la pista', reg.includes('t(pwHint)'));
ok('RegisterView ya no valida solo la longitud',
  !reg.includes("password.value.length < 8"));

/* 4. Las claves existen en el i18n compartido. */
const i18n = read(path.join(WEB, 'i18n.js'));
for (const key of [
  'La contraseña necesita al menos una mayúscula',
  'La contraseña necesita al menos una minúscula',
  'La contraseña necesita al menos un número',
  'La contraseña necesita al menos un símbolo',
  'Mínimo 8 caracteres, con mayúscula, minúscula, número y símbolo.',
]) {
  ok('i18n tiene: ' + key, i18n.includes("'" + key + "'"));
}

console.log(`\n${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
