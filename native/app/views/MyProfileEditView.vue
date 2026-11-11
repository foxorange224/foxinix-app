<template>
  <!-- W107: "Editar perfil" — el modal .mp-edit de la web
       (MeProfileEditModal): portada con posición, foto montada encima,
       nombre, @usuario (cambio aparte), estado con presets, bio con
       contador y el pie Cancelar / Guardar. -->
  <Page :class="'fox-' + theme" actionBarHidden="true">
    <GridLayout rows="auto,*,auto" class="mp-page">
      <!-- ---------- cabecera ---------- -->
      <GridLayout row="0" class="side-head" columns="auto,*">
        <FoxIconBtn col="0" icon="back" bare :tint="accent"
                    accessibilityLabel="back" @tap="close" />
        <Label col="1" class="sh-title" :text="t('Editar perfil')" textWrap="false" />
      </GridLayout>

      <!-- ---------- formulario ---------- -->
      <ScrollView row="1">
        <StackLayout class="mp-body">
          <!-- portada + foto montada encima -->
          <StackLayout class="pf-edit-banner">
            <FoxBanner class="pf-edit-banner-img" :src="bannerSrc"
                       :position="bannerPos" :height="96"
                       :boxWidth="bannerBox" :rounded="true" />

            <GridLayout class="avatar-pick" rows="*" columns="*"
                        :width="108" :height="108"
                        horizontalAlignment="center">
              <FoxAvatar row="0" col="0" :src="avatarSrc" :initial="initial"
                         :size="108" :ring="ring" />
              <GridLayout v-if="hasPhoto" class="av-clear" rows="*" columns="*"
                          horizontalAlignment="left" verticalAlignment="top"
                          @tap="removeAvatar">
                <Image row="0" col="0" src="res://ic_fox_x" width="14" height="14"
                       :tintColor="muted" horizontalAlignment="center"
                       verticalAlignment="center" />
              </GridLayout>
              <GridLayout class="av-btn" rows="*" columns="*"
                          horizontalAlignment="right" verticalAlignment="bottom"
                          @tap="pickAvatar">
                <Image row="0" col="0" src="res://ic_fox_image" width="17"
                       height="17" :tintColor="onAccent"
                       horizontalAlignment="center" verticalAlignment="center" />
              </GridLayout>
            </GridLayout>

            <WrapLayout class="pf-edit-banner-actions">
              <StackLayout class="btn btn-ghost btn-sm" @tap="pickBanner">
                <Label class="btn-sm-t" :text="t('Cambiar portada')"
                       textWrap="false" />
              </StackLayout>
              <StackLayout v-if="hasBanner" class="btn btn-ghost btn-sm"
                           @tap="removeBanner">
                <Label class="btn-sm-t" :text="t('Quitar portada')"
                       textWrap="false" />
              </StackLayout>
            </WrapLayout>

            <GridLayout v-if="hasBanner" class="pf-pos-row" columns="auto,*,auto">
              <Label col="0" class="pf-pos-l" :text="t('Posición de la portada')"
                     textWrap="false" verticalAlignment="center" />
              <Slider col="1" :value="bannerPos" :minValue="0" :maxValue="100"
                      verticalAlignment="center" @valueChange="onPos" />
              <Label col="2" class="pf-pos-val" :text="posLabel" textWrap="false"
                     verticalAlignment="center" />
            </GridLayout>
          </StackLayout>

          <Label v-if="err" class="form-err" :text="err" textWrap="true" />

          <!-- nombre -->
          <StackLayout class="field">
            <Label class="field-label" :text="t('Nombre')" textWrap="false" />
            <TextField class="input" :text="name" :hint="t('Tu nombre')"
                       :placeholderColor="muted" :maxLength="50"
                       :editable="!busy" @textChange="name = $event.value" />
          </StackLayout>

          <!-- @usuario: se cambia en una pantalla aparte (W60) -->
          <StackLayout class="field uname-field">
            <Label class="field-label" :text="t('Usuario')" textWrap="false" />
            <GridLayout class="uname-current" columns="auto,*,auto">
              <Label col="0" class="uname-at" text="@" textWrap="false"
                     verticalAlignment="center" />
              <Label col="1" class="uname-now" :text="username" textWrap="false"
                     verticalAlignment="center" />
              <Button col="2" class="btn btn-ghost btn-sm uname-go"
                      :text="t('Cambiar usuario')" @tap="goUname" />
            </GridLayout>
            <Label class="hint"
                   :text="t('Sirve para iniciar sesión y para que te mencionen con @.')"
                   textWrap="true" />
          </StackLayout>

          <!-- estado -->
          <StackLayout class="field">
            <Label class="field-label" :text="t('Estado')" textWrap="false" />
            <TextField class="input" :text="statusText" :hint="t('jugando a algo…')"
                       :placeholderColor="muted" :maxLength="80"
                       :editable="!busy" @textChange="statusText = $event.value" />
          </StackLayout>

          <WrapLayout class="mp-presets">
            <GridLayout v-for="p in presets" :key="p.val" class="ap-chip"
                        :class="{ on: preset === p.val }" columns="auto,auto"
                        @tap="preset = p.val">
              <StackLayout col="0" class="sdot" width="12" height="12"
                           verticalAlignment="center"
                           borderRadius="6" :backgroundColor="stDotColor(p.val)"
                           :borderColor="panel" borderWidth="2" />
              <Label col="1" class="ap-chip-t" :text="t(p.label)" textWrap="false"
                     verticalAlignment="center" />
            </GridLayout>
          </WrapLayout>

          <Label class="hint mp-preset-hint"
                 :text="t('No molestar silencia los avisos; solo las menciones directas (@usuario) te avisan. Invisible te deja conectado sin aparecer en línea.')"
                 textWrap="true" />

          <!-- bio -->
          <StackLayout class="field">
            <Label class="field-label" text="Bio" textWrap="false" />
            <TextView class="input bio-input" :text="bio"
                      :hint="t('Cuéntanos algo sobre ti…')" :placeholderColor="muted"
                      :maxLength="300" :height="88" :editable="!busy"
                      @textChange="bio = $event.value" />
            <Label class="pf-bio-count" :text="bioCount + '/300'" textWrap="false" />
            <Label class="hint" :text="bioHint" textWrap="true" />
          </StackLayout>
        </StackLayout>
      </ScrollView>

      <!-- ---------- pie ---------- -->
      <GridLayout row="2" class="m-foot" columns="*,*">
        <Button col="0" class="btn btn-ghost" :text="t('Cancelar')"
                :enabled="!busy" @tap="close" />
        <Button col="1" class="btn" :class="{ busy: busy }"
                :text="busy ? t('Guardando…') : t('Guardar')"
                :enabled="!busy" @tap="save" />
      </GridLayout>
    </GridLayout>
  </Page>
