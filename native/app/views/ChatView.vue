<template>
  <!-- W103: conversación con la cabecera de 56px de la web (.chat-head),
       las filas de mensaje con su columna de avatar (.msg) y el
       compositor redondo (.composer + .send-btn). -->
  <Page :class="'fox-' + theme" actionBarHidden="true">

    <GridLayout rows="auto,*,auto,auto" class="chat-page">
      <!-- ---------- cabecera ---------- -->
      <GridLayout row="0" class="chat-head" columns="auto,auto,*,auto">
        <FoxIconBtn col="0" icon="back" bare :tint="muted"
                    accessibilityLabel="back" @tap="back" />
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
          <Label v-if="loading" class="msgs-load" :text="t('Cargando mensajes…')"
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
                <!-- W105: mantener pulsado el mensaje abre la hoja de
                     acciones (responder, reaccionar, copiar, fijar,
                     reenviar, editar, eliminar). -->
                <StackLayout class="bubble" :class="{ mine: r.mine }"
                             :maxWidth="maxBubble"
                             @longPress="openSheet(r.ref)">
                  <!-- W105: la cita del mensaje al que se responde -->
                  <GridLayout v-if="r.ref.reply_to" class="b-reply"
                              columns="auto,*">
                    <Label col="0" class="br-bar" />
                    <StackLayout col="1" class="br-col">
                      <Label class="br-name" :text="replyName(r.ref)"
                             textWrap="false" />
                      <Label class="br-text" :text="replyText(r.ref)"
                             textWrap="false" />
                    </StackLayout>
                  </GridLayout>
                  <!-- W102: la imagen se ve DENTRO de la burbuja -->
                  <Image v-if="isImage(r.ref)" class="b-img"
                         :src="imgSrc(r.ref)" :width="imgSize(r.ref).w"
                         :height="imgSize(r.ref).h" stretch="aspectFit"
                         @tap="openImage(r.ref)" />
                  <!-- W104: el reproductor. La onda tiene ancho FIJO
                       (110px): con una columna "*" el GridLayout se
                       estiraba y la burbuja quedaba demasiado ancha. -->
                  <GridLayout v-if="isVoice(r.ref)" class="b-player"
                              :class="{ 'on-me': r.mine }"
                              columns="auto,110,auto">
                    <FoxIconBtn col="0" class="au-btn"
                                :icon="voicePlaying(r.ref) ? 'pause' : 'play'"
                                :size="32" :ic="16" :tint="voiceTint(r.mine)"
                                :bare="true"
                                accessibilityLabel="play voice message"
                                @tap="toggleVoice(r.ref)" />
                    <GridLayout col="1" class="au-wave" :columns="waveCols"
                                verticalAlignment="center">
                      <Label v-for="(h, i) in waveOf(r.ref)" :key="i" :col="i"
                             text="" textWrap="false" class="au-wave-bar"
                             :class="{ on: i <= waveBar(r.ref) }"
                             :height="h" horizontalAlignment="center"
                             verticalAlignment="center" />
                    </GridLayout>
                    <Label col="2" class="au-time" :text="voiceTime(r.ref)"
                           textWrap="false" />
                  </GridLayout>
                  <Label v-if="bodyOf(r.ref)" class="b-body"
                         :class="{ 'on-me': r.mine }" :text="bodyOf(r.ref)"
                         textWrap="true" horizontalAlignment="stretch" />
                  <Label v-if="r.showTime || r.ref.pending" class="b-meta"
                         :class="{ 'on-me': r.mine }" :text="timeOf(r.ref)"
                         textWrap="false" />
                </StackLayout>
                <!-- W105: las reacciones, bajo la burbuja (como en la
                     web: una píldora por emoji, con el conteo). -->
                <GridLayout v-if="reactsOf(r.ref).length" class="b-reacts"
                            :columns="reactColsOf(r.ref)"
                            :horizontalAlignment="r.mine ? 'right' : 'left'">
                  <GridLayout v-for="(rr, i) in reactsOf(r.ref)" :key="i"
                              :col="i" class="react-chip"
                              :class="{ mine: myReaction(r.ref) === rr.emoji }"
                              columns="auto,auto"
                              @tap="react(r.ref, rr.emoji)">
                    <Label col="0" class="rc-emo" :text="rr.emoji"
                           textWrap="false" />
                    <Label v-if="rr.count > 1" col="1" class="rc-n"
                           :text="String(rr.count)" textWrap="false" />
                  </GridLayout>
                </GridLayout>
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
            <Label col="1" class="sys-msg" :text="t('escribiendo…')"
                   horizontalAlignment="left" textWrap="false" />
            <StackLayout col="2" width="36" />
          </GridLayout>
        </StackLayout>
      </ScrollView>

      <!-- ---------- compositor ---------- -->
      <!-- W104: el botón del micrófono graba una nota de voz; mientras
           se graba, el composer se sustituye por la barra de grabación
           (punto + tiempo + onda + cancelar + enviar), como en la web.
           W105: arriba del composer va la barra de respuesta (o de
           edición), como el .reply-bar de la web.
           W106: el botón de la carita abre el selector de
           emojis/stickers/GIFs (fila 2, justo arriba del compositor). -->
      <GridLayout v-if="rec === 'off'" row="3" class="composer"
                  rows="auto,auto" columns="auto,*,auto,auto,auto">
        <!-- W105: a quién se responde (o qué se está editando) -->
        <GridLayout v-if="replyFor || editFor" row="0" col="0" colSpan="5"
                    class="reply-bar" columns="auto,*,auto">
          <Image col="0" class="rb-ic" :src="barIcon"
                 :tintColor="accentColor" stretch="aspectFit" />
          <StackLayout col="1" class="rb-col">
            <Label class="rb-name" :text="barTitle" textWrap="false" />
            <Label class="rb-text" :text="barText" textWrap="false" />
          </StackLayout>
          <FoxIconBtn col="2" class="rb-x" icon="x" bare :tint="muted"
                      accessibilityLabel="cancel reply" @tap="cancelBar" />
        </GridLayout>
        <FoxIconBtn row="1" col="0" class="composer-attach" icon="clip" bare
                    :tint="muted" @tap="attach" />
        <TextField row="1" col="1" class="composer-input" :text="draft"
                   :hint="t('Mensaje')" autocorrect="true" :editable="!sending"
                   @textChange="draft = $event.value" @submit="send"
                   returnKeyType="send" />
        <!-- W106: la carita abre el selector de 3 pestañas -->
        <FoxIconBtn row="1" col="2" class="composer-emo" icon="smile" bare
                    :active="pickerOpen"
                    :tint="pickerOpen ? accentColor : muted"
                    accessibilityLabel="emojis" @tap="togglePicker" />
        <FoxIconBtn v-if="!draft.trim()" row="1" col="3" class="composer-mic"
                    icon="mic" bare :tint="muted"
                    accessibilityLabel="voice message" @tap="startRec" />
        <FoxIconBtn row="1" col="4" class="send-btn" icon="send"
                    :class="{ muted: !canSend }" :tint="sendTint"
                    accessibilityLabel="send" @tap="send" />
      </GridLayout>

      <GridLayout v-else row="3" class="composer rec-bar"
                  columns="auto,auto,90,auto,auto">
        <Label col="0" class="rec-dot" text="" textWrap="false"
               verticalAlignment="center" />
        <Label col="1" class="rec-time" :text="recTime" textWrap="false" />
        <GridLayout col="2" class="rec-wave" :columns="recCols"
                    verticalAlignment="center">
          <Label v-for="(h, i) in recBars" :key="i" :col="i"
                 text="" textWrap="false" class="rec-wave-bar" :height="h"
                 horizontalAlignment="center" verticalAlignment="center" />
        </GridLayout>
        <FoxIconBtn col="3" class="rec-cancel" icon="x" bare
                    :tint="muted" accessibilityLabel="cancel voice message"
                    @tap="cancelRec" />
        <FoxIconBtn col="4" class="send-btn rec-send" icon="send"
                    :tint="sendTint" accessibilityLabel="send voice message"
                    @tap="stopRec(true)" />
      </GridLayout>

      <!-- ---------- W106: selector de emojis/stickers/GIFs ----------
           Va en su propia fila (la 2), JUSTO arriba del compositor: en
           NS no hay position:fixed ni z-index, así que el panel no
           flota; ocupa su fila y el compositor sigue a la vista. -->
      <EmojiPanel v-if="pickerOpen" row="2" @pick="insertEmoji" @close="closePicker" />

      <!-- ---------- W105: hoja de acciones del mensaje ----------
           Es la ÚLTIMA hija del GridLayout de la página: en NS no hay
           z-index, así que lo que va después se dibuja encima. Cubre
           todas las filas (cabecera, mensajes, selector y compositor). -->
      <MsgSheet v-if="sheetFor" row="0" rowSpan="4"
                :msg="sheetFor" :mine="isMine(sheetFor)"
                :admin="isAdmin" :pinned="!!sheetFor.pinned"
                @close="closeSheet" @reply="doReply" @react="doReact"
                @copy="doCopy" @pin="doPin" @forward="doForward"
                @edit="doEdit" @delete="doDelete" />
    </GridLayout>
  </Page>
