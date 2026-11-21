/* Política de contraseñas (§ W115). Es la MISMA regla que aplica el
   servidor en `server/app/schemas.py` al registrar, restablecer y cambiar
   la contraseña: 8-200 caracteres, con mayúscula, minúscula, número y
   símbolo. Vive en un módulo compartido para que la web y la app nativa
   avisen ANTES de enviar y no conviertan un 422 en "Datos inválidos".

   OJO: el runtime V8 de NativeScript 9 NO acepta escapes de propiedad
   Unicode (tipo `\p`): el bundle nativo falla al arrancar con "Invalid
   property name". Por eso la regla se calcula con
   toUpperCase/toLowerCase. El cliente exige un símbolo ASCII (la
   puntuación de siempre): el servidor acepta cualquier carácter no
   alfanumérico, así que todo lo que el cliente deja pasar también lo
   acepta el servidor.

   Devuelve '' si la contraseña es válida o la clave i18n del primer
   requisito incumplido (las vistas la pasan por t()). */

function hasChar(pw, test) {
  for (const c of pw) if (test(c)) return true;
  return false;
}

/* Letra con caja (A, á, Ω…): la conversión cambia. Las letras sin caja
   (中, العربية) no cuentan para mayúscula/minúscula, igual que en Python. */
function isCased(c) {
  return c.toLowerCase() !== c.toUpperCase();
}

/* Signos no ASCII habituales (teclado español, monedas, comillas): el
   servidor los acepta como símbolo porque no son alfanuméricos. */
const NON_ASCII_SYMBOLS = '¡¿€£¥©®°±×÷§…—–“”‘’«»·•™';

/* Todo lo demás no ASCII se considera letra a efectos de "símbolo": así
   una tilde, un ideograma o un emoji nunca se confunden con un símbolo y
   no se envía al servidor una contraseña que él pueda rechazar. */
function isLetter(c) {
  if (NON_ASCII_SYMBOLS.includes(c)) return false;
  return isCased(c) || c.codePointAt(0) > 0x7f;
}

function isAsciiDigit(c) {
  return c >= '0' && c <= '9';
}

function isSymbol(c) {
  return !isLetter(c) && !isAsciiDigit(c);
}

export function passwordError(pw) {
  if (!pw || pw.length < 8) return 'La contraseña necesita al menos 8 caracteres';
  if (pw.length > 200) return 'La contraseña no puede superar los 200 caracteres';
  if (!hasChar(pw, (c) => isCased(c) && c === c.toUpperCase()))
    return 'La contraseña necesita al menos una mayúscula';
  if (!hasChar(pw, (c) => isCased(c) && c === c.toLowerCase()))
    return 'La contraseña necesita al menos una minúscula';
  if (!hasChar(pw, isAsciiDigit)) return 'La contraseña necesita al menos un número';
  if (!hasChar(pw, isSymbol)) return 'La contraseña necesita al menos un símbolo';
  return '';
}

/* Texto de ayuda que se muestra bajo el campo (misma redacción en web y
   nativa). */
export const PASSWORD_HINT =
  'Mínimo 8 caracteres, con mayúscula, minúscula, número y símbolo (!@#$%…).';
