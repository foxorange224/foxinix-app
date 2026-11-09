<template>
  <!-- W103: lista de chats con la barra de 56px de la web en móvil
       (.side-head): marca, título, aviso de conexión, ＋, menú y mi
       avatar. Las filas son las .chat-item de Discord. -->
  <Page :class="'fox-' + theme" actionBarHidden="true">

    <GridLayout rows="auto,auto,*,auto" class="list-page">
      <!-- ---------- cabecera ---------- -->
      <GridLayout row="0" class="side-head" columns="auto,*,auto,auto,auto">
        <Image col="0" class="sh-mark" src="res://ic_fox_logo_mark"
               width="32" height="32" borderRadius="8" stretch="aspectFill"
               :tintColor="accent" />
        <Label col="1" class="sh-title" :text="listTitle" textWrap="false" />
        <StackLayout v-if="store.ws !== 'on'" col="2" class="ws-dot"
                     verticalAlignment="center" />
        <!-- W104: nombre para TalkBack (sin esto, el lector de pantalla
             no dice nada en estos botones de solo icono). -->
        <FoxIconBtn col="3" icon="plus" bare accessibilityLabel="people"
                    @tap="goPeople" />
        <FoxAvatar col="4" class="me-av" :src="meAvatar" :initial="meInitial"
                   :size="32" :dot="meDot" :ring="panelRing"
                   accessibilityLabel="settings" @tap="goSettings" />
      </GridLayout>

      <!-- ---------- buscador (como el .search-pill de la web) ---------- -->
      <GridLayout row="1" class="side-search" columns="auto,*,auto">
        <Image col="0" src="res://ic_fox_search" width="18" height="18"
               :tintColor="muted" verticalAlignment="center" />
        <TextField col="1" class="search-input" :text="q"
                   :hint="store.showArchived ? t('Buscar archivados') : t('Buscar chats y grupos')"
                   :placeholderColor="muted"
                   autocorrect="false" autocapitalizationType="none"
                   @textChange="onQuery" />
        <FoxIconBtn v-if="q" col="2" icon="x" bare :size="28" :ic="14"
                    :tint="muted" @tap="q = ''" />
      </GridLayout>

      <!-- ---------- lista ---------- -->
      <ScrollView row="2" ref="scroller">
        <StackLayout class="chat-list">
          <GridLayout
            v-for="c in chats"
            :key="c.id"
            class="chat-item"
            columns="auto,*"
            :accessibilityLabel="'chat: ' + titleOf(c)"
            @tap="open(c.id)"
          >
            <FoxAvatar
              col="0"
              :src="avatarOf(c)"
              :initial="initials(c)"
              :size="48"
              :dot="dotOf(c)"
              :ring="panelRing"
            />
            <GridLayout col="1" class="ci-col" rows="auto,auto"
                        columns="*,auto">
              <Label row="0" col="0" class="ci-name" :text="titleOf(c)"
                     textWrap="false" />
              <Label row="0" col="1" class="ci-time" :text="timeOf(c)"
                     textWrap="false" />
              <Label row="1" col="0" class="ci-prev" :text="previewOf(c)"
                     textWrap="false" />
              <Label v-if="unreadOf(c)" row="1" col="1" class="badge"
                     :text="String(unreadOf(c))" textWrap="false" />
            </GridLayout>
          </GridLayout>

          <Label v-if="!filtered.length && q" class="list-empty"
                 :text="t('Sin resultados')" textWrap="true" />
          <Label v-else-if="!filtered.length && loading" class="list-empty"
                 :text="t('Cargando chats…')" textWrap="true" />
          <Label v-else-if="!filtered.length && store.showArchived" class="list-empty"
                 :text="t('No hay chats archivados.')" textWrap="true" />
          <Label v-else-if="!filtered.length" class="list-empty"
                 :text="t('Todavía no tenés chats.')" textWrap="true" />
        </StackLayout>
      </ScrollView>

      <!-- ---------- aviso de conexión (tocable: recarga) ---------- -->
      <Label v-if="store.ws !== 'on'" row="3" class="ws-strip"
             :text="wsText" textWrap="true" @tap="refresh" />
    </GridLayout>
  </Page>
</template>

