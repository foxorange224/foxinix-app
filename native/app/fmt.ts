/* fmt.ts — fechas, horas y estados para las vistas nativas (W103).

   El port del diseño de la web trae funciones que allí viven en
   landing/static/js/views/helpers.js. Ese archivo está en views/ y NO
   entra en native/app/core/ (sync-core.mjs sólo copia la raíz de
   landing/static/js/), así que la parte que usan las pantallas se
   replica acá, importando el MISMO store e i18n del núcleo compartido.

   Si views/helpers.js cambia, replicar el cambio acá. */

import { store } from './core/store.js';
import { t } from './core/i18n.js';

/* ------------------------------------------------------- fechas/horas */

export function pad(n: number): string {
  return n < 10 ? '0' + n : String(n);
}

export function dayKey(d: Date): string {
  return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
}

export function dayLabel(d: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const that = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.round((today.getTime() - that.getTime()) / 86400000);
  if (diff === 0) return t('HOY');
  if (diff === 1) return t('AYER');
  if (d.getFullYear() === now.getFullYear()) {
    return d.getDate() + '/' + (d.getMonth() + 1);
  }
  return pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/'
    + String(d.getFullYear()).slice(2);
}

/* W17: 12/24 h. Leer store.prefs.h12 acá dentro de un computed vuelve
   reactivo el repintado de las horas al cambiar la preferencia. */
export function fmtTime(d: Date): string {
  const h = d.getHours();
  if (store.prefs.h12) {
    const h12 = h % 12 || 12;
    return h12 + ':' + pad(d.getMinutes()) + (h < 12 ? ' am' : ' pm');
  }
  return pad(h) + ':' + pad(d.getMinutes());
}

/* Hora de la lista de chats: hora si es hoy, "Ayer", si no la fecha. */
export function fmtListTime(ts: number): string {
  if (!ts) return '';
  const d = new Date(ts * 1000);
  const now = new Date();
  if (dayKey(d) === dayKey(now)) return fmtTime(d);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (d.getTime() >= today.getTime() - 86400000) return t('Ayer');
  if (d.getFullYear() === now.getFullYear()) {
    return d.getDate() + '/' + (d.getMonth() + 1);
  }
  return pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/'
    + String(d.getFullYear()).slice(2);
}

export function fmtLastSeen(ts: number): string {
  if (!ts) return t('desconectado');
  const d = new Date(ts * 1000);
  const now = new Date();
  if (dayKey(d) === dayKey(now)) return t('últ. vez {n}', { n: fmtTime(d) });
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (d.getTime() >= today.getTime() - 86400000) {
    return t('últ. vez ayer, {n}', { n: fmtTime(d) });
  }
  return t('últ. vez {n}', {
    n: d.getDate() + '/' + (d.getMonth() + 1) + ' ' + fmtTime(d),
  });
}

/* ------------------------------------------------------- estados (W9)

   Puntito de estado del avatar, con los colores de Discord que usa la
   web: en línea #23a55a, Ausente #f0b232, No molestar #f23f43,
   Invisible/desconectado #80848e. */

/* Los MISMOS que STATUS_PRESETS de views/helpers.js (W107). */
export const STATUS_PRESETS = [
  { val: 'online', label: 'En línea' },
  { val: 'busy', label: 'Ausente' },
  { val: 'dnd', label: 'No molestar' },
  { val: 'invisible', label: 'Invisible' },
];

export function presetLabel(val: string): string {
  for (let i = 0; i < STATUS_PRESETS.length; i++) {
    if (STATUS_PRESETS[i].val === val) return t(STATUS_PRESETS[i].label);
  }
  return '';
}

/* Color del puntito de estado (los colores Discord de la web:
   --st-online #23a55a, --st-busy #f0b232, --st-dnd #f23f43,
   --st-off #80848e). */
export function stDotColor(state: string): string {
  if (state === 'busy') return '#f0b232';
  if (state === 'dnd') return '#f23f43';
  if (state === 'off' || state === 'invisible') return '#80848e';
  return '#23a55a';
}

