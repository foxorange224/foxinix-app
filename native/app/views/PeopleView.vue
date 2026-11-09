<template>
  <!-- W103: panel de personas con el estilo de la web: cabecera, pestañas
       con subrayado naranja (.ppl-tab), buscador en pastilla (.search-pill)
       y filas con avatar de 36 (.ppl-row). -->
  <Page :class="'fox-' + theme" actionBarHidden="true">
    <GridLayout rows="auto,auto,auto,*" class="ppl-page">
      <!-- ---------- cabecera ---------- -->
      <GridLayout row="0" class="side-head" columns="auto,*,auto">
        <FoxIconBtn col="0" icon="back" bare :tint="accent" @tap="backToChats" />
        <Label col="1" class="sh-title" :text="t('Personas')" textWrap="false" />
        <FoxIconBtn col="2" icon="users" bare :tint="accent" @tap="goNewGroup" />
      </GridLayout>

      <!-- ---------- pestañas ---------- -->
      <GridLayout row="1" class="ppl-tabs" columns="*,*">
        <Label col="0" class="ppl-tab" :class="{ on: tab === 'active' }"
               :text="t('Activos')" textWrap="false" @tap="tab = 'active'" />
        <Label col="1" class="ppl-tab" :class="{ on: tab === 'req' }"
               :text="nReq ? t('Solicitudes ({n})', { n: nReq }) : t('Solicitudes')"
               textWrap="false" @tap="tab = 'req'" />
      </GridLayout>

      <!-- ---------- buscador ---------- -->
      <GridLayout row="2" class="ppl-find" columns="auto,*">
        <Image col="0" src="res://ic_fox_search" width="18" height="18"
               :tintColor="muted" verticalAlignment="center" />
        <TextField col="1" class="ppl-input" :text="q"
                   :hint="tab === 'active'
                     ? t('Buscar personas por usuario')
                     : t('Buscar solicitudes')"
                   :placeholderColor="muted"
                   autocorrect="false" autocapitalizationType="none"
                   @textChange="onQuery" />
      </GridLayout>

      <!-- ---------- lista ---------- -->
      <ScrollView row="3">
        <StackLayout class="ppl-list">
          <!-- ===== pestaña Activos ===== -->
          <StackLayout v-if="tab === 'active'">
            <!-- resultados de búsqueda -->
            <StackLayout v-if="q.trim().length >= 2">
              <GridLayout v-for="u in results" :key="'r' + u.id" class="ppl-row"
                          columns="auto,*,auto" @tap="openResult(u)">
                <FoxAvatar col="0" :src="avatarOf(u)" :initial="initial(u)"
                           :size="36" :dot="dotOf(u)" :ring="panelRing" />
                <StackLayout col="1" class="ppl-col">
                  <Label class="ppl-name" :text="nameOf(u)" textWrap="false" />
                  <Label class="ppl-sub" :text="'@' + u.username" textWrap="false" />
                </StackLayout>
                <Button col="2" class="btn-xs" :text="actionFor(u)"
                        :enabled="actionFor(u) !== t('Solicitud enviada')"
                        @tap="actOnSearch(u)" />
              </GridLayout>
              <Label v-if="!results.length && !searching" class="fox-empty"
                     :text="t('Sin resultados')" textWrap="true" />
              <Label v-if="searching" class="fox-empty" :text="t('Buscando…')"
                     textWrap="true" />
            </StackLayout>

            <!-- amigos -->
            <StackLayout v-else>
              <GridLayout v-for="u in friends" :key="'f' + u.id" class="ppl-row"
                          columns="auto,*,auto" @tap="openFriend(u)">
                <FoxAvatar col="0" :src="avatarOf(u)" :initial="initial(u)"
                           :size="36" :dot="dotOf(u)" :ring="panelRing" />
                <StackLayout col="1" class="ppl-col">
                  <Label class="ppl-name" :text="nameOf(u)" textWrap="false" />
                  <Label class="ppl-sub" :text="lineOf(u)" textWrap="false" />
                </StackLayout>
                <Label col="2" class="ppl-go" text="›" />
              </GridLayout>
              <Label v-if="loaded && !friends.length" class="fox-empty"
                     :text="t('Aún no tienes amigos. ¡Busca personas arriba para empezar!')"
                     textWrap="true" />
              <Label v-else-if="!loaded" class="fox-empty" :text="t('Cargando…')"
                     textWrap="true" />
            </StackLayout>
          </StackLayout>

          <!-- ===== pestaña Solicitudes ===== -->
          <StackLayout v-else>
            <Label v-if="sent.length" class="st-h" :text="t('Enviadas')" />
            <GridLayout v-for="r in sent" :key="'s' + r.id" class="ppl-row"
                        columns="auto,*,auto">
              <FoxAvatar col="0" :src="avatarOf(r.user)" :initial="initial(r.user)"
                         :size="36" :dot="dotOf(r.user)" :ring="panelRing" />
              <StackLayout col="1" class="ppl-col">
                <Label class="ppl-name" :text="nameOf(r.user)" textWrap="false" />
                <Label class="ppl-sub"
                       :text="'@' + (r.user && r.user.username || '')" textWrap="false" />
              </StackLayout>
              <Button col="2" class="btn-xs ghost" :text="t('Cancelar')"
                      @tap="cancelReq(r)" />
            </GridLayout>

            <Label v-if="recv.length" class="st-h" :text="t('Recibidas')" />
            <GridLayout v-for="r in recv" :key="'v' + r.id" class="ppl-row"
                        columns="auto,*,auto,auto">
              <FoxAvatar col="0" :src="avatarOf(r.user)" :initial="initial(r.user)"
                         :size="36" :dot="dotOf(r.user)" :ring="panelRing" />
              <StackLayout col="1" class="ppl-col">
                <Label class="ppl-name" :text="nameOf(r.user)" textWrap="false" />
                <Label class="ppl-sub"
                       :text="'@' + (r.user && r.user.username || '')" textWrap="false" />
              </StackLayout>
              <Button col="2" class="btn-xs" :text="t('Aceptar')"
                      @tap="acceptReq(r)" />
              <Button col="3" class="btn-xs ghost" :text="t('Rechazar')"
                      @tap="rejectReq(r)" />
            </GridLayout>

            <Label v-if="!sent.length && !recv.length" class="fox-empty"
                   :text="t('No hay solicitudes pendientes')" textWrap="true" />
          </StackLayout>
        </StackLayout>
      </ScrollView>
    </GridLayout>
  </Page>
