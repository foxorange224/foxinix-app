/* uistate.js — estado de UI puramente nativo (no pertenece al núcleo
   compartido, que es el mismo código de la web y se regenera con
   sync-core.mjs). Aquí viven los flags de modales que solo la app
   nativa usa, para que fox.ts y las vistas los lean sin tocar
   app/core/store.js. */
import Vue from './core/vue.js';
const { reactive } = Vue;

export const ui = reactive({
  /* chat-more ⋮ (W110): menú de cabecera del chat. */
  chatMenuOpen: false,
});
