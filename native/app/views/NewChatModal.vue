<template>
  <!-- W109: nuevo chat — DM, grupo o agregar miembro al grupo activo.
       Port del NewChatModal.js de la web (mismos modos dm/group/add y
       las mismas teclas t()). Overlay centrado como SearchChatModal. -->
  <GridLayout rows="*,auto,*" columns="*,auto,*" class="newchat">
    <StackLayout row="0" col="0" rowSpan="3" colSpan="3" class="modal-veil"
                 @tap="emit('close')" />

    <GridLayout row="1" col="1" class="modal" :width="modalW" rows="auto,*">
      <GridLayout row="0" class="pp-modal-head" columns="*,auto">
        <StackLayout col="0" orientation="horizontal"
                     verticalAlignment="center">
          <Label class="pp-modal-t" :text="title" textWrap="false" />
        </StackLayout>
        <FoxIconBtn col="1" icon="x" bare :size="32" :ic="16" :tint="muted"
                    accessibilityLabel="cerrar" @tap="emit('close')" />
      </GridLayout>

      <!-- pestañas Chat / Grupo (no en modo agregar miembro) -->
      <GridLayout v-if="store.newChatMode !== 'add'" row="1" class="m-tabs"
                  columns="*,*">
        <Label col="0" class="m-tab" :class="{ on: store.newChatMode === 'dm' }"
               :text="t('Chat')" textWrap="false"
               @tap="store.newChatMode = 'dm'" />
        <Label col="1" class="m-tab" :class="{ on: store.newChatMode === 'group' }"
               :text="t('Grupo')" textWrap="false"
               @tap="store.newChatMode = 'group'" />
      </GridLayout>

      <!-- nombre del grupo (solo modo grupo) -->
      <TextField v-if="store.newChatMode === 'group'" row="2" class="m-title-input"
                 v-model="gtitle" :placeholder="t('Nombre del grupo (máx. 60)')"
                 maxlength="60" autocorrect="false" autocapitalizationType="none" />

      <!-- miembros elegidos (solo modo grupo) -->
      <WrapLayout v-if="store.newChatMode === 'group' && picked.length" row="3"
                  class="g-chips">
        <GridLayout v-for="u in picked" :key="u.id" class="g-chip">
          <Label class="g-chip-name" :text="u.display_name || u.username"
                 textWrap="false" />
          <FoxIconBtn icon="x" bare :size="20" :ic="12" :tint="muted"
                      accessibilityLabel="quitar" @tap="unpick(u)" />
        </GridLayout>
      </WrapLayout>

      <!-- buscador -->
      <GridLayout :row="rowSearch" class="m-search" columns="auto,*,auto">
        <Image col="0" src="res://ic_fox_search" width="16" height="16"
               :tintColor="muted" verticalAlignment="center" />
        <TextField ref="inputEl" col="1" class="m-search-input" v-model="q"
                   :placeholder="t('Buscar por nombre o usuario…')"
                   :placeholderColor="muted" autocorrect="false"
                   autocapitalizationType="none" @input="onQuery"
                   @submit="pickFirst" />
        <FoxIconBtn v-if="q" col="2" icon="x" bare :size="24" :ic="12"
                    :tint="muted" accessibilityLabel="borrar"
                    @tap="q = ''; onQuery()" />
      </GridLayout>

      <!-- resultados -->
      <ScrollView :row="rowResults">
        <StackLayout class="results">
          <GridLayout v-for="u in results" :key="u.id" class="res-item"
                      columns="auto,*,auto"
                      :accessibilityLabel="'resultado ' + u.username"
                      @tap="pick(u)">
            <FoxAvatar col="0" :src="avatarOf(u)" :initial="initial(u)"
                       :size="36" :dot="dotOf(u)" :ring="panelRing" />
            <StackLayout col="1" class="ri-col">
              <Label class="ri-name" :text="u.display_name || u.username"
                     textWrap="false" />
              <Label class="ri-user"
                     :text="'@' + u.username +
                       (store.newChatMode === 'dm' && !isFriend(u)
                         ? ' · ' + (sentTo(u) ? t('Solicitud pendiente')
                           : receivedFrom(u) ? t('Aceptar solicitud')
                           : t('Enviar solicitud'))
                         : '')"
                     textWrap="false" />
            </StackLayout>
            <Image v-if="store.newChatMode === 'group' && isSelected(u)"
                   col="2" src="res://ic_fox_check" width="18" height="18"
                   :tintColor="accent" class="ri-check" />
            <Image v-else-if="store.newChatMode === 'dm' && !isFriend(u)"
                   col="2" src="res://ic_fox_userplus" width="18" height="18"
                   :tintColor="accent" class="ri-check" />
          </GridLayout>
          <Label v-if="q.trim().length >= 2 && !results.length" class="res-empty"
                 :text="t('Sin resultados')" textWrap="true" />
          <Label v-else-if="q.trim().length < 2" class="res-empty dim"
                 :text="t('Escribe al menos 2 letras')" textWrap="true" />
        </StackLayout>
      </ScrollView>

      <!-- botón crear grupo (solo modo grupo) -->
      <GridLayout v-if="store.newChatMode === 'group'" :row="rowFoot"
                  class="m-foot" columns="*">
        <Button col="0" class="btn" :text="busy ? t('Creando…') : t('Crear grupo')"
                :enabled="canCreate && !busy" @tap="createTheGroup" />
      </GridLayout>
    </GridLayout>
  </GridLayout>