</template>

<script setup lang="ts">
  import { ref, computed, onMounted } from 'nativescript-vue';
  import { store, toast } from '../core/store.js';
  import {
    acceptFriendRequest, cancelFriendRequest, createDm, loadPeople, mediaUrl,
    rejectFriendRequest, searchUsers, sendFriendRequest,
  } from '../core/actions.js';
  import { t } from '../core/i18n.js';
  import { backToChats, goProfile, goView } from '../nav';
  import { tok, dotState } from '../fmt';
  import FoxAvatar from '../components/FoxAvatar.vue';
  import FoxIconBtn from '../components/FoxIconBtn.vue';

  const tab = ref<'active' | 'req'>('active');
  const q = ref('');
  const results = ref<any[]>([]);
  const searching = ref(false);

  const theme = computed(() => store.theme);
  const accent = computed(() => tok(store.theme, 'accent'));
  const muted = computed(() => tok(store.theme, 't2'));
  const panelRing = computed(() => tok(store.theme, 'panel'));

  const people = computed(() => store.people || { friends: [], sent: [], received: [] });
  const loaded = computed(() => !!store.people);
  const nReq = computed(() => people.value.received.length);

  /* En móvil se muestran TODOS los amigos (no sólo los conectados): en
     el teléfono la gente no está siempre en línea, y los desconectados
     también se necesitan para escribirles. Los que están en línea
     salen primero. */
  const friends = computed(() => {
    const fs = people.value.friends.slice();
    fs.sort((a, b) => (friendOn(b) ? 1 : 0) - (friendOn(a) ? 1 : 0));
    return fs;
  });

  const sent = computed(() => people.value.sent);
  const recv = computed(() => people.value.received);

  function friendOn(u: any): boolean {
    if (!u) return false;
    const p = store.presence;
    if (p && p[u.id] != null) return !!p[u.id];
    return !!u.online;
  }

  function nameOf(u: any): string {
    if (!u) return '';
    return u.display_name || u.username || '';
  }

  /* Avatar real (URL firmada del CDN) o '' si no hay. */
  function avatarOf(u: any): string {
    if (!u || !u.avatar_url) return '';
    try { return mediaUrl(u.avatar_url); } catch (e) { return ''; }
  }

  function initial(u: any): string {
    const n = nameOf(u).trim();
    return n ? n.charAt(0).toUpperCase() : '?';
  }

  /* Puntito de estado (como el de la web). */
  function dotOf(u: any): string {
    return u ? dotState(u) : '';
  }

  function lineOf(u: any): string {
    if (!friendOn(u)) return t('Desconectado');
    if (u.status_text) return u.status_text;
    if (u.status_preset === 'busy') return t('Ausente');
    if (u.status_preset === 'dnd') return t('No molestar');
    return t('En línea');
  }

  function isFriend(u: any): boolean {
    const fs = people.value.friends;
    for (let i = 0; i < fs.length; i++) if (fs[i].id === u.id) return true;
    return false;
  }

  function sentTo(u: any): number {
    const rs = people.value.sent;
    for (let i = 0; i < rs.length; i++) {
      if (rs[i].user && rs[i].user.id === u.id) return rs[i].id;
    }
    return 0;
  }

  function actionFor(u: any): string {
    if (isFriend(u)) return t('Mensaje');
    if (sentTo(u)) return t('Solicitud enviada');
    return t('Enviar solicitud');
  }

  /* Búsqueda con rebote de 300 ms (mínimo 2 caracteres), igual que la
     web: no se pega una petición por cada tecla. */
  let timer: any = 0;
  function onQuery(ev: any) {
    q.value = (ev && ev.value) || '';
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      const s = q.value.trim();
      if (s.length < 2) {
        results.value = [];
        searching.value = false;
        return;
      }
      searching.value = true;
      searchUsers(s).then((rs) => {
        results.value = rs || [];
        searching.value = false;
      }).catch(() => {
        results.value = [];
        searching.value = false;
      });
    }, 300);
  }

  function run(fn: () => any, okMsg?: string) {
    Promise.resolve(fn()).then(() => {
      if (okMsg) toast(okMsg, 'ok');
    }).catch((err: any) => {
      toast((err && err.detail) || t('No se pudo completar la acción'), 'err');
    });
  }

  /* Clic en un amigo: abre el DM si ya existe; si no, lo crea. */
  function openFriend(u: any) {
    const cs = store.chats || [];
    for (let i = 0; i < cs.length; i++) {
      const c = cs[i];
      if (c.type === 'dm' && c.title && c.title.id === u.id) {
        backToChats();
        return;
      }
    }
    run(() => createDm(u.username));
    backToChats();
  }

  /* El tap del botón de acción también sube a la fila (en NS los
     eventos burbujean), así que se marca para que la fila no abra el
     perfil. El flag se limpia solo en el siguiente turno: si el tap no
     llegara a la fila, tampoco queda colgado. */
  let skipRowTap = false;

  function actOnSearch(u: any) {
    skipRowTap = true;
    setTimeout(() => { skipRowTap = false; }, 0);
    if (isFriend(u)) {
      openFriend(u);
      return;
    }
    if (sentTo(u)) return;
    run(() => sendFriendRequest(u.username), t('Solicitud enviada'));
  }

  function openResult(u: any) {
    if (skipRowTap) return;
    goProfile(u.id);
  }

  /* Grupo nuevo: se eligen los miembros en otra pantalla. */
  function goNewGroup() {
    goView('newgroup');
  }

  function cancelReq(r: any) { run(() => cancelFriendRequest(r.id)); }
  function rejectReq(r: any) { run(() => rejectFriendRequest(r.id)); }

  /* Aceptar crea el DM y abre la conversación (lo hace el núcleo). */
  function acceptReq(r: any) {
    run(() => acceptFriendRequest(r.id));
    backToChats();
  }

  onMounted(async () => {
    await loadPeople();
  });
</script>
