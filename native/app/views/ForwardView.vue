<template>
  <!-- W105: reenviar un mensaje a otro chat (el ForwardModal de la web,
       pero como pantalla nativa: buscador + lista de chats). -->
  <Page :class="'fox-' + theme" actionBarHidden="true">

    <GridLayout rows="auto,auto,*" class="fwd-page">
      <!-- ---------- cabecera ---------- -->
      <GridLayout row="0" class="chat-head" columns="auto,*">
        <FoxIconBtn col="0" icon="back" bare :tint="muted"
                    accessibilityLabel="back" @tap="close" />
        <Label col="1" class="ch-name" :text="t('Reenviar mensaje')"
               textWrap="false" />
      </GridLayout>

      <!-- ---------- buscador ---------- -->
      <GridLayout row="1" class="side-search" columns="auto,*">
        <Image col="0" src="res://ic_fox_search" width="18" height="18"
               :tintColor="muted" verticalAlignment="center" />
        <TextField col="1" class="search-input" :text="q"
                   :hint="t('Buscar en la lista…')" :placeholderColor="muted"
                   autocorrect="false" autocapitalizationType="none"
                   @textChange="q = $event.value" />
      </GridLayout>

      <!-- ---------- chats destino ---------- -->
      <ScrollView row="2">
        <StackLayout class="chat-list">
          <GridLayout v-for="c in chats" :key="c.id" class="chat-item"
                      columns="auto,*" :accessibilityLabel="'forward to: ' + titleOf(c)"
                      @tap="doForward(c.id)">
            <FoxAvatar col="0" :src="avatarOf(c)" :initial="initials(c)"
                       :size="48" :ring="panelRing" />
            <StackLayout col="1" class="ci-col">
              <Label class="ci-name" :text="titleOf(c)" textWrap="false" />
              <Label class="ci-prev"
                     :text="c.type === 'group' ? t('Grupo') : t('Chat')"
                     textWrap="false" />
            </StackLayout>
          </GridLayout>

          <Label v-if="!chats.length" class="list-empty"
                 :text="t('Sin resultados.')" textWrap="true" />
        </StackLayout>
      </ScrollView>
    </GridLayout>
  </Page>
</template>

<script setup lang="ts">
  import { computed, ref } from 'nativescript-vue';
  import { store, toast } from '../core/store.js';
  import { t } from '../core/i18n.js';
  import { chatTitle, forwardMessage, mediaUrl } from '../core/actions.js';
  import { tok } from '../fmt';
  import { back, forwardMsg, forwardSrc } from '../nav';
  import FoxAvatar from '../components/FoxAvatar.vue';
  import FoxIconBtn from '../components/FoxIconBtn.vue';

  const q = ref('');
  const busy = ref(false);

  const theme = computed(() => store.theme);
  const muted = computed(() => tok(store.theme, 't2'));
  const panelRing = computed(() => tok(store.theme, 'border'));

  /* Los chats destino: todos menos el de origen, filtrados por la
     búsqueda (como el ForwardModal de la web). */
  const chats = computed(() => {
    const src = forwardSrc.value;
    const needle = q.value.trim().toLowerCase();
    return (store.chats || []).filter((c: any) => {
      if (c.id === src) return false;
      if (!needle) return true;
      return titleOf(c).toLowerCase().indexOf(needle) >= 0;
    });
  });

  function titleOf(c: any): string {
    if (!c) return '';
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

  function avatarOf(c: any): string {
    if (!c) return '';
    const url = c.type === 'dm' ? (c.title && c.title.avatar_url) : c.avatar_url;
    return url ? mediaUrl(url) : '';
  }

  async function doForward(targetId: number) {
    const m = forwardMsg.value;
    if (!m || busy.value) return;
    busy.value = true;
    try {
      await forwardMessage(forwardSrc.value, m.id, targetId);
      toast(t('Mensaje reenviado'));
      back();
    } catch (e: any) {
      toast((e && e.detail) || t('No se pudo reenviar el mensaje'), 'err');
    } finally {
      busy.value = false;
    }
  }

  function close() {
    back();
  }
</script>
