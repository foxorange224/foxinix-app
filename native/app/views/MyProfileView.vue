<template>
  <!-- W107: "Tu perfil" — el modal .meprof de la web (MeProfileModal),
       como pantalla nativa: portada, avatar encima, estado citado al
       lado (abre el menú de estado), nombre, @usuario, ID copiable,
       bio, "Miembro desde" y el botón Editar perfil.

       El menú de estado es la ÚLTIMA fila del GridLayout (regla NS9:
       nada de position:fixed ni z-index; una hoja va como fila propia). -->
  <Page :class="'fox-' + theme" actionBarHidden="true">
    <GridLayout rows="auto,*,auto" class="mp-page">
      <!-- ---------- cabecera ---------- -->
      <GridLayout row="0" class="side-head" columns="auto,*">
        <FoxIconBtn col="0" icon="back" bare :tint="accent"
                    accessibilityLabel="back" @tap="close" />
        <Label col="1" class="sh-title" :text="t('Tu perfil')" textWrap="false" />
      </GridLayout>

      <!-- ---------- ficha ---------- -->
      <ScrollView row="1">
        <StackLayout>
          <!-- portada (tappable: la abre el visor, como en la web) -->
          <FoxBanner :src="banner" :height="132" @tap="viewBanner" />

          <!-- avatar + estado citado, en la misma fila -->
          <GridLayout columns="auto,*" class="pf-idrow">
            <FoxAvatar col="0" class="mp-av" :src="avatar" :initial="initial"
                       :size="88" :dot="dot" :ring="ring"
                       accessibilityLabel="ver foto" @tap="viewAvatar" />
            <GridLayout col="1" class="pf-quote pf-status-btn"
                        columns="auto,*,auto" @tap="toggleStatus">
              <StackLayout col="0" class="sdot" width="14" height="14"
                           verticalAlignment="center"
                           borderRadius="7" :backgroundColor="dotBg"
                           :borderColor="dotBorder" :borderWidth="dotBw" />
              <Label col="1" class="pf-quote-text" :text="myStatus"
                     textWrap="true" verticalAlignment="center" />
              <Image col="2" src="res://ic_fox_chevron_down" width="16"
                     height="16" :tintColor="muted" verticalAlignment="center" />
            </GridLayout>
          </GridLayout>

          <!-- nombre, @usuario e ID copiable -->
          <StackLayout class="pf-idbelow">
            <Label class="pf-name" :text="name" textWrap="true" />
            <Label class="pf-user" :text="'@' + username" textWrap="false" />
            <GridLayout v-if="pubId" class="pf-pubid" columns="auto,*,auto"
                        @tap="copyId">
              <Label col="0" class="pf-pubid-l" :text="t('ID')" textWrap="false"
                     verticalAlignment="center" />
              <Label col="1" class="pf-pubid-v" :text="pubId" textWrap="false"
                     verticalAlignment="center" />
              <Image col="2" src="res://ic_fox_copy" width="14" height="14"
                     :tintColor="muted" verticalAlignment="center" />
            </GridLayout>
          </StackLayout>

          <!-- bio -->
          <Label v-if="bio" class="pf-bio" :text="bio" textWrap="true" />

          <!-- miembro desde -->
          <StackLayout class="pf-rows">
            <GridLayout class="pp-row" columns="auto,*">
              <Label col="0" class="pp-row-k" :text="t('Miembro desde')"
                     textWrap="false" verticalAlignment="center" />
              <Label col="1" class="pp-row-v" :text="joined" textWrap="false"
                     verticalAlignment="center" />
            </GridLayout>
          </StackLayout>

          <!-- acción principal (icono + texto centrados) -->
          <GridLayout class="btn btn-full btn-ic" rows="*" @tap="edit">
            <StackLayout row="0" orientation="horizontal"
                        horizontalAlignment="center" verticalAlignment="center">
              <Image src="res://ic_fox_pencil" width="18" height="18"
                     :tintColor="onAccent" verticalAlignment="center" />
              <Label class="btn-ic-t" :text="t('Editar perfil')"
                     textWrap="false" verticalAlignment="center" />
            </StackLayout>
          </GridLayout>
        </StackLayout>
      </ScrollView>

      <!-- ---------- menú de estado (hoja inferior) ---------- -->
      <StackLayout v-if="menuOpen" row="2" class="pf-status-menu">
        <GridLayout class="pf-menu-title" columns="*,auto">
          <Label col="0" :text="t('Estado')" textWrap="false"
                 verticalAlignment="center" />
          <FoxIconBtn col="1" icon="x" bare :size="28" :ic="14" :tint="muted"
                      accessibilityLabel="close" @tap="menuOpen = false" />
        </GridLayout>

        <Label class="pf-menu-label" :text="t('Mensaje personalizado')"
               textWrap="false" />
        <TextField class="input pf-status-input" :text="statusDraft"
                   :hint="t('¿Qué estás haciendo?')" :placeholderColor="muted"
                   :maxLength="80" :editable="!statusBusy"
                   returnKeyType="done" @textChange="onDraft"
                   @submit="saveCustom" />

        <GridLayout class="pf-menu-meta" columns="*,auto">
          <Label col="0" :text="statusDraft.length + '/80'" textWrap="false"
                 verticalAlignment="center" />
          <Label v-if="statusDraft" col="1" class="pf-link"
                 :text="t('Quitar mensaje')" textWrap="false"
                 verticalAlignment="center" @tap="clearCustom" />
        </GridLayout>

        <StackLayout class="pf-menu-presets">
          <GridLayout v-for="p in presets" :key="p.val" class="pf-preset"
                      :class="{ on: myPreset === p.val }" columns="auto,*,auto"
                      @tap="choosePreset(p)">
            <StackLayout col="0" class="sdot" width="14" height="14"
                         verticalAlignment="center"
                         borderRadius="7" :backgroundColor="stDotColor(p.val)"
                         :borderColor="panel" borderWidth="2" />
            <Label col="1" class="pf-preset-t" :text="t(p.label)" textWrap="false"
                   verticalAlignment="center" />
            <Image v-if="myPreset === p.val" col="2" src="res://ic_fox_check"
                   width="16" height="16" :tintColor="accent"
                   verticalAlignment="center" />
          </GridLayout>
        </StackLayout>

        <Label v-if="statusErr" class="pf-menu-error" :text="statusErr"
               textWrap="true" />

        <Button class="btn btn-full pf-menu-save"
                :text="statusBusy ? t('Guardando…') : t('Guardar mensaje')"
                :class="{ busy: statusBusy }" :enabled="!statusBusy"
                @tap="saveCustom" />

        <Label class="pf-menu-hint"
               :text="t('No molestar silencia los avisos; Invisible te deja conectado sin aparecer en línea.')"
               textWrap="true" />
      </StackLayout>
    </GridLayout>
  </Page>