<script setup lang="ts">
  import { ref, computed, onMounted } from 'nativescript-vue';
  import { store } from '../core/store.js';
  import { loadChats, chatTitle, openChat, mediaUrl } from '../core/actions.js';
  import { startWS } from '../core/realtime.js';
  import { t } from '../core/i18n.js';
  import { fmtListTime, dotState, tok } from '../fmt';
  import { nativeLogout } from '../fox';
  import { goView } from '../nav';
  import FoxAvatar from '../components/FoxAvatar.vue';
  import FoxIconBtn from '../components/FoxIconBtn.vue';

  const loading = ref(true);
  const q = ref('');

  /* La lista vive en el store compartido: la carga y el orden son los
     del núcleo (los mismos que en la web). Los archivados van en su
     propia pestaña (como en la web). */
  const chats = computed(() => {
    const want = !!store.showArchived;
    return (store.chats || []).filter((c: any) => !!c.archived === want);
  });

  /* Filtro del buscador (como el filteredChats de la web): por nombre
     del chat o por usuario del DM. */
  const filtered = computed(() => {
    const s = q.value.trim().toLowerCase();
    if (!s) return chats.value;
    return chats.value.filter((c: any) => {
      const name = titleOf(c).toLowerCase();
      if (name.indexOf(s) >= 0) return true;
      const u = c.title && c.title.username;
      return !!u && String(u).toLowerCase().indexOf(s) >= 0;
    });
  });

  function onQuery(ev: any) {
    q.value = (ev && ev.value) || '';
  }

  const theme = computed(() => store.theme);

  const listTitle = computed(() =>
    store.showArchived ? t('Archivados') : t('Chats'));

  const accent = computed(() => tok(store.theme, 'accent'));
  const muted = computed(() => tok(store.theme, 't2'));

  /* Aro del puntito: el color de la superficie donde vive (el panel). */
  const panelRing = computed(() => tok(store.theme, 'panel'));

  /* Mi avatar en la barra (la web lo abre en el perfil). */
  const meAvatar = computed(() => {
    const u: any = store.user;
    return u && u.avatar_url ? mediaUrl(u.avatar_url) : '';
  });
  const meInitial = computed(() => {
    const u: any = store.user;
    const n = u && (u.display_name || u.username);
    return n ? String(n).charAt(0).toUpperCase() : '?';
  });
  const meDot = computed(() => dotState(store.user, store.ws === 'on'));

  const wsText = computed(() => {
    if (store.ws === 'connecting') return t('Conectando…');
    return t('Sin conexión — tirar para actualizar');
  });

  function titleOf(c: any): string {
    if (c.type === 'group') {
      const tt = c.title || {};
      return tt.display_name || tt.name || t('Grupo');
    }
    return chatTitle(c);
  }

  function initials(c: any): string {
    const name = titleOf(c).trim();
    return name ? name.charAt(0).toUpperCase() : '?';
  }

  /* Foto del chat (avatar del DM o el del grupo), ya con la firma del
     CDN puesta por mediaUrl(). */
  function avatarOf(c: any): string {
    if (!c) return '';
    const url = c.type === 'dm' ? (c.title && c.title.avatar_url) : c.avatar_url;
    return url ? mediaUrl(url) : '';
  }

  /* Puntito de estado: sólo los DM llevan usuario real. */
  function dotOf(c: any): string {
    return c.type === 'dm' ? dotState(c.title || null) : '';
  }

  function timeOf(c: any): string {
    const lm = c.last_message;
    if (!lm || !lm.created_at) return '';
    return fmtListTime(lm.created_at);
  }

  function unreadOf(c: any): number {
    return parseInt(c.unread, 10) || 0;
  }

  /* Previsualización: misma lógica que previewText() de la web. */
  function previewOf(c: any): string {
    const lm = c.last_message;
    if (!lm) return c.type === 'dm' ? t('Escribe para empezar') : t('Grupo nuevo');
    const mine = !!(lm.sender && store.user && lm.sender.id === store.user.id);
    let who = '';
    if (mine) who = t('Tú: ');
    else if (c.type === 'group' && lm.sender) {
      who = (lm.sender.display_name || lm.sender.username) + ': ';
    }
    if (lm.kind === 'system') return lm.body || '';
    if (lm.spoiler) return who + t('Spoiler');
    if (lm.kind === 'image') return who + t('Imagen');
    if (lm.kind === 'sticker') {
      return who + (lm.media ? t('Sticker') : (lm.body || ''));
    }
    if (lm.kind === 'voice') return who + t('Nota de voz');
    if (lm.kind === 'file') {
      return who + (lm.media && /^video\//.test(lm.media.mime || '')
        ? t('Video') : t('Archivo'));
    }
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

  /* Panel de personas: amigos, solicitudes y búsqueda. */
  function goPeople() {
    goView('people');
  }

  function goSettings() {
    goView('settings');
  }

  onMounted(async () => {
    await refresh();
    /* Tiempo real: el mismo realtime.js de la web (WebSocket por el
       adaptador de plataforma). */
    try { startWS(); } catch (e) { /* sin WS: se actualiza al abrir */ }
  });
</script>
