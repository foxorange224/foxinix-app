<template>
  <!-- W103: ficha de usuario con el estilo de la web: portada, avatar
       encima de la portada, nombre debajo (como Discord), estado, bio y
       los botones de acción. -->
  <Page :class="'fox-' + theme" actionBarHidden="true">
    <GridLayout rows="auto,*" class="pf-page">
      <!-- ---------- cabecera ---------- -->
      <GridLayout row="0" class="side-head" columns="auto,*">
        <FoxIconBtn col="0" icon="back" bare :tint="accent" @tap="close" />
        <Label col="1" class="sh-title" :text="t('Perfil')" textWrap="false" />
      </GridLayout>

      <ScrollView row="1">
        <StackLayout>
          <!-- ---------- portada ---------- -->
          <GridLayout class="pf-banner" rows="auto">
            <Image v-if="banner" class="pf-banner-img" :src="banner"
                   stretch="aspectFill" />
            <Image v-else class="pf-banner-art" src="res://ic_fox_logo_mark"
                   width="128" height="128" :tintColor="tokOnAccent" opacity="0.18" />
          </GridLayout>

          <!-- ---------- avatar (encima de la portada) ---------- -->
          <StackLayout class="pf-idrow">
            <FoxAvatar class="pf-av" :src="avatar" :initial="initial" :size="80"
                       :dot="dot" :ring="ring" />
          </StackLayout>

          <!-- ---------- nombre y usuario ---------- -->
          <StackLayout class="pf-idbelow">
            <Label class="pf-name" :text="name" textWrap="true" />
            <Label class="pf-user" :text="'@' + username" textWrap="false" />
          </StackLayout>

          <!-- ---------- estado ---------- -->
          <Label v-if="statusLine" class="pf-status" :text="statusLine"
                 textWrap="true" />

          <!-- ---------- bio ---------- -->
          <Label v-if="bio" class="pf-bio" :text="bio" textWrap="true" />

          <!-- ---------- acción principal según la relación ---------- -->
          <Button class="btn btn-full pf-act" :text="mainAction"
                  :enabled="mainEnabled && !busy" @tap="doMain" />

          <!-- bloquear / desbloquear -->
          <Button v-if="relation !== 'me'" class="btn btn-ghost btn-full pf-act"
                  :text="relation === 'blocked' ? t('Desbloquear') : t('Bloquear')"
                  :enabled="!busy" @tap="toggleBlock" />

          <Label v-if="err" class="form-err pf-err" :text="err" textWrap="true" />
        </StackLayout>
      </ScrollView>
    </GridLayout>
  </Page>
</template>

<script setup lang="ts">
  import { ref, computed, onMounted } from 'nativescript-vue';
  import { store, toast } from '../core/store.js';
  import {
    blockUser, createDm, loadProfile, mediaUrl, sendFriendRequest, unblockUser,
  } from '../core/actions.js';
  import { t } from '../core/i18n.js';
  import { back, backToChats } from '../nav';
  import { tok, dotState } from '../fmt';
  import FoxAvatar from '../components/FoxAvatar.vue';
  import FoxIconBtn from '../components/FoxIconBtn.vue';

  /* El id del usuario viene de la navegación nativa. */
  const props = defineProps<{ userId: number }>();

  const user = ref<any>(null);
  const relation = ref('none');
  const err = ref('');
  const busy = ref(false);

  const theme = computed(() => store.theme);
  const accent = computed(() => tok(store.theme, 'accent'));
  const tokOnAccent = computed(() => tok(store.theme, 'onAccent'));
  const ring = computed(() => tok(store.theme, 'bg'));

  const name = computed(() => {
    const u = user.value;
    if (!u) return '';
    return u.display_name || u.username || '';
  });

  const username = computed(() => (user.value && user.value.username) || '');

  const initial = computed(() => {
    const n = name.value.trim();
    return n ? n.charAt(0).toUpperCase() : '?';
  });

  const avatar = computed(() => {
    const u = user.value;
    if (!u || !u.avatar_url) return '';
    try { return mediaUrl(u.avatar_url); } catch (e) { return ''; }
  });

  const banner = computed(() => {
    const u = user.value;
    if (!u || !u.banner_url) return '';
    try { return mediaUrl(u.banner_url); } catch (e) { return ''; }
  });

  const bio = computed(() => (user.value && user.value.bio) || '');

  /* Puntito de estado (como en la web). */
  const dot = computed(() => (user.value ? dotState(user.value) : ''));

  const statusLine = computed(() => {
    const u = user.value;
    if (!u) return '';
    if (u.status_text) return u.status_text;
    if (u.status_preset === 'busy') return t('Ausente');
    if (u.status_preset === 'dnd') return t('No molestar');
    if (u.status_preset === 'invisible') return t('Invisible');
    return u.online ? t('En línea') : t('Desconectado');
  });

  const mainAction = computed(() => {
    if (relation.value === 'friend') return t('Mensaje');
    if (relation.value === 'sent') return t('Solicitud pendiente');
    if (relation.value === 'received') return t('Solicitud recibida');
    if (relation.value === 'blocked') return t('Bloqueado');
    if (relation.value === 'me') return t('Es tu cuenta');
    return t('Enviar solicitud');
  });

  const mainEnabled = computed(() => {
    return relation.value === 'friend' || relation.value === 'none';
  });

  function run(fn: () => any, okMsg?: string) {
    busy.value = true;
    Promise.resolve(fn()).then(() => {
      if (okMsg) toast(okMsg, 'ok');
    }).catch((e: any) => {
      toast((e && e.detail) || t('No se pudo completar la acción'), 'err');
    }).then(() => {
      busy.value = false;
    });
  }

  async function doMain() {
    if (!user.value) return;
    if (relation.value === 'friend') {
      await createDm(user.value.username);
      backToChats();
      return;
    }
    if (relation.value === 'none') {
      run(async () => {
        await sendFriendRequest(user.value.username);
        relation.value = 'sent';
      }, t('Solicitud enviada'));
    }
  }

  function toggleBlock() {
    if (!user.value) return;
    if (relation.value === 'blocked') {
      run(async () => {
        await unblockUser(user.value.username);
        relation.value = 'none';
      }, t('Usuario desbloqueado'));
    } else {
      run(async () => {
        await blockUser(user.value.username);
        relation.value = 'blocked';
      }, t('Usuario bloqueado'));
    }
  }

  function close() {
    back();
  }

  onMounted(async () => {
    err.value = '';
    try {
      const r = await loadProfile(props.userId);
      user.value = r.user;
      relation.value = r.relation;
    } catch (e: any) {
      err.value = (e && e.detail) || t('No se pudo cargar el perfil');
    }
  });
</script>