</template>

<script setup lang="ts">
  import { computed, ref } from 'nativescript-vue';
  import { store, toast } from '../core/store.js';
  import { api, saveSession, session } from '../core/api.js';
  import { mediaUrl } from '../core/actions.js';
  import { t } from '../core/i18n.js';
  import { back, goMyProfileEdit, openMedia } from '../nav';
  import {
    STATUS_PRESETS, dotState, joinedLine, stDotColor, statusOf, tok,
  } from '../fmt';
  import { copyToClipboard } from '../clipboard';
  import FoxAvatar from '../components/FoxAvatar.vue';
  import FoxBanner from '../components/FoxBanner.vue';
  import FoxIconBtn from '../components/FoxIconBtn.vue';

  const theme = computed(() => store.theme);
  const accent = computed(() => tok(store.theme, 'accent'));
  const muted = computed(() => tok(store.theme, 't2'));
  const panel = computed(() => tok(store.theme, 'panel'));
  const onAccent = computed(() => tok(store.theme, 'onAccent'));
  const ring = computed(() => tok(store.theme, 'bg'));

  /* ---- datos del usuario (el store compartido) ---- */
  const u = computed<any>(() => (store as any).user || null);

  const name = computed(() => {
    const x = u.value;
    return (x && (x.display_name || x.username)) || '';
  });
  const username = computed(() => (u.value && u.value.username) || '');
  const pubId = computed(() => (u.value && u.value.pub_id) || '');
  const bio = computed(() => (u.value && u.value.bio) || '');

  const initial = computed(() => {
    const n = name.value.trim();
    return n ? n.charAt(0).toUpperCase() : '?';
  });

  const avatar = computed(() => {
    const x = u.value;
    if (!x || !x.avatar_url) return '';
    try { return mediaUrl(x.avatar_url); } catch (e) { return ''; }
  });

  const banner = computed(() => {
    const x = u.value;
    if (!x || !x.banner_url) return '';
    try { return mediaUrl(x.banner_url); } catch (e) { return ''; }
  });

  const joined = computed(() => joinedLine(u.value));

  /* Puntito: para MI perfil el "en línea" sale del WebSocket (igual que
     dotClass(u, store.ws === 'on') en la web). */
  const dot = computed(() => dotState(u.value, store.ws === 'on'));

  const myStatus = computed(() => statusOf(u.value) || t('En línea'));
  const myPreset = computed(() => (u.value && u.value.status_preset) || 'online');

  /* El menú pinta el puntito con el MISMO color que la web. */
  const dotBg = computed(() => (
    dot.value === 'off' ? panel.value : stDotColor(dot.value)));
  const dotBorder = computed(() => (
    dot.value === 'off' ? stDotColor('off') : panel.value));
  const dotBw = computed(() => (dot.value === 'off' ? 3 : 2));

  const presets = STATUS_PRESETS;

  /* ---- menú de estado ---- */
  const menuOpen = ref(false);
  const statusDraft = ref((u.value && u.value.status_text) || '');
  const statusBusy = ref(false);
  const statusErr = ref('');

  function toggleStatus() {
    if (!menuOpen.value) {
      statusDraft.value = (u.value && u.value.status_text) || '';
      statusErr.value = '';
    }
    menuOpen.value = !menuOpen.value;
  }

  function onDraft(ev: any) {
    statusDraft.value = (ev && ev.value) || '';
  }

  async function saveStatus(preset: string, text: string) {
    statusErr.value = '';
    statusBusy.value = true;
    try {
      const r: any = await api('PUT', '/auth/profile', {
        status_preset: preset,
        status_text: text,
      }, { retry401: true });
      const me: any = (store as any).user;
      if (r && r.user) {
        (store as any).user = Object.assign({}, me, r.user);
      } else if (me) {
        me.status_preset = preset;
        me.status_text = text;
      }
      if ((store as any).user) {
        (session as any).user = (store as any).user;
        saveSession();
      }
      menuOpen.value = false;
    } catch (e: any) {
      statusErr.value = (e && t(e.detail)) || t('No se pudo actualizar el estado');
    } finally {
      statusBusy.value = false;
    }
  }

  function choosePreset(p: any) {
    saveStatus(p.val, statusDraft.value.trim());
  }

  function saveCustom() {
    saveStatus(myPreset.value, statusDraft.value.trim());
  }

  function clearCustom() {
    statusDraft.value = '';
    saveStatus(myPreset.value, '');
  }

  /* ---- acciones ---- */
  function copyId() {
    if (pubId.value) {
      copyToClipboard(pubId.value);
      toast(t('ID copiado'), 'ok');
    }
  }

  function viewBanner() {
    if (banner.value) openMedia(banner.value, t('Ver portada'));
  }

  function viewAvatar() {
    if (avatar.value) openMedia(avatar.value, t('Ver foto'));
  }

  function edit() {
    goMyProfileEdit();
  }

  function close() {
    back();
  }
</script>
