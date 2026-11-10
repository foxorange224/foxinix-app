<template>
  <GridLayout class="ep" rows="auto,auto,*">

    <!-- ---------- pestañas ---------- -->
    <GridLayout row="0" class="ep-tabs" columns="auto,auto,auto">
      <GridLayout v-for="tb in TABS" :key="tb.id" :col="tb.i" class="ep-tab"
                  :class="{ on: tab === tb.id }" columns="auto,auto"
                  :accessibilityLabel="'ep-tab: ' + tb.id" @tap="setTab(tb.id)">
        <Image col="0" class="ep-tab-ic" :src="tb.icon" stretch="aspectFit"
               :tintColor="tab === tb.id ? accent : muted" />
        <Label col="1" class="ep-tab-tx" :class="{ on: tab === tb.id }"
               :text="tb.label" textWrap="false" />
      </GridLayout>
    </GridLayout>

    <!-- ---------- buscador (sólo emojis) ---------- -->
    <GridLayout v-if="tab === 'emo'" row="1" class="ep-tools">
      <GridLayout row="0" class="ep-search" columns="auto,*,auto">
        <Image col="0" src="res://ic_fox_search" width="16" height="16"
               :tintColor="muted" verticalAlignment="center" />
        <TextField col="1" class="ep-search-in" :text="q"
                   :hint="t('Buscar emoji')" :placeholderColor="muted"
                   autocorrect="false" autocapitalizationType="none"
                   @textChange="q = $event.value" />
        <!-- la X para borrar la búsqueda (como en la web) -->
        <FoxIconBtn v-if="q" col="2" class="ep-clr" icon="x" bare
                    :size="26" :ic="13" :tint="muted"
                    :accessibilityLabel="t('Borrar')" @tap="q = ''" />
      </GridLayout>
    </GridLayout>

    <!-- ---------- cuerpo ---------- -->
    <!-- En la web el cuerpo del picker es una rejilla de 2 columnas: el
         rail de categorías a la IZQUIERDA y a su lado UNA sola lista
         con subtítulos ("Caras y emociones:", …). El rail salta a la
         sección y se ilumina la que se está viendo. -->
    <GridLayout v-if="tab === 'emo'" row="2" class="ep-body" columns="auto,*">

      <!-- el rail de categorías -->
      <ScrollView col="0" class="ep-rail">
        <StackLayout>
          <Label v-for="c in cats" :key="c.id" class="ep-cat"
                 :class="{ on: !q.trim() && cat === c.id }" :text="c.icon"
                 textWrap="false" :accessibilityLabel="c.name"
                 @tap="jump(c.id)" />
        </StackLayout>
      </ScrollView>

      <!-- la lista con subtítulos -->
      <ScrollView col="1" class="ep-scroll" ref="scroller" @scroll="onScroll">
        <StackLayout>
          <template v-if="!q.trim()">
            <GridLayout v-for="s in sections" :key="s.id" class="ep-section"
                        rows="auto,auto">
              <Label row="0" class="ep-sub" :text="t(s.label)" textWrap="false" />
              <GridLayout row="1" class="ep-grid" :columns="emoCols"
                          :rows="gridRows(s.items.length, emoN)">
                <Label v-for="(e, i) in s.items" :key="'e' + s.id + i"
                       :row="Math.floor(i / emoN)" :col="i % emoN"
                       class="ep-e" :text="e" textWrap="false"
                       :accessibilityLabel="e" @tap="pick(e)" />
              </GridLayout>
            </GridLayout>
          </template>
          <template v-else>
            <GridLayout class="ep-grid" :columns="emoCols"
                        :rows="gridRows(flat.length, emoN)">
              <Label v-for="(e, i) in flat" :key="'f' + i"
                     :row="Math.floor(i / emoN)" :col="i % emoN"
                     class="ep-e" :text="e" textWrap="false"
                     :accessibilityLabel="e" @tap="pick(e)" />
            </GridLayout>
          </template>

          <Label v-if="!q.trim() && !sections.length" class="ep-empty"
                 :text="t('Aún no usas emojis.')" textWrap="true" />
          <Label v-else-if="q.trim() && !flat.length" class="ep-empty"
                 :text="t('Sin coincidencias.')" textWrap="true" />
        </StackLayout>
      </ScrollView>
    </GridLayout>

    <!-- los stickers y los GIFs (una lista con secciones, como la web) -->
    <ScrollView v-else row="2" class="ep-scroll">
      <StackLayout>

        <!-- ============ STICKERS ============ -->
        <template v-if="tab === 'st'">
          <!-- favoritos -->
          <template v-if="stkFavs.length">
            <Label class="ep-sec" :text="t('Favoritos')" textWrap="false" />
            <GridLayout class="ep-grid" :columns="tileCols">
              <GridLayout v-for="(s, i) in stkFavs" :key="'sf' + i"
                          :row="Math.floor(i / tileN)" :col="i % tileN"
                          class="ep-tile" rows="auto" columns="auto">
                <Label row="0" col="0" class="ep-stk" :text="s" textWrap="false"
                       :accessibilityLabel="t('Enviar')" @tap="onSticker(s)" />
                <FoxIconBtn row="0" col="0" class="ep-fav" icon="star-fill"
                            bare :size="20" :ic="13" tint="#ff751f"
                            :accessibilityLabel="t('Quitar de favoritos')"
                            @tap="toggleFav(s)" />
              </GridLayout>
            </GridLayout>
          </template>

          <!-- los subidos por el usuario -->
          <GridLayout class="ep-sec-row" columns="*,auto">
            <Label col="0" class="ep-sec" :text="t('Mis stickers')" textWrap="false" />
            <FoxIconBtn col="1" class="ep-up" icon="plus" bare :tint="muted"
                        :accessibilityLabel="t('Subir sticker')" @tap="upload('sticker')" />
          </GridLayout>
          <GridLayout v-if="myStickers.length" class="ep-grid" :columns="tileCols"
                      :rows="gridRows(myStickers.length, tileN)">
            <GridLayout v-for="(a, i) in myStickers" :key="'sa' + a.id"
                        :row="Math.floor(i / tileN)" :col="i % tileN"
                        class="ep-tile" rows="auto" columns="auto">
              <Image row="0" col="0" class="ep-img" :src="mediaUrl(a.url)"
                     stretch="aspectFill" :accessibilityLabel="t('Enviar')"
                     @tap="sendAsset('sticker', a)" />
              <FoxIconBtn row="0" col="0" class="ep-fav" icon="x" bare
                          :size="20" :ic="13" tint="#ffffff"
                          :accessibilityLabel="t('Borrar')" @tap="delAsset('sticker', a)" />
            </GridLayout>
          </GridLayout>
          <Label v-else class="ep-empty" :text="t('Aún no has subido stickers')"
                 textWrap="true" />

          <!-- todos los stickers del sitio -->
          <Label class="ep-sec" :text="t('Todos los stickers')" textWrap="false" />
          <GridLayout class="ep-grid" :columns="tileCols"
                      :rows="gridRows(STICKERS.length, tileN)">
            <GridLayout v-for="(s, i) in STICKERS" :key="'s' + s"
                        :row="Math.floor(i / tileN)" :col="i % tileN"
                        class="ep-tile" rows="auto" columns="auto">
              <Label row="0" col="0" class="ep-stk" :text="s" textWrap="false"
                     :accessibilityLabel="t('Enviar')" @tap="onSticker(s)" />
              <FoxIconBtn row="0" col="0" class="ep-fav"
                          :icon="isStkFav(s) ? 'star-fill' : 'star'" bare
                          :size="20" :ic="13" :tint="isStkFav(s) ? '#ff751f' : muted"
                          :accessibilityLabel="isStkFav(s) ? t('Quitar de favoritos') : t('Guardar en stickers')"
                          @tap="toggleFav(s)" />
            </GridLayout>
          </GridLayout>
        </template>

        <!-- ============ GIFs ============ -->
        <template v-else>
          <!-- favoritos -->
          <template v-if="gifFavs.length">
            <Label class="ep-sec" :text="t('Favoritos')" textWrap="false" />
            <GridLayout class="ep-grid" :columns="tileCols"
                        :rows="gridRows(gifFavs.length, tileN)">
              <GridLayout v-for="(f, i) in gifFavs" :key="'gf' + i"
                          :row="Math.floor(i / tileN)" :col="i % tileN"
                          class="ep-tile" rows="auto" columns="auto">
                <Image row="0" col="0" class="ep-img" :src="gifSrc(f)"
                       stretch="aspectFill" :accessibilityLabel="t('Enviar')"
                       @tap="onGifFav(f)" />
                <FoxIconBtn row="0" col="0" class="ep-fav" icon="star-fill" bare
                            :size="20" :ic="13" tint="#ff751f"
                            :accessibilityLabel="t('Quitar de favoritos')"
                            @tap="delGifFav(f)" />
              </GridLayout>
            </GridLayout>
          </template>

          <!-- los subidos por el usuario -->
          <GridLayout class="ep-sec-row" columns="*,auto">
            <Label col="0" class="ep-sec" :text="t('Mis GIFs')" textWrap="false" />
            <FoxIconBtn col="1" class="ep-up" icon="plus" bare :tint="muted"
                        :accessibilityLabel="t('Subir GIF')" @tap="upload('gif')" />
          </GridLayout>
          <GridLayout v-if="myGifs.length" class="ep-grid" :columns="tileCols"
                      :rows="gridRows(myGifs.length, tileN)">
            <GridLayout v-for="(a, i) in myGifs" :key="'ga' + a.id"
                        :row="Math.floor(i / tileN)" :col="i % tileN"
                        class="ep-tile" rows="auto" columns="auto">
              <Image row="0" col="0" class="ep-img" :src="mediaUrl(a.url)"
                     stretch="aspectFill" :accessibilityLabel="t('Enviar')"
                     @tap="sendAsset('gif', a)" />
              <FoxIconBtn row="0" col="0" class="ep-fav" icon="x" bare
                          :size="20" :ic="13" tint="#ffffff"
                          :accessibilityLabel="t('Borrar')" @tap="delAsset('gif', a)" />
            </GridLayout>
          </GridLayout>
          <Label v-else class="ep-empty" :text="t('Aún no has subido GIFs')"
                 textWrap="true" />

          <!-- la biblioteca del sitio -->
          <Label class="ep-sec" :text="t('Biblioteca')" textWrap="false" />
          <GridLayout class="ep-grid" :columns="tileCols"
                      :rows="gridRows(GIF_LIST.length, tileN)">
            <GridLayout v-for="(g, i) in GIF_LIST" :key="g"
                        :row="Math.floor(i / tileN)" :col="i % tileN"
                        class="ep-tile" rows="auto" columns="auto">
              <Image row="0" col="0" class="ep-img" :src="gifSrc({ name: g })"
                     stretch="aspectFill" :accessibilityLabel="t('Enviar')"
                     @tap="onGif(g)" />
              <FoxIconBtn row="0" col="0" class="ep-fav"
                          :icon="isLibGifFav(g) ? 'star-fill' : 'star'" bare
                          :size="20" :ic="13" :tint="isLibGifFav(g) ? '#ff751f' : muted"
                          :accessibilityLabel="isLibGifFav(g) ? t('Quitar de favoritos') : t('Agregar a favoritos')"
                          @tap="toggleLibFav(g)" />
            </GridLayout>
          </GridLayout>
        </template>

      </StackLayout>
    </ScrollView>
  </GridLayout>
