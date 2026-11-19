<template>
  <!-- W109: buscar mensajes DENTRO del chat (como el SearchModal de la web).
       Overlay centrado: velo hermano + modal en la celda del medio, sin
       position:fixed ni z-index (NS9). Se monta tras ChatInfoView para
       que no lo tape, y el ChatView emite el salto. -->
  <GridLayout rows="*,auto,*" columns="*,auto,*" class="newchat">
    <StackLayout row="0" col="0" rowSpan="3" colSpan="3" class="modal-veil"
                 @tap="emit('close')" />

    <GridLayout row="1" col="1" class="modal search-modal" :width="modalW"
                rows="auto,*">
      <GridLayout row="0" class="pp-modal-head" columns="*,auto">
        <StackLayout col="0" orientation="horizontal"
                     verticalAlignment="center">
          <Label class="pp-modal-t" :text="t('Buscar en el chat')"
                 textWrap="false" />
        </StackLayout>
        <FoxIconBtn col="1" icon="x" bare :size="32" :ic="16" :tint="muted"
                    accessibilityLabel="cerrar búsqueda" @tap="emit('close')" />
      </GridLayout>

      <!-- cuerpo: pastilla + lista de resultados -->
      <ScrollView row="1" :height="bodyH">
        <StackLayout class="sp-body">
          <GridLayout class="search-pill" columns="auto,*,auto">
            <Image col="0" src="res://ic_fox_search" width="16" height="16"
                   :tintColor="muted" verticalAlignment="center" />
            <TextField ref="inputEl" col="1" class="m-search-input" :text="q"
                       :placeholder="t('Buscar mensajes')"
                       :placeholderColor="muted" autocorrect="false"
                       autocapitalizationType="none"
                       @textChange="onInput" />
            <FoxIconBtn v-if="q" col="2" icon="x" bare :size="24" :ic="12"
                        :tint="muted" accessibilityLabel="borrar"
                        @tap="clear" />
          </GridLayout>

          <template v-for="m in results" :key="m.id">
            <GridLayout class="sp-res" :accessibilityLabel="'resultado ' + (m.sender ? m.sender.username : '')"
                        @tap="jump(m)">
              <GridLayout columns="*,auto" class="spr-top">
                <Label class="spr-name"
                       :text="m.sender ? (m.sender.display_name || m.sender.username) : ''"
                       textWrap="false" />
                <Label class="spr-time" :text="time(m.created_at)"
                       textWrap="false" />
              </GridLayout>
              <Label class="spr-text" :text="snippet(m)" textWrap="true" />
            </GridLayout>
          </template>

          <Label v-if="err" class="sp-empty dim" :text="err" textWrap="true" />
          <Label v-else-if="busy" class="sp-empty dim"
                 :text="t('Buscando…')" textWrap="true" />
          <Label v-else-if="!q.trim()" class="sp-empty dim"
                 :text="t('Escribe para buscar en los mensajes de este chat.')"
                 textWrap="true" />
          <Label v-else-if="!results.length" class="sp-empty dim"
                 :text="t('Sin resultados.')" textWrap="true" />
        </StackLayout>
      </ScrollView>
    </GridLayout>
  </GridLayout>
</template>

<script setup lang="ts">
  /* W109: búsqueda de mensajes dentro del chat abierto.
     Port del SearchModal.js de la web (mismo orden de teclas t() y
     comportamiento: al tocar un resultado el modal NO se cierra). */
  import { ref, computed, onMounted, onUnmounted, nextTick } from 'nativescript-vue';
  import { Screen } from '@nativescript/core';
  import { store } from '../core/store.js';
  import { api, mergeMessages } from '../core/actions.js';
  import { t } from '../core/i18n.js';
  import { fmtTime } from '../fmt';
  import { tok } from '../fmt';
  import FoxIconBtn from '../components/FoxIconBtn.vue';

  const emit = defineEmits<{ close: []; jump: [any] }>();

  const q = ref('');
  const results = ref<any[]>([]);
  const busy = ref(false);
  const err = ref('');
  const inputEl = ref<any>(null);
  let timer: any = null;

  const theme = computed(() => store.theme);
  const muted = computed(() => tok(store.theme, 't2'));

  const modalW = computed(() => {
    try { return Math.min(460, Math.round(Screen.mainScreen.widthDIPs - 32)); }
    catch { return 328; }
  });

  /* cuerpo: filas de ~58 px + margen; tope 460 o 64 % de pantalla */
  const bodyH = computed(() => {
    const n = Math.max(1, results.value.length);
    let cap = 460;
    try { cap = Math.min(460, Math.round(Screen.mainScreen.heightDIPs * 0.64)); } catch { /* tope fijo */ }
    return Math.min(n * 58 + 20, cap);
  });

  onMounted(() => {
    nextTick(() => {
      const el: any = inputEl.value;
      const nv = el ? (el.nativeView || el) : null;
      if (nv && typeof nv.focus === 'function') nv.focus();
    });
  });

  const runSearch = async () => {
    const needle = q.value.trim();
    const cid = store.activeChatId;
    if (!needle) { results.value = []; err.value = ''; return; }
    busy.value = true; err.value = '';
    try {
      const r = await api('GET', '/chats/' + cid + '/search?q=' + encodeURIComponent(needle));
      if (cid === store.activeChatId && needle === q.value.trim()) {
        results.value = (r && r.messages) || [];
      }
    } catch (e: any) {
      err.value = (e && e.detail && t(e.detail)) || t('No se pudo buscar');
    } finally { busy.value = false; }
  };

  const onInput = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(runSearch, 300);
  };

  const clear = () => { q.value = ''; onInput(); };

  const snippet = (m: any) => {
    if (m.spoiler) return t('Spoiler');
    const b = (m.body || '').replace(/\s+/g, ' ').trim();
    return b.length > 90 ? b.slice(0, 90) + '…' : b;
  };

  const time = (ts: number) => fmtTime(new Date(ts * 1000));

  /* Saltar al resultado: el ChatView hace el before_seq + mergeMessages
     si no está cargado y centra la fila. */
  const jump = async (m: any) => {
    const cid = store.activeChatId;
    if (!cid || !m) return;
    const arr = store.msgs && store.msgs[cid];
    let found = false;
    if (arr) for (let i = 0; i < arr.length; i++) if (arr[i].id === m.id) { found = true; break; }
    if (!found) {
      try {
        const r = await api('GET', '/chats/' + cid + '/messages?before_seq=' + (m.seq + 1) + '&limit=50');
        mergeMessages(cid, (r && r.messages) || []);
      } catch { /* no se pudo cargar la ventana: se sigue con el salto si ya está */ }
    }
    /* avisa al padre (ChatView) para que centre la fila */
    emit('jump', m);
  };

  onUnmounted(() => { if (timer) clearTimeout(timer); });
</script>
