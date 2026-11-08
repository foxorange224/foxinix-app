/* img.ts — imágenes dentro de la burbuja del chat (W102).

   El núcleo compartido (actions.js) ya sabe convertir la URL relativa que
   da el servidor (/media/file/...) en una URL ABSOLUTA del CDN con la
   firma puesta (mediaUrl()). Acá sólo se decide:

     - qué mensajes son imágenes (los que se pueden ver en la burbuja);
     - qué URL se pide: la MINIATURA del server para la burbuja (W15:
       pesa mucho menos y se ve igual de chica) y el ORIGINAL para el
       visor a pantalla completa;
     - qué tamaño tiene la caja, conservando la proporción real que
       manda el server (media.width / media.height).

   Vive fuera de la vista para que se pueda probar en Node (tools/
   test-core.mjs), igual que notifier.ts o service.ts. */

import { mediaUrl } from './core/actions.js';

/* Tope de la caja de la imagen dentro de la burbuja (DIPs). */
export const IMG_MAX_W = 220;
export const IMG_MAX_H = 300;

/* ¿Este mensaje es una imagen que se puede mostrar en la burbuja?
   kind === 'image' + media con URL. Un GIF/WebP animado también cuenta
   (el server lo marca con media.animated). */
export function isImageMsg(m: any): boolean {
  if (!m || m.kind !== 'image') return false;
  const md = m.media;
  if (!md || !md.url) return false;
  const mime = String(md.mime || '');
  /* Si el server manda MIME, tiene que ser de imagen. */
  if (mime && mime.indexOf('image/') !== 0) return false;
  return true;
}

/* URL de la imagen (CDN, firmada).
   thumb = true  → pide la miniatura del server (?thumb=1): es la que va
                    dentro de la burbuja.
   thumb = false → el original: es el que va en el visor. */
export function imageUrl(m: any, thumb?: boolean): string {
  if (!isImageMsg(m)) return '';
  let u = '';
  try {
    u = mediaUrl(m.media.url);
  } catch (e) {
    return '';
  }
  if (!u) return '';
  if (!thumb) return u;
  if (u.indexOf('thumb=') >= 0) return u;
  /* La firma cubre sólo el slug: agregar ?thumb=1 no la invalida. */
  if (u.indexOf('/media/') < 0) return u;
  return u + (u.indexOf('?') >= 0 ? '&' : '?') + 'thumb=1';
}

/* Tamaño de la caja: conserva la proporción real (la manda el server)
   y no pasa del tope. Sin resolución conocida (imágenes viejas, SVG) →
   caja cuadrada. Nunca se amplía más que el original. */
export function imageBox(m: any): { w: number; h: number } {
  const md = (m && m.media) || {};
  const w = Number(md.width) || 0;
  const h = Number(md.height) || 0;
  if (!(w > 0 && h > 0)) return { w: IMG_MAX_W, h: IMG_MAX_W };
  const k = Math.min(IMG_MAX_W / w, IMG_MAX_H / h, 1);
  return {
    w: Math.max(1, Math.round(w * k)),
    h: Math.max(1, Math.round(h * k)),
  };
}
