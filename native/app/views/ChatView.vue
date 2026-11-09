<template>
  <!-- W103: conversación con la cabecera de 56px de la web (.chat-head),
       las filas de mensaje con su columna de avatar (.msg) y el
       compositor redondo (.composer + .send-btn). -->
  <Page :class="'fox-' + theme">
    <ActionBar actionBarHidden="true" />

    <GridLayout rows="auto,*,auto" class="chat-page">
      <!-- ---------- cabecera ---------- -->
      <GridLayout row="0" class="chat-head" columns="auto,auto,*,auto">
        <FoxIconBtn col="0" icon="back" bare :tint="muted" @tap="back" />
        <FoxAvatar col="1" :src="peerAvatar" :initial="peerInitial"
                   :size="38" :dot="peerDot" :ring="chatRing" />
        <StackLayout col="2" class="ch-col">
          <Label class="ch-name" :text="title" textWrap="false" />
          <Label class="ch-status" :text="statusLine" textWrap="false" />
        </StackLayout>
        <Label v-if="store.ws !== 'on'" col="3" class="ws-pill"
               :text="wsLabel" textWrap="false" />
      </GridLayout>

      <!-- ---------- mensajes ---------- -->
      <ScrollView row="1" ref="scroller">
        <StackLayout class="msgs">
          <Label v-if="loading" class="msgs-load" text="Cargando mensajes…"
                 textWrap="true" />

          <template v-for="r in rows" :key="r.ref.id">
            <!-- separador de día -->
            <Label v-if="r.day" class="day-pill" :text="r.day" textWrap="false" />

            <!-- mensaje de sistema: centrado, sin columna -->
            <Label v-if="r.ref.kind === 'system'" class="sys-msg"
                   :text="r.ref.body" textWrap="true" />

            <!-- fila normal: [avatar ajeno] [burbuja] [avatar propio]
                 Las columnas de avatar miden 36px (28 de cara + 8 de
                 hueco), como en la web. -->
            <GridLayout v-else class="msg"
                        :class="{ tight: r.tight, mine: r.mine }"
                        columns="auto,*,auto">
              <!-- Columna de avatar del remitente: la web reserva los
                   mismos 36px aunque la cara no se vea, para que todas
                   las burbujas del remitente arranquen en la misma
                   línea. -->
              <StackLayout v-if="!r.mine" col="0" width="36">
                <FoxAvatar v-if="r.showAv" :src="avatarUrl(r.avatar)"
                           :initial="r.avatar ? r.avatar.ini : '?'" :size="28"
                           :ring="chatRing" flat />
              </StackLayout>

              <StackLayout col="1"
                           :horizontalAlignment="r.mine ? 'right' : 'left'">
                <Label v-if="r.showSender" class="b-sender"
                       :text="r.avatar ? r.avatar.name : ''" textWrap="false"
                       horizontalAlignment="left" />
                <StackLayout class="bubble" :class="{ mine: r.mine }"
                             :maxWidth="maxBubble">
                  <!-- W102: la imagen se ve DENTRO de la burbuja -->
                  <Image v-if="isImage(r.ref)" class="b-img"
                         :src="imgSrc(r.ref)" :width="imgSize(r.ref).w"
                         :height="imgSize(r.ref).h" stretch="aspectFit"
                         @tap="openImage(r.ref)" />
                  <Label v-if="bodyOf(r.ref)" class="b-body"
                         :class="{ 'on-me': r.mine }" :text="bodyOf(r.ref)"
                         textWrap="true" horizontalAlignment="stretch" />
                  <Label v-if="r.showTime || r.ref.pending" class="b-meta"
                         :class="{ 'on-me': r.mine }" :text="timeOf(r.ref)"
                         textWrap="false" />
                </StackLayout>
              </StackLayout>

              <!-- avatar propio: a la derecha, como en la web -->
              <StackLayout v-if="r.mine" col="2" width="36">
                <FoxAvatar v-if="r.showTime" :src="myAvatar"
                           :initial="myInitial" :size="28" marginLeft="8"
                           :ring="chatRing" flat />
              </StackLayout>
            </GridLayout>
          </template>

          <!-- "escribiendo…" (mismo aviso que en la web) -->
          <GridLayout v-if="typingActive" class="msg" columns="auto,*,auto">
            <StackLayout col="0" width="36">
              <FoxAvatar :src="peerAvatar" :initial="peerInitial" :size="28"
                         :ring="chatRing" flat />
            </StackLayout>
            <Label col="1" class="sys-msg" text="escribiendo…"
                   horizontalAlignment="left" textWrap="false" />
            <StackLayout col="2" width="36" />
          </GridLayout>
        </StackLayout>
      </ScrollView>

      <!-- ---------- compositor ---------- -->
      <GridLayout row="2" class="composer" columns="auto,*,auto">
        <FoxIconBtn col="0" class="composer-attach" icon="clip" bare
                    :tint="muted" @tap="attach" />
        <TextField col="1" class="composer-input" :text="draft"
                   hint="Mensaje" autocorrect="true" :editable="!sending"
                   @textChange="draft = $event.value" @submit="send"
                   returnKeyType="send" />
        <FoxIconBtn col="2" class="send-btn" icon="send"
                    :class="{ muted: !canSend }" :tint="sendTint"
                    @tap="send" />
      </GridLayout>
    </GridLayout>
  </Page>
