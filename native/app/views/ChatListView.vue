<template>
  <Page>
    <ActionBar title="Chats">
      <ActionItem text="Personas" @tap="goPeople" ios.position="right" />
      <ActionItem text="Salir" @tap="doLogout" ios.position="right" />
    </ActionBar>

    <GridLayout rows="*,auto">
      <ScrollView ref="scroller">
        <StackLayout>
          <GridLayout
            v-for="c in chats"
            :key="c.id"
            class="fox-row"
            columns="auto,*,auto"
            rows="auto,auto"
            @tap="open(c.id)"
          >
            <!-- avatar -->
            <Label
              class="fox-avatar"
              row="0"
              col="0"
              rowspan="2"
              :text="initials(c)"
              :backgroundColor="c.pinned ? '#ff751f' : '#16232c'"
            />
            <!-- título -->
            <Label class="fox-row-title" row="0" col="1" :text="titleOf(c)" textWrap="true" />
            <!-- hora -->
            <Label class="fox-row-time" row="0" col="2" :text="timeOf(c)" />
            <!-- previsualización -->
            <Label class="fox-row-sub" row="1" col="1" colSpan="2" :text="previewOf(c)" textWrap="true" />
          </GridLayout>

          <Label v-if="!chats.length && loading" class="fox-empty" text="Cargando chats…" />
          <Label v-else-if="!chats.length" class="fox-empty" text="Todavía no tenés chats." />
        </StackLayout>
      </ScrollView>

      <!-- conexión en vivo -->
      <Label class="fox-ws" row="1" :text="wsText" />
    </GridLayout>
  </Page>
</template>

<script setup lang="ts">
  import { ref, computed, onMounted } from 'nativescript-vue';
  import { store } from '../core/store.js';
  import { loadChats, chatTitle, openChat } from '../core/actions.js';
  import { startWS } from '../core/realtime.js';
  import { nativeLogout } from '../fox';
  import { goView } from '../nav';

  const loading = ref(true);

  /* La lista vive en el store compartido: la carga y el orden son los
     del núcleo (los mismos que en la web). */
  const chats = computed(() => store.chats || []);

  const wsText = computed(() => {
    if (store.ws === 'on') return 'En línea';
    if (store.ws === 'connecting') return 'Conectando…';
    return 'Sin conexión — tirar para actualizar';
  });

  function initials(c: any): string {
    const t = titleOf(c).trim();
    if (!t) return '?';
    const parts = t.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return t.slice(0, 2).toUpperCase();
  }

  function titleOf(c: any): string {
    if (c.type === 'group') {
      const t = c.title || {};
      return t.display_name || 'Grupo';
    }
    return chatTitle(c);
  }

  function timeOf(c: any): string {
    const lm = c.last_message;
    if (!lm || !lm.created_at) return '';
    const d = new Date(lm.created_at * 1000);
    const now = new Date();
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    const sameDay = d.getDate() === now.getDate()
      && d.getMonth() === now.getMonth()
      && d.getFullYear() === now.getFullYear();
    if (sameDay) return hh + ':' + mm;
    return (d.getMonth() + 1) + '/' + d.getDate();
  }

  function previewOf(c: any): string {
    const lm = c.last_message;
    if (!lm) return c.type === 'group' ? 'Grupo nuevo' : 'Escribí para empezar';
    if (lm.kind === 'system') return lm.body || '';
    const mine = store.user && lm.sender && lm.sender.id === store.user.id;
    const who = mine ? 'Tú: ' : (c.type === 'group' && lm.sender
      ? ((lm.sender.display_name || lm.sender.username) + ': ') : '');
    if (lm.kind === 'voice') return who + '🎤 Nota de voz';
    if (lm.kind === 'image') return who + '🖼 Imagen';
    if (lm.kind === 'video') return who + '🎬 Video';
    if (lm.kind === 'file') return who + '📎 Archivo';
    if (lm.kind === 'sticker') return who + 'Sticker';
    return who + (lm.body || '');
  }

  async function refresh() {
    loading.value = true;
    try {
      await loadChats();
    } finally {
      loading.value = false;
    }
  }

  function open(id: number) {
    openChat(id);
  }

  function doLogout() {
    nativeLogout();
  }

  /* Panel de personas: amigos, solicitudes y búsqueda. */
  function goPeople() {
    goView('people');
  }

  onMounted(async () => {
    await refresh();
    /* Tiempo real: el mismo realtime.js de la web (WebSocket por el
       adaptador de plataforma). */
    try { startWS(); } catch (e) { /* sin WS: se actualiza al abrir */ }
  });
</script>

<style>
.fox-row {
  padding: 12 16;
  border-bottom-width: 1;
  border-bottom-color: #1d2b34;
}

.fox-avatar {
  width: 46;
  height: 46;
  border-radius: 23;
  color: #e8edf2;
  font-size: 16;
  font-weight: 600;
  text-align: center;
  vertical-align: center;
  margin-right: 12;
}

.fox-row-title {
  color: #e8edf2;
  font-size: 16;
  font-weight: 600;
  vertical-align: center;
}

.fox-row-time {
  color: #7d909c;
  font-size: 12;
  vertical-align: center;
  margin-left: 8;
}

.fox-row-sub {
  color: #8aa0ad;
  font-size: 13;
  vertical-align: center;
}

.fox-empty {
  color: #8aa0ad;
  text-align: center;
  margin-top: 40;
  font-size: 15;
}

.fox-ws {
  color: #7d909c;
  font-size: 12;
  text-align: center;
  padding: 4;
}
</style>
