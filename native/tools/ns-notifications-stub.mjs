/* ns-notifications-stub.mjs — stub de `@nativescript/local-notifications`
   para probar la capa de avisos en Node (sin emulador).

   El plugin real muestra avisos del sistema (Android/iOS). Acá se
   imita lo justo: se guardan las notificaciones "programadas" y se puede
   simular el toque en una de ellas (que es lo que abre el chat).

   Los auxiliares (las funciones __*) no son parte del plugin: las usa la
   prueba para mirar lo que pasó. */

export const scheduled = [];
let tapCallback = null;
let granted = true;

export const LocalNotifications = {
  async schedule(options) {
    const ids = [];
    for (const o of options || []) {
      const id = 1000 + scheduled.length;
      scheduled.push(Object.assign({ id }, o));
      ids.push(id);
    }
    return ids;
  },
  async hasPermission() {
    return granted;
  },
  async requestPermission() {
    granted = true;
    return true;
  },
  async addOnMessageReceivedCallback(cb) {
    tapCallback = cb;
    return true;
  },
  async getScheduledIds() {
    return scheduled.map((s) => s.id);
  },
  async cancel() { return true; },
  async cancelAll() { scheduled.length = 0; },
};

/* --- auxiliares para la prueba --- */
export function __setPermission(v) { granted = !!v; }
export function __reset() { scheduled.length = 0; }
export function __list() { return scheduled.slice(); }
/* Simula el toque en el aviso: el plugin entrega el payload. */
export async function __tap(payload, extra) {
  if (!tapCallback) return false;
  await tapCallback(Object.assign({ id: 1 }, extra || {}, { payload }));
  return true;
}
export function __hasTap() { return !!tapCallback; }
