/* ns-xhr-stub.mjs — XMLHttpRequest global para las pruebas en Node.

   En NativeScript el runtime instala su propio polyfill (el módulo xhr
   de @nativescript/core), que supports ArrayBuffer como cuerpo. Aquí se
   hace uno mínimo sobre fetch con la misma interfaz que usa el núcleo:
   open, setRequestHeader, send, abort, onload/onerror/ontimeout y
   upload.onprogress (que en NS nunca llega: no hay progreso real). */

class XMLHttpRequest {
  constructor() {
    this.readyState = 0;
    this.status = 0;
    this.statusText = '';
    this.responseText = '';
    this.response = null;
    this.timeout = 0;
    /* En NS `upload` es el mismo objeto. */
    this.upload = this;
    this._headers = {};
    this._aborted = false;
  }

  open(method, url) {
    this._method = String(method || 'GET').toUpperCase();
    this._url = String(url);
    this.readyState = 1;
  }

  setRequestHeader(name, value) {
    this._headers[name] = value;
  }

  getResponseHeader() { return null; }

  abort() {
    this._aborted = true;
    if (typeof this.onabort === 'function') this.onabort();
  }

  send(body) {
    const opts = {
      method: this._method,
      headers: Object.assign({}, this._headers),
    };
    if (body !== undefined && body !== null) opts.body = body;
    let timer = null;
    if (this.timeout > 0) {
      timer = setTimeout(() => {
        if (this._aborted) return;
        this._aborted = true;
        if (typeof this.ontimeout === 'function') this.ontimeout();
      }, this.timeout);
    }
    fetch(this._url, opts).then(async (res) => {
      if (timer) clearTimeout(timer);
      if (this._aborted) return;
      const text = await res.text();
      this.status = res.status;
      this.responseText = text;
      this.readyState = 4;
      if (typeof this.onload === 'function') this.onload();
    }).catch((e) => {
      if (timer) clearTimeout(timer);
      if (this._aborted) return;
      if (typeof this.onerror === 'function') this.onerror(e);
    });
  }
}

globalThis.XMLHttpRequest = XMLHttpRequest;

export default XMLHttpRequest;
