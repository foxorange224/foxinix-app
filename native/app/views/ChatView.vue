<template>
  <Page>
    <ActionBar :title="title">
      <ActionItem text="Atrás" @tap="back" ios.position="left" />
    </ActionBar>

    <GridLayout rows="*,auto">
      <ScrollView ref="scroller">
        <StackLayout class="fox-msgs">
          <Label v-if="loading" class="fox-empty" text="Cargando mensajes…" />

          <StackLayout
            v-for="m in messages"
            :key="m.id"
            class="fox-msg-wrap"
            :horizontalAlignment="isMine(m) ? 'right' : 'left'"
          >
            <!-- mensaje de sistema -->
            <Label
              v-if="m.kind === 'system'"
              class="fox-sys"
              :text="m.body"
              textWrap="true"
            />
            <!-- burbuja normal -->
            <StackLayout
              v-else
              class="fox-bubble"
              :class="isMine(m) ? 'mine' : 'theirs'"
            >
              <Label
                v-if="!isMine(m) && chatType === 'group'"
                class="fox-sender"
                :text="senderName(m)"
              />
              <!-- W102: la imagen se ve DENTRO de la burbuja (con su
                   pie de foto si lo tiene). Al tocarla se abre a
                   pantalla completa. -->
              <Image
                v-if="isImage(m)"
                class="fox-img"
                :src="imgSrc(m)"
                :width="imgSize(m).w"
                :height="imgSize(m).h"
                stretch="aspectFit"
                @tap="openImage(m)"
              />
              <Label
                v-if="bodyOf(m)"
                class="fox-body"
                :text="bodyOf(m)"
                textWrap="true"
              />
              <Label class="fox-time" :text="timeOf(m)" />
            </StackLayout>
          </StackLayout>
        </StackLayout>
      </ScrollView>

      <!-- compositor -->
      <GridLayout class="fox-composer" columns="auto,*,auto" rows="auto">
        <!-- adjuntar archivo (imágenes, documentos…) -->
        <Button
          class="fox-attach"
          col="0"
          row="0"
          text="📎"
          :enabled="!sendingFile"
          @tap="attach"
        />
        <TextField
          class="fox-input"
          col="1"
          row="0"
          :text="draft"
          hint="Mensaje"
          multiline="false"
          autocorrect="true"
          :editable="!sending"
          @textChange="draft = $event.value"
          @submit="send"
        />
        <Button
          class="fox-send"
          col="2"
          row="0"
          text="Enviar"
          :enabled="!!draft.trim() && !sending"
          @tap="send"
        />
      </GridLayout>
    </GridLayout>
  </Page>
</template>

<script setup lang="ts">
  import { ref, computed, onMounted, watch } from 'nativescript-vue';
  import { store, toast } from '../core/store.js';
  import { openChat, sendText, closeChat, sendMedia } from '../core/actions.js';
  import { pickFile } from '../files';
  import { imageBox, imageUrl, isImageMsg } from '../img';
  import { openMedia } from '../nav';

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

  const title = computed(() => {
    const c = chat.value;
    if (!c) return 'Chat';
    if (c.type === 'group') {
      const t = c.title || {};
      return t.display_name || 'Grupo';
    }
    const t = c.title || {};
    return t.display_name || t.username || 'Chat';
  });

  const chatType = computed(() => (chat.value && chat.value.type) || 'dm');

  const messages = computed(() => {
    const id = store.activeChatId;
    return (store.msgs && store.msgs[id]) || [];
  });

  function isMine(m: any): boolean {
    return !!(store.user && m.sender && m.sender.id === store.user.id);
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
    const d = new Date(m.created_at * 1000);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return hh + ':' + mm;
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

<style>
.fox-msgs {
  padding: 12;
}

.fox-msg-wrap {
  margin-bottom: 8;
}

.fox-bubble {
  max-width: 300;
  border-radius: 12;
  padding: 8 12;
}

.fox-bubble.mine {
  background-color: #ff751f;
}

.fox-bubble.theirs {
  background-color: #16232c;
}

.fox-sender {
  color: #ff751f;
  font-size: 12;
  font-weight: 600;
  margin-bottom: 2;
}

/* W102: la imagen dentro de la burbuja. El tamaño lo fija la vista
   (imageBox: conserva la proporción real del server, tope 220×300). */
.fox-img {
  border-radius: 8;
  margin: 2 0;
}

.fox-body {
  color: #eef3f6;
  font-size: 15;
}

.fox-bubble.mine .fox-body {
  color: #12181c;
}

.fox-time {
  color: #7d909c;
  font-size: 10;
  text-align: right;
  margin-top: 2;
}

.fox-bubble.mine .fox-time {
  color: #4a2c12;
}

.fox-sys {
  color: #7d909c;
  font-size: 12;
  text-align: center;
  margin: 8 0;
}

.fox-empty {
  color: #8aa0ad;
  text-align: center;
  margin-top: 30;
}

.fox-composer {
  padding: 8;
  background-color: #111d25;
}

.fox-input {
  background-color: #16232c;
  color: #e8edf2;
  border-radius: 10;
  border-width: 1;
  border-color: #24333d;
  padding: 10;
  font-size: 15;
  margin-right: 8;
}

.fox-attach {
  background-color: transparent;
  color: #8aa0ad;
  font-size: 20;
  width: 40;
  padding: 6;
  margin-right: 4;
  android-textAllCaps: false;
}

.fox-attach:disabled {
  color: #56666f;
}

.fox-send {
  background-color: #ff751f;
  color: #12181c;
  border-radius: 10;
  padding: 10 16;
  font-weight: 600;
}
</style>