</template>

<script setup lang="ts">
  import { ref, computed, onMounted, onUnmounted, watch } from 'nativescript-vue';
  import { Dialogs, Screen } from '@nativescript/core';
  import { store, toast } from '../core/store.js';
  import {
    openChat, sendText, closeChat, sendMedia, mediaUrl,
    toggleReaction, togglePin, editMessage,
  } from '../core/actions.js';
  import { t } from '../core/i18n.js';
  import { dayKey, dayLabel, fmtTime, connLine, dotState, tok } from '../fmt';
  import { pickFile } from '../files';
  import { imageBox, imageUrl, isImageMsg } from '../img';
  import { openMedia, openForward } from '../nav';
  import { deleteMessage } from '../msgactions';
  import { DomAdapter } from '../core/platform/index.js';
  import {
    canRecord, cancelRecording, currentVoiceTime, micLevel, onVoiceState,
    startRecording, stopRecording, stopVoice, toggleVoice as toggleVoicePlay,
  } from '../voice';
  import FoxAvatar from '../components/FoxAvatar.vue';
  import FoxIconBtn from '../components/FoxIconBtn.vue';
  import MsgSheet from '../components/MsgSheet.vue';
  import EmojiPanel from '../components/EmojiPanel.vue';

  const draft = ref('');
  const sending = ref(false);
  const sendingFile = ref(false);
  const loading = ref(true);
  const scroller = ref<any>(null);
  /* W106: el selector de emojis/stickers/GIFs (3 pestañas, como la web). */
  const pickerOpen = ref(false);

  /* ---------- W104: notas de voz ---------- */

  const rec = ref<'off' | 'on'>('off');
  const recSecs = ref(0);
  /* Onda en vivo: los últimos niveles (0..100), como los 22 picos de
     la web. */
  const REC_WAVE_N = 22;
  const recWave = ref<number[]>([]);
  let recTimer: any = null;
  let recPeaks: number[] = [];
  let recPeakTimer: any = null;
  /* OJO: en NativeScript los setInterval se ejecutan en el hilo de la
     interfaz: si el hilo se bloquea, las llamadas pendientes se
     acumulan y saltan todas juntas. Por eso el tiempo se mide con el
     reloj (Date.now) y no contando ticks. */
  let recStart = 0;

  /* Estado del reproductor (lo cuenta voice.ts). */
  const voiceState = ref<any>({ id: 0, playing: false, current: 0, duration: 0 });
  let voiceTick: any = null;

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
      /* W104: si hay media, la burbuja muestra el reproductor (no hace
         falta el texto); si todavía no hay media, se avisa. */
      if (m.media) return m.body || '';
      return '🎤 ' + t('Enviando nota de voz…');
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

  /* ---------- W105: acciones del mensaje ---------- */

  /* El mensaje al que se le pidió acción (la hoja abierta). */
  const sheetFor = ref<any>(null);
  /* El mensaje al que se responde (barra del compositor). */
  const replyFor = ref<any>(null);
  /* El mensaje que se está editando (barra del compositor). */
  const editFor = ref<any>(null);

  const accentColor = computed(() => tok(store.theme, 'accent'));

  /* ¿Soy owner o admin del grupo? (puedo borrar el mensaje de otro) */
  const isAdmin = computed(() => {
    const c: any = chat.value;
    return !!(c && c.type === 'group'
      && (c.my_role === 'owner' || c.my_role === 'admin'));
  });

  /* Mantener pulsado el mensaje abre la hoja de acciones. */
  function openSheet(m: any) {
    if (!m || m.kind === 'system') return;
    sheetFor.value = m;
  }

  function closeSheet() {
    sheetFor.value = null;
  }

  /* Las reacciones del mensaje, agrupadas por emoji (como la web). */
  function reactsOf(m: any): { emoji: string; count: number }[] {
    const rs = (m && m.reactions) || [];
    const out: { emoji: string; count: number }[] = [];
    for (const r of rs) {
      let g: any = null;
      for (const o of out) if (o.emoji === r.emoji) g = o;
      if (g) g.count++;
      else out.push({ emoji: r.emoji, count: 1 });
    }
    return out;
  }

  /* Mi reacción en este mensaje (el server guarda una por usuario). */
  function myReaction(m: any): string {
    const uid = store.user && store.user.id;
    const rs = (m && m.reactions) || [];
    for (const r of rs) if (r.user_id === uid) return r.emoji;
    return '';
  }

  /* Una columna por píldora de reacción. */
  function reactColsOf(m: any): string {
    return reactsOf(m).map(() => 'auto').join(',');
  }

  /* Poner o quitar una reacción (si ya era la misma, la quita). */
  async function react(m: any, emoji: string) {
    closeSheet();
    if (!m || !emoji) return;
    try {
      await toggleReaction(store.activeChatId, m.id, emoji);
    } catch (e: any) {
      toast((e && e.detail) || t('No se pudo reaccionar'), 'err');
    }
  }

  /* W105: la hoja de acciones manda una reacción rápida. */
  function doReact(emoji: string) {
    const m = sheetFor.value;
    if (!m) return;
    react(m, emoji);
  }

  /* El texto que resume un mensaje (para las citas). */
  function previewOf(rp: any): string {
    if (!rp) return '';
    /* Citar un spoiler no lo destapa. */
    if (rp.spoiler) return t('Spoiler');
    const txt = rp.body || '';
    if (txt) return txt.length > 90 ? txt.slice(0, 90) + '…' : txt;
    if (rp.kind === 'voice') return t('Nota de voz');
    if (rp.kind === 'image') return t('Imagen');
    if (rp.kind === 'system') return '';
    return t('Archivo adjunto');
  }

  /* Quién escribió el mensaje citado. */
  function replyName(m: any): string {
    const rp = m && m.reply_to;
    if (!rp || !rp.sender) return '';
    if (typeof rp.sender === 'string') return rp.sender;
    return rp.sender.display_name || rp.sender.username || '';
  }

  /* El texto del mensaje citado. */
  function replyText(m: any): string {
    return previewOf(m && m.reply_to);
  }

  /* La barra del compositor: responde o edita. */
  const barTitle = computed(() => {
    if (editFor.value) return t('Editando mensaje');
    const s = replyFor.value && replyFor.value.sender;
    if (!s) return t('Responder');
    if (typeof s === 'string') return s;
    return s.display_name || s.username || t('Responder');
  });

  const barText = computed(() => {
    if (editFor.value) return previewOf(editFor.value);
    return previewOf(replyFor.value);
  });

  const barIcon = computed(() =>
    'res://ic_fox_' + (editFor.value ? 'pencil' : 'reply'));

  /* --- las acciones de la hoja --- */

  function doReply() {
    const m = sheetFor.value;
    closeSheet();
    if (!m) return;
    replyFor.value = m;
    editFor.value = null;
  }

  function doCopy() {
    const m = sheetFor.value;
    closeSheet();
    if (!m || !m.body) return;
    if (DomAdapter.copyToClipboard(m.body)) {
      toast(t('Mensaje copiado'));
    } else {
      toast(t('No se pudo copiar el texto'), 'err');
    }
  }

  async function doPin() {
    const m = sheetFor.value;
    closeSheet();
    if (!m) return;
    try {
      await togglePin(store.activeChatId, m.id, !m.pinned);
    } catch (e: any) {
      toast((e && e.detail) || t('No se pudo fijar el mensaje'), 'err');
    }
  }

  function doForward() {
    const m = sheetFor.value;
    closeSheet();
    if (!m) return;
    openForward(m, store.activeChatId);
  }

  function doEdit() {
    const m = sheetFor.value;
    closeSheet();
    if (!m) return;
    editFor.value = m;
    replyFor.value = null;
    draft.value = m.body || '';
  }

  async function doDelete() {
    const m = sheetFor.value;
    closeSheet();
    if (!m) return;
    let ok = false;
    try {
      ok = await Dialogs.confirm({
        title: t('Eliminar mensaje'),
        message: t('Se borra el mensaje para ti y para todos los del chat.\nEsta acción no se puede deshacer.'),
        okButtonText: t('Eliminar'),
        cancelButtonText: t('Cancelar'),
      });
    } catch (e) { ok = false; }
    if (!ok) return;
    await deleteMessage(store.activeChatId, m.id);
  }

  /* Cancelar la respuesta (o la edición). */
  function cancelBar() {
    replyFor.value = null;
    if (editFor.value) {
      editFor.value = null;
      draft.value = '';
    }
  }

  /* ---------- W104: notas de voz ---------- */

  const REC_WAVE_H = 24;   /* alto de la barra de la onda en vivo */
  const WAVE_N = 34;       /* barras de la onda del mensaje (como la web) */
  const WAVE_H = 26;       /* alto de la onda del mensaje */
  /* NS no tiene flexbox: la onda se reparte el ancho con un GridLayout
     de columnas iguales (como el flex:1 de cada barra en la web). */
  const waveCols = Array(WAVE_N).fill('*').join(',');
  const recCols = Array(REC_WAVE_N).fill('*').join(',');

  /* La hora de la grabación (mm:ss). */
  const recTime = computed(() => {
    const s = recSecs.value;
    return Math.floor(s / 60) + ':' + pad2(s % 60);
  });

  function pad2(n: number): string {
    return (n < 10 ? '0' : '') + n;
  }

  /* Las 22 barras de la onda en vivo (altura en px). */
  const recBars = computed(() => {
    const out: number[] = [];
    for (let i = 0; i < REC_WAVE_N; i++) {
      const v = recWave.value[i] || 0;
      out.push(Math.max(3, Math.round((v / 100) * REC_WAVE_H)));
    }
    return out;
  });

  /* Empieza a grabar. */
  async function startRec() {
    if (rec.value === 'on') return;
    if (!canRecord()) {
      toast(t('Este dispositivo no tiene micrófono'), 'err');
      return;
    }
    try {
      await startRecording();
    } catch (e: any) {
      const msg = String((e && e.message) || e || '');
      if (msg.indexOf('permiso') >= 0) {
        toast(t('Permiso de micrófono necesario para la nota de voz'), 'err');
      } else {
        toast(t('No se pudo iniciar la grabación'), 'err');
      }
      return;
    }
    rec.value = 'on';
    /* W106: al grabar se cierra el selector de emojis (el compositor se
       sustituye por la barra de grabación). */
    pickerOpen.value = false;
    recSecs.value = 0;
    recWave.value = [];
    recPeaks = [];
    recStart = Date.now();
    recTimer = setInterval(() => {
      /* El tiempo sale del reloj: los ticks pueden llegar de golpe. */
      recSecs.value = Math.floor((Date.now() - recStart) / 1000);
      if (recSecs.value >= 300) stopRec(true);   // tope 5 min
    }, 1000);
    /* Los picos: se leen del micrófono cada 80 ms (mismo paso que la
       web) y forman la onda en vivo y la del mensaje enviado. */
    recPeakTimer = setInterval(() => {
      /* Si los ticks se acumularon, se descartan los picos viejos: la
         onda debe ir con el tiempo real de la grabación. */
      const elapsed = (Date.now() - recStart) / 1000;
      const maxPeaks = Math.ceil(elapsed / 0.08) + 2;
      while (recPeaks.length > maxPeaks) recPeaks.shift();
      const p = micLevel();
      recPeaks.push(p);
      const last = recWave.value.length
        ? recWave.value[recWave.value.length - 1] : p;
      recWave.value.push(Math.round(p * 0.65 + last * 0.35));
      while (recWave.value.length > REC_WAVE_N) recWave.value.shift();
    }, 80);
  }

  /* Para la grabación. Si `send` es true, manda la nota de voz. */
  async function stopRec(send: boolean) {
    if (rec.value !== 'on') return;
    const chatId = store.activeChatId;
    const secs = recSecs.value;
    const peaks = recPeaks.slice();
    clearRecTimers();
    rec.value = 'off';
    const file = await stopRecording();
    if (!send || !file) {
      if (file) await cancelRecording();
      return;
    }
    /* La onda del mensaje: ≤96 picos (0..100), como la web. */
    let outPeaks: number[] | null = null;
    if (peaks.length) {
      const n = Math.min(96, peaks.length);
      const step = peaks.length / n;
      outPeaks = [];
      for (let i = 0; i < n; i++) {
        const a = Math.floor(i * step);
        const b = Math.max(a + 1, Math.floor((i + 1) * step));
        let s = 0;
        for (let j = a; j < b && j < peaks.length; j++) {
          if (peaks[j] > s) s = peaks[j];
        }
        outPeaks.push(s);
      }
    }
    const dur = Math.max(1, Math.round(secs));
    try {
      await sendMedia(chatId, file as any, 'voice', null, null,
                      outPeaks, dur);
      await new Promise((r) => setTimeout(r, 120));
      scrollToEnd();
    } catch (e: any) {
      toast((e && e.detail) || t('No se pudo enviar la nota de voz'), 'err');
    }
  }

  /* Cancela la grabación (no se manda nada). */
  async function cancelRec() {
    if (rec.value !== 'on') return;
    clearRecTimers();
    rec.value = 'off';
    await cancelRecording();
  }

  function clearRecTimers() {
    if (recTimer) { clearInterval(recTimer); recTimer = null; }
    if (recPeakTimer) { clearInterval(recPeakTimer); recPeakTimer = null; }
    recSecs.value = 0;
    recWave.value = [];
    recPeaks = [];
    recStart = 0;
  }

  /* ¿Este mensaje es una nota de voz con audio? */
  function isVoice(m: any): boolean {
    return !!(m && m.kind === 'voice' && m.media);
  }

  /* El color del reproductor: blanco en la burbuja propia. */
  function voiceTint(mine: boolean): string {
    return mine ? '#ffffff' : tok(store.theme, 't1');
  }

  /* ¿Suena ahora mismo este mensaje? */
  function voicePlaying(m: any): boolean {
    return voiceState.value.playing && voiceState.value.id === m.id;
  }

  /* Las 34 barras de la onda del mensaje (altura en px). */
  function waveOf(m: any): number[] {
    const p = m && m.peaks;
    const out: number[] = [];
    if (p && p.length) {
      const step = p.length / WAVE_N;
      for (let i = 0; i < WAVE_N; i++) {
        const a = Math.floor(i * step);
        const b = Math.max(a + 1, Math.floor((i + 1) * step));
        let s = 0;
        for (let j = a; j < b && j < p.length; j++) {
          if (p[j] > s) s = p[j];
        }
        out.push(Math.max(3, Math.round((Math.max(10, Math.min(100, s)) / 100) * WAVE_H)));
      }
    } else {
      /* Grabaciones viejas sin picos: un perfil neutro. */
      for (let i = 0; i < WAVE_N; i++) {
        out.push(Math.round((30 + ((i * 7) % 5) * 9) / 100 * WAVE_H));
      }
    }
    return out;
  }

  /* Cuántas barras van "sonadas" (el progreso). */
  function waveBar(m: any): number {
    const st = voiceState.value;
    if (!st.playing || st.id !== m.id) return -1;
    const total = st.duration || m.dur || 0;
    if (!total) return -1;
    return Math.floor((st.current / total) * WAVE_N);
  }

  /* El tiempo que se ve: la posición si suena, si no la duración. */
  function voiceTime(m: any): string {
    const st = voiceState.value;
    let secs = m.dur || 0;
    if (st.playing && st.id === m.id) secs = Math.floor(st.current || 0);
    return Math.floor(secs / 60) + ':' + pad2(secs % 60);
  }

  /* Play/pausa de una nota de voz. */
  async function toggleVoice(m: any) {
    if (!m || !m.media || !m.media.url) return;
    const url = mediaUrl(m.media.url);
    if (!url) {
      toast(t('No se pudo abrir la nota de voz'), 'err');
      return;
    }
    await toggleVoicePlay(m.id, url, m.dur || 0);
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

  /* Baja la lista de mensajes al final (al abrir el chat, al mandar un
     mensaje y cuando llegan por el WebSocket).

     OJO con NativeScript:
     - `scrollToBottom()` NO existe en NS (es de la web): se baja con un
       desplazamiento enorme, que la vista nativa recorta al final del
       contenido (en Android el `clamp` lo deja justo en el último píxel
       y en iOS también se recorta al tamaño del contenido);
     - el `ref` de un elemento en NS-Vue es el envoltorio (NSVElement),
       así que los métodos del ScrollView están en su `nativeView`. */
  function scrollToEnd() {
    try {
      const s: any = scroller.value;
      const sv = s ? (s.nativeView || s) : null;
      if (sv && sv.scrollToVerticalOffset) {
        sv.scrollToVerticalOffset(1e6, false);
      }
    } catch (e) { /* el ScrollView puede no estar listo */ }
  }

  async function send() {
    const text = draft.value.trim();
    if (!text || sending.value) return;
    sending.value = true;
    try {
      if (editFor.value) {
        /* W105: editar el mensaje (no se manda uno nuevo). */
        await editMessage(store.activeChatId, editFor.value.id, text);
        editFor.value = null;
      } else {
        /* W105: si hay respuesta, el mensaje nuevo la lleva. */
        await sendText(store.activeChatId, text, replyFor.value);
        replyFor.value = null;
      }
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

  /* ---------- W106: el selector de emojis/stickers/GIFs ---------- */

  function togglePicker() {
    pickerOpen.value = !pickerOpen.value;
  }

  function closePicker() {
    pickerOpen.value = false;
  }

  /* Un emoji del selector va al final del borrador (no se manda solo:
     el usuario sigue escribiendo y lo envía cuando quiere). */
  function insertEmoji(e: string) {
    if (!e) return;
    draft.value = draft.value + e;
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
    /* W104: el reproductor avisa de su estado (play/pausa) y un tick
       suave mantiene al día la posición. */
    onVoiceState((s) => { voiceState.value = s; });
    voiceTick = setInterval(() => {
      if (voiceState.value.playing) {
        voiceState.value = Object.assign({}, voiceState.value, {
          current: currentVoiceTime(),
        });
      }
    }, 250);
  });

  onUnmounted(() => {
    /* Si se sale del chat grabando, el micrófono se suelta (si no, la
       grabación seguiría en marcha sin que nadie la detenga). */
    if (rec.value === 'on') {
      rec.value = 'off';
      cancelRecording();
    }
    if (recTimer) { clearInterval(recTimer); recTimer = null; }
    if (recPeakTimer) { clearInterval(recPeakTimer); recPeakTimer = null; }
    if (voiceTick) { clearInterval(voiceTick); voiceTick = null; }
    onVoiceState(null);
    stopVoice();
  });

  /* Al llegar mensajes nuevos (por WebSocket) se baja al final. */
  watch(() => messages.value.length, async (n) => {
    if (!n) return;
    await new Promise((r) => setTimeout(r, 80));
    scrollToEnd();
  });

  /* Al cambiar de chat se limpia la respuesta/edición (y el borrador:
     si no, el texto de un chat aparece en otro). */
  watch(() => store.activeChatId, () => {
    sheetFor.value = null;
    replyFor.value = null;
    editFor.value = null;
    draft.value = '';
  });
</script>