/* "Miembro desde" (joinedLine de la web): 12/3/2024. */
export function joinedLine(u: any): string {
  if (!u || !u.created_at) return '—';
  const d = new Date(u.created_at * 1000);
  return d.getDate() + '/' + (d.getMonth() + 1) + '/' + d.getFullYear();
}

/* Posición vertical de la portada (0 arriba … 100 abajo), como
   bannerPositionOf() de la web. */
export function bannerPositionOf(u: any): number {
  const n = Number(u && u.banner_position);
  if (!Number.isFinite(n)) return 50;
  return Math.max(0, Math.min(100, n));
}

export type DotState = 'on' | 'busy' | 'dnd' | 'off' | '';

/* Puntito del avatar. selfOn (opcional) = yo mismo: el "en línea" sale
   del WebSocket. Grupos / sin usuario → '' (sin puntito). W13: quien
   está desconectado igual lleva puntito, pero gris. */
export function dotState(u: any, selfOn?: boolean): DotState {
  const explicit = selfOn !== undefined;
  if (!explicit && !u) return '';
  const presence: any = store.presence || {};
  const on = explicit ? !!selfOn
    : !!(u && (presence[u.id] != null ? presence[u.id] : u.online));
  if (!on) return 'off';
  const p = (u && u.status_preset) || '';
  if (p === 'busy') return 'busy';
  if (p === 'dnd') return 'dnd';
  if (p === 'invisible') return 'off';
  return 'on';
}

export function statusOf(u: any): string {
  if (u && u.status_text) return u.status_text;
  if (u && u.status_preset) return presetLabel(u.status_preset);
  return '';
}

/* Línea de estado de la cabecera del chat (DM): "en línea" o la última
   vez vista; en grupos, el número de participantes. */
export function connLine(u: any): string {
  if (!u) return '';
  const presence: any = store.presence || {};
  const on = presence[u.id] != null ? presence[u.id] : u.online;
  return on ? t('en línea') : fmtLastSeen(u.last_seen || 0);
}

/* Tokens de color del tema: los MISMOS valores que
   landing/static/css/app.css (fuente de verdad). Sirven para lo que en
   NS no se puede escribir en CSS: el tintColor de los iconos, el
   borderColor del aro del puntito, el color de las barras… */
const TOKENS: Record<string, Record<string, string>> = {
  dark: {
    bg: '#1e1f22', panel: '#2b2d31', panel2: '#383a40', border: '#3f4147',
    t0: '#f2f3f5', t1: '#dbdee1', t2: '#a3a3a3',
    accent: '#ff751f', accentD: '#b85416', onAccent: '#1c0e03',
    err: '#f23f43', errBg: '#35222a', ok: '#00a8fc',
    chatBg: '#313338', bubbleYou: '#2b2d31', bubbleMe: '#b85416',
  },
  light: {
    bg: '#e3e5e8', panel: '#f2f3f5', panel2: '#e3e5e8', border: '#dcddde',
    t0: '#060607', t1: '#313338', t2: '#5c5e66',
    accent: '#a33f12', accentD: '#b85416', onAccent: '#ffffff',
    err: '#d32f2f', errBg: '#fdecee', ok: '#006ce7',
    chatBg: '#ffffff', bubbleYou: '#f2f3f5', bubbleMe: '#b85416',
  },
  black: {
    bg: '#000000', panel: '#080808', panel2: '#191919', border: '#262626',
    t0: '#ffffff', t1: '#e7e7e7', t2: '#9a9a9a',
    accent: '#ff751f', accentD: '#b85416', onAccent: '#1c0e03',
    err: '#f23f43', errBg: '#35222a', ok: '#00a8fc',
    chatBg: '#000000', bubbleYou: '#141414', bubbleMe: '#b85416',
  },
};

export type TokenName =
  | 'bg' | 'panel' | 'panel2' | 'border' | 't0' | 't1' | 't2'
  | 'accent' | 'accentD' | 'onAccent' | 'err' | 'errBg' | 'ok'
  | 'chatBg' | 'bubbleYou' | 'bubbleMe';

/* Un token del tema (con el tema oscuro como respaldo). */
export function tok(theme: string, name: TokenName): string {
  const set = TOKENS[theme] || TOKENS.dark;
  return set[name] || '';
}
