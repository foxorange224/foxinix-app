/* files-picker.ts — selector de archivos: versión común (sin plataforma).

   Cada plataforma tiene su propio archivo (files-picker.android.ts,
   files-picker.ios.ts) y el webpack de NativeScript elige el suyo. Este
   archivo es el que se usa si la app se compila para otra plataforma
   (o en las pruebas de Node): no hay selector. */

export async function pickPlatformFile(): Promise<string> {
  return '';
}