</template>

<script setup lang="ts">
  import { computed, ref } from 'nativescript-vue';
  import { Dialogs, Screen } from '@nativescript/core';
  import { store } from '../core/store.js';
  import { api, saveSession, session, uploadMedia } from '../core/api.js';
  import { charCount, mediaUrl } from '../core/actions.js';
  import { t } from '../core/i18n.js';
  import { back, goUsername } from '../nav';
  import { STATUS_PRESETS, bannerPositionOf, stDotColor, tok } from '../fmt';
  import { pickImage } from '../files';
  import FoxAvatar from '../components/FoxAvatar.vue';
  import FoxBanner from '../components/FoxBanner.vue';
  import FoxIconBtn from '../components/FoxIconBtn.vue';

  const u: any = (store as any).user || {};

  const theme = computed(() => store.theme);
  const accent = computed(() => tok(store.theme, 'accent'));
  const muted = computed(() => tok(store.theme, 't2'));
  const panel = computed(() => tok(store.theme, 'panel'));
  const onAccent = computed(() => tok(store.theme, 'onAccent'));
  const ring = computed(() => tok(store.theme, 'panel'));

  /* ---- campos ---- */
  const name = ref(u.display_name || '');
  const bio = ref(u.bio || '');
  const statusText = ref(u.status_text || '');
  const preset = ref(u.status_preset || 'online');
  const presets = STATUS_PRESETS;

  const busy = ref(false);
  const err = ref('');

  const username = computed(
    () => ((store as any).user && (store as any).user.username) || '',
  );

  const initial = computed(() => {
    const n = String(name.value || '').trim();
    return n ? n.charAt(0).toUpperCase() : '?';
  });

  /* ---- foto de perfil ---- */
  const hadAvatar = !!u.avatar_url;
  const avatarGone = ref(false);
  const avatarFile = ref<any>(null);
  const preview = ref('');

  const hasPhoto = computed(() => !!preview.value
    || (!avatarGone.value && !!(store as any).user
      && (store as any).user.avatar_url));

  const avatarSrc = computed(() => {
    if (preview.value) return preview.value;
    const x = (store as any).user;
    if (!hasPhoto.value || !x || !x.avatar_url) return '';
    try { return mediaUrl(x.avatar_url); } catch (e) { return ''; }
  });

  async function pickAvatar() {
    const f = await pickImage();
    if (!f) return;
    if (f.type && f.type.indexOf('image/') !== 0) {
      err.value = t('Elige una imagen');
      return;
    }
    /* W66c: la foto de perfil pesa hasta 3 MB (el server también). */
    if (f.size > 3 * 1024 * 1024) {
      err.value = t('La imagen supera los 3 MB');
      return;
    }
    err.value = '';
    avatarFile.value = f;
    preview.value = f.path;
    avatarGone.value = false;
  }

  /* Quitar la foto pide confirmación (W17: es un cambio visible). */
  async function removeAvatar() {
    let ok = false;
    try {
      ok = await Dialogs.confirm({
        title: t('Quitar foto de perfil'),
        message: t('¿Seguro que quieres quitar tu foto de perfil? Se quitará cuando guardes los cambios.'),
        okButtonText: t('Quitar foto'),
        cancelButtonText: t('Cancelar'),
      });
    } catch (e) { ok = false; }
    if (!ok) return;
    avatarFile.value = null;
    preview.value = '';
    if (hadAvatar) avatarGone.value = true;
  }

  /* ---- portada ---- */
  const hadBanner = !!u.banner_url;
  const bannerGone = ref(false);
  const bannerFile = ref<any>(null);
  const bannerPreview = ref('');
  const bannerPos = ref(bannerPositionOf(u));

  const hasBanner = computed(() => !!bannerPreview.value
    || (!bannerGone.value && !!(store as any).user
      && (store as any).user.banner_url));

  const bannerSrc = computed(() => {
    if (bannerPreview.value) return bannerPreview.value;
    const x = (store as any).user;
    if (!hasBanner.value || !x || !x.banner_url) return '';
    try { return mediaUrl(x.banner_url); } catch (e) { return ''; }
  });

  /* Ancho del hueco de la portada: el del contenido (pantalla - 32). */
  const bannerBox = computed(() => {
    try { return Math.max(120, Screen.mainScreen.widthDIPs - 32); }
    catch (e) { return 0; }
  });

  const posLabel = computed(() => Math.round(bannerPos.value) + '%');

  function onPos(ev: any) {
    bannerPos.value = Number(ev && ev.value) || 0;
  }

  async function pickBanner() {
    const f = await pickImage();
    if (!f) return;
    if (f.type && f.type.indexOf('image/') !== 0) {
      err.value = t('Elige una imagen');
      return;
    }
    if (f.size > 3 * 1024 * 1024) {
      err.value = t('La imagen supera los 3 MB');
      return;
    }
    err.value = '';
    bannerFile.value = f;
    bannerPreview.value = f.path;
    bannerGone.value = false;
    bannerPos.value = 50;          // una portada nueva empieza centrada
  }

  function removeBanner() {
    if (!hasBanner.value) return;
    bannerFile.value = null;
    bannerPreview.value = '';
    bannerGone.value = hadBanner;
    bannerPos.value = 50;
  }

  /* ---- bio ---- */
  const bioCount = computed(() => charCount(bio.value));
  const bioHint = computed(() => t('Se muestra con')
    + ' markdown: '
    + t('**negrita**, *cursiva*, `código`, ~~tachado~~ y [links](https://…)'));

  /* ---- guardar ---- */
  async function save() {
    err.value = '';
    if (name.value.length > 50) {
      err.value = t('El nombre supera los 50 caracteres');
      return;
    }
    if (charCount(bio.value) > 300) {
      err.value = t('La bio supera los 300 caracteres');
      return;
    }
    if (statusText.value.length > 80) {
      err.value = t('El estado supera los 80 caracteres');
      return;
    }
    busy.value = true;
    try {
      const body: any = {
        display_name: String(name.value).trim(),
        bio: String(bio.value).trim(),
        status_text: String(statusText.value).trim(),
        status_preset: preset.value,
        banner_position: Math.round(bannerPos.value),
      };
      if (avatarFile.value) {
        const up: any = await uploadMedia(avatarFile.value);
        body.avatar_media_id = up.id;
      } else if (avatarGone.value) {
        body.avatar_media_id = null;
      }
      if (bannerFile.value) {
        const upB: any = await uploadMedia(bannerFile.value);
        body.banner_media_id = upB.id;
      } else if (bannerGone.value) {
        body.banner_media_id = null;
      }
      const r: any = await api('PUT', '/auth/profile', body, { retry401: true });
      if (r && r.user) {
        (store as any).user = Object.assign({}, (store as any).user, r.user);
        (session as any).user = (store as any).user;
        saveSession();
      }
      close();
    } catch (e: any) {
      err.value = (e && t(e.detail)) || t('No se pudo guardar el perfil');
    } finally {
      busy.value = false;
    }
  }

  function goUname() {
    goUsername();
  }

  /* Cancelar (o guardar) vuelve a "Tu perfil". */
  function close() {
    back();
  }
</script>