</template>

<script setup lang="ts">
  /* W106: el selector de emojis/stickers/GIFs de la app nativa.

     En la web es el panel `.st-panel` del compositor, con 3 pestañas
     (Emojis / Stickers / GIFs). Acá es una fila del GridLayout de la
     conversación, justo ARRIBA del compositor: en NS no hay
     `position: fixed` ni z-index, así que el panel no flota: ocupa su
     fila y los mensajes se achican (el compositor sigue a la vista,
     que es lo que hace falta para ver lo que se está escribiendo).

     OJO: la raíz del template no puede tener comentarios (en producción
     Vue no desenvuelve el Fragment raíz y la app se queda en negro);
     por eso esta nota vive acá y no arriba. */

  import { computed, ref } from 'nativescript-vue';
  import { store, toast } from '../core/store.js';
  import { t } from '../core/i18n.js';
  import { api } from '../core/api.js';
  import { mediaUrl, sendText, sendGif } from '../core/actions.js';
  import { emojiCats, emojiCat, emojiRecent, emojiSearch, emojiPush } from '../core/emoji.js';
  import {
    STICKERS, GIF_LIST, isStkFav, toggleStkFav, ensureGifFavs,
    ensureUserAssets, uploadUserAsset, removeUserAsset, isLibGifFav,
    toggleLibGif,
  } from '../core/stickers.js';
  import { pickFile } from '../files';
  import { tok } from '../fmt';
  import FoxIconBtn from './FoxIconBtn.vue';

  const emit = defineEmits<{
    /** Un emoji del selector: se inserta en el borrador. */
    pick: [string];
    /** Se envió un sticker o un GIF: el panel se cierra. */
    close: [];
  }>();

  /* Las 3 pestañas del panel de la web (computed para que el idioma
     cambie con la app, como el resto de las vistas). */
  const TABS = computed(() => [
    { id: 'emo', i: 0, label: t('Emojis'), icon: 'res://ic_fox_smile' },
    { id: 'st', i: 1, label: t('Stickers'), icon: 'res://ic_fox_sticker' },
    { id: 'gif', i: 2, label: t('GIFs'), icon: 'res://ic_fox_image' },
  ]);

  const tab = ref<'emo' | 'st' | 'gif'>('emo');
  const q = ref('');
  const cat = ref('recentes');
  const busy = ref(false);
  /* La lista de emojis (para saltar a una sección del rail). */
  const scroller = ref<any>(null);

  const muted = computed(() => tok(store.theme, 't2'));
  const accent = computed(() => tok(store.theme, 'accent'));

  const cats = emojiCats();

  /* Una sola lista con subtítulos por categoría (como la web): los
     recientes van primero (si hay) y después cada categoría. */
  const sections = computed(() => {
    const out: any[] = [];
    const rec = emojiRecent();
    if (rec.length) out.push({ id: 'recientes', label: 'Recientes', items: rec });
    for (const c of cats) {
      if (c.id === 'recientes') continue;
      const items = emojiCat(c.id);
      if (items.length) out.push({ id: c.id, label: c.name, items });
    }
    return out;
  });

  /* La búsqueda aplana la lista (como en la web). */
  const flat = computed(() => (q.value.trim() ? emojiSearch(q.value.trim()) : []));

  /* La rejilla de emojis: 8 por fila (como los cuadros de la web). */
  const emoN = 8;
  const emoCols = computed(() => new Array(emoN).fill('*').join(','));
  /* Los cuadros de stickers/GIFs son más grandes: 5 por fila. */
  const tileN = 5;
  const tileCols = computed(() => new Array(tileN).fill('*').join(','));

  /* Las filas de una rejilla: "auto" por cada fila que haga falta.
     OJO: en NS hay que declarar las filas Y las columnas: si sólo se
     declaran las columnas, los hijos con `row` mayor se salen de la
     rejilla. */
  function gridRows(n: number, perRow: number): string {
    const rows = Math.ceil((n || 0) / perRow);
    return new Array(Math.max(rows, 1)).fill('auto').join(',');
  }

  /* Las alturas fijas del subtítulo y de cada fila de emojis. Tienen que
     coincidir con el CSS (.ep-sub y .ep-e): con ellas se calcula a qué
     punto hay que desplazar la lista cuando se toca una categoría del
     rail (en la web es el scrollTop del elemento). */
  const SUB_H = 26;
  const EMO_H = 40;

  /* La posición (en la lista) del subtítulo de la sección i. */
  function sectionOffset(i: number): number {
    let y = 0;
    const list = sections.value;
    for (let j = 0; j < i && j < list.length; j++) {
      y += SUB_H + Math.ceil(list[j].items.length / emoN) * EMO_H;
    }
    return y;
  }

  const stkFavs = computed(() => store.stkFavs || []);
  const gifFavs = computed(() => store.gifFavs || []);
  const myStickers = computed(() => (store.userAssets && store.userAssets.stickers) || []);
  const myGifs = computed(() => (store.userAssets && store.userAssets.gifs) || []);

  function setTab(id: 'emo' | 'st' | 'gif') {
    tab.value = id;
    /* W36k/W61: abrir GIFs o Stickers trae la biblioteca propia y los
       favoritos (en la web, ensureGifFavs/ensureUserAssets). */
    if (id === 'gif') {
      ensureGifFavs();
      ensureUserAssets();
    }
    if (id === 'st') ensureUserAssets();
  }

  /* Tocar una categoría del rail: salta a su sección (como en la web). */
  function jump(id: string) {
    q.value = '';
    cat.value = id;
    const idx = sections.value.findIndex((s: any) => s.id === id);
    if (idx < 0) return;
    try {
      if (scroller.value) {
        scroller.value.scrollToVerticalOffset(sectionOffset(idx), true);
      }
    } catch (e) { /* el scroll es un extra: si falla, sigue la lista */ }
  }

  /* Al desplazar la lista se ilumina la categoría que se está viendo. */
  function onScroll(e: any) {
    if (q.value.trim()) return;
    const y = e && e.contentOffset ? e.contentOffset.y : 0;
    const list = sections.value;
    if (!list.length) return;
    let cur = list[0].id;
    for (let i = 0; i < list.length; i++) {
      if (sectionOffset(i) <= y + 4) cur = list[i].id;
    }
    cat.value = cur;
  }

  /* Un emoji del selector: va al borrador (lo pone el compositor). */
  function pick(e: string) {
    emojiPush(e);
    emit('pick', e);
  }

  /* Un sticker del sitio: viaja como mensaje kind 'sticker'. */
  async function onSticker(ch: string) {
    try {
      await sendText(store.activeChatId, ch, null, 'sticker');
      emit('close');
    } catch (e: any) {
      toast((e && e.detail) || 'No se pudo enviar el sticker', 'err');
    }
  }

  /* Un GIF de la biblioteca: se baja y se sube como imagen (sendGif). */
  async function onGif(name: string) {
    emit('close');
    await sendGif(store.activeChatId, name);
  }

  /* Un GIF o sticker subido por el usuario: ya vive en el server, así
     que sólo se referencia su media_id. */
  async function sendAsset(kind: 'gif' | 'sticker', a: any) {
    if (!a || !a.media_id) return;
    try {
      await api('POST', '/chats/' + store.activeChatId + '/messages', {
        kind: kind === 'gif' ? 'image' : 'sticker',
        body: '',
        media_id: a.media_id,
        client_msg_id: String(Date.now()),
      });
      emit('close');
    } catch (e: any) {
      toast((e && e.detail) || 'No se pudo enviar el archivo', 'err');
    }
  }

  /* Un GIF guardado en favoritos (los subidos ya viven en el server). */
  async function onGifFav(f: any) {
    if (!f.media_id) { onGif(f.name); return; }
    try {
      await api('POST', '/chats/' + store.activeChatId + '/messages', {
        kind: 'image', body: '', media_id: f.media_id,
        client_msg_id: String(Date.now()),
      });
      emit('close');
    } catch (e: any) {
      toast((e && e.detail) || 'No se pudo enviar el GIF', 'err');
    }
  }

  /* La URL de un GIF: los subidos van firmados por el CDN; los de la
     biblioteca son archivos estáticos del sitio. */
  function gifSrc(f: any): string {
    if (!f) return '';
    if (f.media_id) return mediaUrl(f.url);
    if (f.name) {
      return 'https://foxinix.qzz.io/static/gifs/' + encodeURIComponent(f.name);
    }
    return f.url ? mediaUrl(f.url) : '';
  }

  function toggleFav(ch: string) {
    toggleStkFav(ch);
  }

  function delGifFav(f: any) {
    const body = f.media_id ? { media_id: f.media_id } : { name: f.name };
    api('DELETE', '/gifs/favorites', body).then(() => {
      store.gifFavs = (store.gifFavs || []).filter((x: any) =>
        f.media_id ? x.media_id !== f.media_id : x.name !== f.name);
    }).catch(() => { toast('No se pudo quitar el favorito', 'err'); });
  }

  function toggleLibFav(name: string) {
    toggleLibGif(name);
  }

  /* Subir un sticker o un GIF propio (máx. 10 de cada tipo). */
  async function upload(kind: 'gif' | 'sticker') {
    if (busy.value) return;
    busy.value = true;
    try {
      const f = await pickFile();
      if (!f) return;
      if (kind === 'gif' && f.type !== 'image/gif' && f.type !== 'image/webp') {
        toast(t('Elige un archivo GIF o WebP animado'), 'err');
        return;
      }
      if (kind === 'sticker' && f.type.indexOf('image/') !== 0) {
        toast(t('Elige una imagen'), 'err');
        return;
      }
      const a = await uploadUserAsset(kind, f as any);
      if (a) toast(kind === 'gif' ? t('GIF agregado') : t('Sticker agregado'), 'ok');
    } catch (e: any) {
      toast((e && e.detail) || 'No se pudo subir el archivo', 'err');
    } finally {
      busy.value = false;
    }
  }

  async function delAsset(kind: 'gif' | 'sticker', a: any) {
    try {
      await removeUserAsset(kind, a);
    } catch (e: any) {
      toast((e && e.detail) || 'No se pudo borrar el archivo', 'err');
    }
  }
</script>
