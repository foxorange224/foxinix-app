/* ns-websocket-stub.mjs — stub de `@master.technology/websockets` para
   probar el núcleo nativo en Node.

   El plugin real habla con Java (Android) / Objective-C (iOS): en Node no
   hay red ni runtime nativo. Este stub imita la API del plugin lo
   suficiente para que realtime.js cargue y se pueda comprobar el
   camino de conexión (y el apagado). */

/* Todos los sockets creados (para las pruebas). */
export const instances = [];

export class NativeWebSockets {
  constructor(url, options) {
    this.url = url;
    this.options = options || {};
    this._callbacks = { open: [], close: [], message: [], error: [] };
    this.readyState = 0;          // CONNECTING
    this.sent = [];
    /* Registro: la prueba usa el último socket creado para simular un
       mensaje entrante (y así probar el camino WS → aviso). */
    instances.push(this);
  }
  on(event, cb) {
    if (!this._callbacks[event]) this._callbacks[event] = [];
    this._callbacks[event].push(cb);
  }
  off(event, cb) {
    const l = this._callbacks[event] || [];
    const i = l.indexOf(cb);
    if (i >= 0) l.splice(i, 1);
  }
  _notify(event, data) {
    for (const cb of (this._callbacks[event] || []).slice()) {
      cb.apply(this, [data]);
    }
  }
  /* Simula una conexión abierta. */
  simulateOpen() {
    this.readyState = 1;
    this._notify('open', [this]);
  }
  simulateMessage(text) {
    this._notify('message', [this, text]);
  }
  simulateClose(code = 1000, reason = '') {
    this.readyState = 3;
    this._notify('close', [this, code, reason]);
  }
  send(data) { this.sent.push(data); }
  close(code, reason) {
    this.readyState = 3;
    this._notify('close', [this, code || 1000, reason || '']);
  }
}

export default NativeWebSockets;
