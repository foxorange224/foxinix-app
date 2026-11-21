/* Política de contraseñas (§ W115). Es la MISMA regla que aplica el
   servidor en `server/app/schemas.py` al registrar, restablecer y cambiar
   la contraseña: 8-200 caracteres, con mayúscula, minúscula, número y
   símbolo. Vive en un módulo compartido para que la web y la app nativa
   avisen ANTES de enviar y no conviertan un 422 en "Datos inválidos".

   Devuelve '' si la contraseña es válida o la clave i18n del primer
   requisito incumplido (las vistas la pasan por t()). */
export function passwordError(pw) {
  if (!pw || pw.length < 8) return 'La contraseña necesita al menos 8 caracteres';
  if (pw.length > 200) return 'La contraseña no puede superar los 200 caracteres';
  if (!/\p{Lu}/u.test(pw)) return 'La contraseña necesita al menos una mayúscula';
  if (!/\p{Ll}/u.test(pw)) return 'La contraseña necesita al menos una minúscula';
  if (!/\p{N}/u.test(pw)) return 'La contraseña necesita al menos un número';
  if (!/[^\p{L}\p{N}]/u.test(pw)) return 'La contraseña necesita al menos un símbolo';
  return '';
}

/* Texto de ayuda que se muestra bajo el campo (misma redacción en web y
   nativa). */
export const PASSWORD_HINT =
  'Mínimo 8 caracteres, con mayúscula, minúscula, número y símbolo.';