</template>

<script setup lang="ts">
  import { ref, computed, onMounted, watch } from 'nativescript-vue';
  import { Screen } from '@nativescript/core';
  import { store, toast } from '../core/store.js';
  import {
    openChat, sendText, closeChat, sendMedia, mediaUrl,
  } from '../core/actions.js';
  import { t } from '../core/i18n.js';
  import { dayKey, dayLabel, fmtTime, connLine, dotState, tok } from '../fmt';
  import { pickFile } from '../files';
  import { imageBox, imageUrl, isImageMsg } from '../img';
  import { openMedia } from '../nav';
  import FoxAvatar from '../components/FoxAvatar.vue';
  import FoxIconBtn from '../components/FoxIconBtn.vue';

  const draft = ref('');
  const sending = ref(false);
  const sendingFile = ref(false);
  const loading = ref(true);
  const scroller = ref<any>(null);

  const chat = computed(() => {
    const id = store.activeChatId;
    for (const c of store.chats || []) if (c.id === id) return c;
    return null;
  });

  const theme = computed(() => store.theme);

  /* Colores que dependen del tema. */
  const muted = computed(() => tok(store.theme, 't2'));
  const chatRing = computed(() => tok(store.theme, 'chatBg'));
  /* Icono del enviar: oscuro sobre el naranja (on-accent); apagado cuando
     no se puede enviar. */
  const sendTint = computed(() => {
    if (!canSend.value) return muted.value;
    return tok(store.theme, 'onAccent');
  });

  const title = computed(() => {
    const c = chat.value;
    if (!c) return 'Chat';
    if (c.type === 'group') {
      const tt = c.title || {};
      return tt.display_name || tt.name || t('Grupo');
    }
    const tt = c.title || {};
    return tt.display_name || tt.username || 'Chat';
  });

  const chatType = computed(() => (chat.value && chat.value.type) || 'dm');

  /* Foto / letra del peer (o del grupo). */
  const peerAvatar = computed(() => {
    const c: any = chat.value;
    if (!c) return '';
    const url = c.type === 'dm' ? (c.title && c.title.avatar_url) : c.avatar_url;
    return url ? mediaUrl(url) : '';
  });
  const peerInitial = computed(() =>
    title.value ? title.value.charAt(0).toUpperCase() : '?');
  const peerDot = computed(() => {
    const c: any = chat.value;
    return c && c.type === 'dm' ? dotState(c.title || null) : '';
  });
  const myAvatar = computed(() => {
    const u: any = store.user;
    return u && u.avatar_url ? mediaUrl(u.avatar_url) : '';
  });
  const myInitial = computed(() => {
    const u: any = store.user;
    const n = u && (u.display_name || u.username);
    return n ? String(n).charAt(0).toUpperCase() : '?';
  });

  /* Línea de estado: "escribiendo…", participantes o última vez. */
  const statusLine = computed(() => {
    const c: any = chat.value;
    if (!c) return '';
    if (typingActive.value) return t('escribiendo…');
    if (c.type === 'group') {
      const n = c.member_count || 0;
      return t('{n} participante{p}', { n: n, p: n === 1 ? '' : 's' });
    }
    return connLine(c.title || null);
  });

  const wsLabel = computed(() =>
    store.ws === 'connecting' ? t('Conectando…') : t('Sin conexión'));

  /* ¿Hay alguien escribiendo en este chat? (excluyo mi usuario) */
  const typingActive = computed(() => {
    const bag = (store.typing || {})[store.activeChatId] || {};
    const meId = store.user && store.user.id;
    for (const k in bag) if (String(k) !== String(meId)) return true;
    return false;
  });

  const messages = computed(() => {
    const id = store.activeChatId;
    return (store.msgs && store.msgs[id]) || [];
  });

  const canSend = computed(() => !!draft.value.trim() && !sending.value);

  /* Tope de la burbuja: 88% del ancho útil, como en la web. */
  const maxBubble = computed(() =>
    Math.round((Screen.mainScreen.widthDIPs - 24) * 0.88));

  function isMine(m: any): boolean {
    return !!(store.user && m.sender && m.sender.id === store.user.id);
  }

  /* Filas: misma lógica que rows() de chat-shell.js (tanda apretada,
     hora sólo al final del minuto, nombre del emisor, columna de
     avatar y separador de día). */
  const rows = computed(() => {
    const arr = messages.value;
    const out: any[] = [];
    const isGroup = chatType.value === 'group';
    const meId = store.user && store.user.id;
    let prevDay: string | null = null;
    for (let i = 0; i < arr.length; i++) {
      const m = arr[i];
      const p = i > 0 ? arr[i - 1] : null;
      const n = i + 1 < arr.length ? arr[i + 1] : null;
      const d = new Date(m.created_at * 1000);
      const dk = dayKey(d);
      const mine = !!(m.sender && meId && m.sender.id === meId);
      const sameSender = !!(p && p.sender && m.sender
        && p.sender.id === m.sender.id);
      const tight = !!(p && sameSender && dk === prevDay
        && m.kind !== 'system' && p.kind !== 'system'
        && m.created_at - p.created_at < 600);
      const sameRun = !!(n && n.sender && m.sender
        && n.sender.id === m.sender.id && n.kind !== 'system'
        && m.kind !== 'system');
      const showTime = !sameRun
        || Math.floor(n.created_at / 60) !== Math.floor(m.created_at / 60);
      const withName = isGroup && !mine && m.kind !== 'system'
        && !!m.sender && (!tight || !!m.reply_to);
      /* La cara se ve en la primera fila de la tanda (donde aparece el
         nombre) y en la última del minuto (donde aparece la hora); en
         los mensajes propios, cuando aparece la hora. */
      const showAv = m.kind !== 'system'
        && (mine ? showTime : (showTime || withName));
      out.push({
        ref: m,
        day: dk !== prevDay ? dayLabel(d) : null,
        tight: tight,
        mine: mine,
        avCol: m.kind !== 'system',
        showAv: showAv,
        avatar: m.sender ? {
          url: m.sender.avatar_url || '',
          ini: (m.sender.display_name || m.sender.username || '?')
            .charAt(0).toUpperCase(),
          name: m.sender.display_name || m.sender.username || '',
        } : null,
        showSender: withName,
        showTime: showTime,
      });
      prevDay = dk;
    }
    return out;
  });

  function avatarUrl(a: any): string {
    return a && a.url ? mediaUrl(a.url) : '';
  }

  function senderName(m: any): string {
    const s = m.sender || {};
    return s.display_name || s.username || '';
  }

  function bodyOf(m: any): string {
    if (m.kind === 'voice') {
      const d = m.dur ? Math.round(m.dur) + ' s' : '';
      return '🎤 Nota de voz' + (d ? ' · ' + d : '');
    }
    if (m.kind === 'image') {
      /* W102: la imagen se ve dentro de la burbuja; aquí va sólo el pie
         de foto (si lo hay). Sin media todavía (subida en curso) se avisa
         con un texto, para que la burbuja no quede vacía. */
      if (isImageMsg(m)) return m.body || '';
      return '🖼 Enviando imagen…';
    }
    if (m.kind === 'video') return '🎬 Video';
    if (m.kind === 'file') return '📎 Archivo';
    if (m.kind === 'sticker') return 'Sticker';
    return m.body || '';
  }

  /* --- W102: la imagen dentro de la burbuja --- */

  function isImage(m: any): boolean {
    return isImageMsg(m);
  }

  /* La miniatura del server (pesa poco y se ve igual de chica). */
  function imgSrc(m: any): string {
    return imageUrl(m, true);
  }

  /* La caja: conserva la proporción real que manda el server. */
  function imgSize(m: any): { w: number; h: number } {
    return imageBox(m);
  }

  /* Al tocarla se abre a pantalla completa (el original). */
  function openImage(m: any) {
    const u = imageUrl(m, false);
    if (!u) {
      toast('No se pudo abrir la imagen', 'err');
      return;
    }
    openMedia(u, m.body || '');
  }

  function timeOf(m: any): string {
    if (!m.created_at) return '';
    return fmtTime(new Date(m.created_at * 1000));
  }

  function scrollToEnd() {
    try {
      if (scroller.value) scroller.value.scrollToBottom();
    } catch (e) { /* el ScrollView puede no estar listo */ }
  }

  async function send() {
    const text = draft.value.trim();
    if (!text || sending.value) return;
    sending.value = true;
    try {
      await sendText(store.activeChatId, text);
      draft.value = '';
      await new Promise((r) => setTimeout(r, 120));
      scrollToEnd();
    } catch (e: any) {
      /* El núcleo muestra el error con toast; acá se deja el texto para
         reintentar. */
    } finally {
      sending.value = false;
    }
  }

  /* Adjuntar un archivo: el selector nativo del sistema. El núcleo
     sube el archivo (multipart) y manda el mensaje; la burbuja
     "pendiente" sale ya y se reemplaza cuando el server responde. */
  async function attach() {
    if (sendingFile.value) return;
    sendingFile.value = true;
    try {
      const f = await pickFile();
      if (!f) return;
      const kind = (f.type || '').indexOf('image/') === 0 ? 'image' : 'file';
      await sendMedia(store.activeChatId, f as any, kind);
    } catch (e: any) {
      toast((e && e.detail) || 'No se pudo enviar el archivo', 'err');
    } finally {
      sendingFile.value = false;
    }
  }

  function back() {
    closeChat();
  }

  onMounted(async () => {
    await openChat(store.activeChatId);
    loading.value = false;
    await new Promise((r) => setTimeout(r, 150));
    scrollToEnd();
  });

  /* Al llegar mensajes nuevos (por WebSocket) se baja al final. */
  watch(() => messages.value.length, async (n) => {
    if (!n) return;
    await new Promise((r) => setTimeout(r, 80));
    scrollToEnd();
  });
</script>