</template>

<script setup lang="ts">
  /* W109: nuevo chat (DM / grupo / agregar miembro).
     Port del NewChatModal.js de la web: misma lógica de pick, mismos
     textos t() y misma regla del producto (sin solicitud aceptada no
     se abre un MD → se envía la solicitud y se muestra RequestSentModal). */
  import { ref, computed, onMounted, nextTick } from 'nativescript-vue';
  import { Screen } from '@nativescript/core';
  import { store, toast } from '../core/store.js';
  import {
    loadPeople, searchUsers, addMember, acceptFriendRequest,
    sendFriendRequest, createDm, createGroup, mediaUrl,
  } from '../core/actions.js';
  import { t } from '../core/i18n.js';
  import { tok } from '../fmt';
  import { humanError } from '../core/api.js';
  import FoxAvatar from '../components/FoxAvatar.vue';
  import FoxIconBtn from '../components/FoxIconBtn.vue';

  const emit = defineEmits<{ close: [] }>();

  const q = ref('');
  const results = ref<any[]>([]);
  const inputEl = ref<any>(null);
  const gtitle = ref('');
  const picked = ref<any[]>([]);
  const busy = ref(false);
  let timer: any = null;

  const title = computed(() => {
    if (store.newChatMode === 'group') return t('Nuevo grupo');
    if (store.newChatMode === 'add') return t('Agregar al grupo');
    return t('Nuevo chat');
  });

  const theme = computed(() => store.theme);
  const accent = computed(() => tok(store.theme, 'accent'));
  const muted = computed(() => tok(store.theme, 't2'));
  const panelRing = computed(() => tok(store.theme, 'panel'));

  const modalW = computed(() => {
    try { return Math.min(460, Math.round(Screen.mainScreen.widthDIPs - 32)); }
    catch { return 328; }
  });

  /* filas: pestañas(0) + nombre(1) + chips(2) + buscador(3) + resultados(4) + pie(5)
     Cuando no hay pestañas/nombre/chips/pie, la fila se salta. */
  const rowSearch = computed(() => {
    let r = 1;
    if (store.newChatMode !== 'add') r++;
    if (store.newChatMode === 'group') r++;
    return r;
  });
  const rowResults = computed(() => rowSearch.value + 1);
  const rowFoot = computed(() => rowResults.value + 1);

  const toastErr = (err: any, fallback: string) =>
    toast(humanError(err || { detail: fallback || '' }), 'err');

  /* focus al abrir */
  onMounted(() => {
    nextTick(() => {
      const el: any = inputEl.value;
      const nv = el ? (el.nativeView || el) : null;
      if (nv && typeof nv.focus === 'function') nv.focus();
    });
    if (!store.people) loadPeople().catch(() => {});
  });

  const onQuery = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(run, 300);
  };

  const run = async () => {
    if (q.value.trim().length < 2) { results.value = []; return; }
    try { results.value = await searchUsers(q.value) || []; }
    catch { results.value = []; }
  };

  const isFriend = (u: any) => {
    const fs = (store.people && store.people.friends) || [];
    for (let i = 0; i < fs.length; i++) if (fs[i].id === u.id) return true;
    return false;
  };
  const sentTo = (u: any) => {
    const rs = (store.people && store.people.sent) || [];
    for (let i = 0; i < rs.length; i++)
      if (rs[i].user && rs[i].user.id === u.id) return true;
    return false;
  };
  const receivedFrom = (u: any) => {
    const rs = (store.people && store.people.received) || [];
    for (let i = 0; i < rs.length; i++)
      if (rs[i].user && rs[i].user.id === u.id) return rs[i];
    return null;
  };

  /* dm: crear chat (solo amigos); group: sumar a la selección;
     add: agregar al grupo activo. */
  const pick = async (u: any) => {
    const mode = store.newChatMode;
    if (mode === 'group') {
      let found = -1;
      for (let i = 0; i < picked.value.length; i++)
        if (picked.value[i].id === u.id) found = i;
      if (found >= 0) picked.value.splice(found, 1);
      else picked.value.push(u);
      q.value = ''; results.value = [];
      focusInput();
      return;
    }
    if (mode === 'add') {
      try {
        await addMember(store.activeChatId, u.username);
        emit('close');
      } catch (e: any) {
        toastErr(e, 'No se pudo agregar');
      }
      return;
    }
    /* Regla del producto: sin solicitud aceptada no se abre un MD.
       Si aún no son amigos, este click envía la solicitud. */
    if (!isFriend(u)) {
      if (sentTo(u)) {
        toast(t('Ya enviaste una solicitud a @{n}', { n: u.username }), 'info');
        return;
      }
      const incoming = receivedFrom(u);
      if (incoming) {
        try {
          await acceptFriendRequest(incoming.id);
          toast('Solicitud aceptada', 'ok');
          q.value = ''; results.value = [];
        } catch (e: any) {
          toastErr(e, 'No se pudo aceptar la solicitud');
        }
        return;
      }
      try {
        await sendFriendRequest(u.username);
        q.value = ''; results.value = [];
        emit('close');
        store.requestSent = {
          username: u.username,
          display_name: u.display_name || u.username,
        };
      } catch (e: any) {
        toastErr(e, 'No se pudo enviar la solicitud');
      }
      return;
    }
    try { await createDm(u.username); } catch (e: any) {
      toastErr(e, 'No se pudo crear el chat');
    }
  };

  const unpick = (u: any) => {
    for (let i = 0; i < picked.value.length; i++) {
      if (picked.value[i].id === u.id) { picked.value.splice(i, 1); return; }
    }
  };

  const isSelected = (u: any) => {
    for (let i = 0; i < picked.value.length; i++)
      if (picked.value[i].id === u.id) return true;
    return false;
  };

  const pickFirst = () => { if (results.value.length) pick(results.value[0]); };

  const createTheGroup = async () => {
    const gname = gtitle.value.trim();
    if (!gname) { toast('Escribe un nombre para el grupo', 'err'); return; }
    try {
      const names = picked.value.map((u) => u.username);
      await createGroup(gname, names);
    } catch (e: any) {
      toastErr(e, 'No se pudo crear el grupo');
    }
  };

  const focusInput = () => {
    nextTick(() => {
      const el: any = inputEl.value;
      const nv = el ? (el.nativeView || el) : null;
      if (nv && typeof nv.focus === 'function') nv.focus();
    });
  };

  /* helpers de render (mismo estilo que NewGroupView/PeopleView) */
  const nameOf = (u: any) => u ? (u.display_name || u.username || '') : '';
  const initial = (u: any) => { const n = nameOf(u).trim(); return n ? n.charAt(0).toUpperCase() : '?'; };
  const avatarOf = (u: any) => {
    if (!u || !u.avatar_url) return '';
    try { return mediaUrl(u.avatar_url); } catch { return ''; }
  };
  const dotOf = (u: any) => {
    if (!u) return '';
    const p = store.presence;
    if (p && p[u.id] != null) return !!p[u.id] ? 'on' : '';
    return !!u.online ? 'on' : '';
  };
  const canCreate = computed(() => gtitle.value.trim().length > 0 && !busy.value);
</script>
