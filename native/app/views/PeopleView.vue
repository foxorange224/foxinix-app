<template>
  <Page>
    <ActionBar title="Personas">
      <ActionItem text="Chats" @tap="backToChats" ios.position="left" />
      <ActionItem text="Grupo" @tap="goNewGroup" ios.position="right" />
    </ActionBar>

    <GridLayout rows="auto,auto,*">
      <!-- pestañas -->
      <StackLayout row="0" class="fox-tabs" orientation="horizontal">
        <Button
          class="fox-tab"
          :class="{ on: tab === 'active' }"
          text="Activos"
          @tap="tab = 'active'"
        />
        <Button
          class="fox-tab"
          :class="{ on: tab === 'req' }"
          :text="nReq ? 'Solicitudes (' + nReq + ')' : 'Solicitudes'"
          @tap="tab = 'req'"
        />
      </StackLayout>

      <!-- búsqueda -->
      <TextField
        row="1"
        class="fox-search"
        :text="q"
        :hint="tab === 'active' ? 'Buscar personas por usuario' : 'Buscar solicitudes'"
        autocorrect="false"
        autocapitalizationType="none"
        @textChange="onQuery"
      />

      <ScrollView row="2">
        <StackLayout>
          <!-- ===== pestaña Activos ===== -->
          <StackLayout v-if="tab === 'active'">
            <!-- resultados de búsqueda -->
            <StackLayout v-if="q.trim().length >= 2">
              <GridLayout
                v-for="u in results"
                :key="'r' + u.id"
                class="fox-row"
                columns="auto,*,auto"
                rows="auto,auto"
              >
                <GridLayout row="0" col="0" rowspan="2" class="fox-av">
                  <Image
                    v-if="avatarOf(u)"
                    class="fox-av-img"
                    :src="avatarOf(u)"
                    stretch="aspectFill"
                  />
                  <Label
                    v-else
                    class="fox-avatar"
                    :text="initial(u)"
                    :backgroundColor="u.online ? '#1f4d33' : '#16232c'"
                  />
                </GridLayout>
                <Label class="fox-row-title" row="0" col="1" :text="nameOf(u)" textWrap="true" />
                <Label class="fox-row-sub" row="1" col="1" colSpan="2" :text="'@' + u.username" />
                <Button
                  row="0"
                  col="2"
                  rowspan="2"
                  class="fox-act"
                  :text="actionFor(u)"
                  :enabled="actionFor(u) !== 'Solicitud enviada'"
                  @tap="actOnSearch(u)"
                />
              </GridLayout>
              <Label v-if="!results.length && !searching" class="fox-empty" text="Sin resultados" />
              <Label v-if="searching" class="fox-empty" text="Buscando…" />
            </StackLayout>

            <!-- amigos -->
            <StackLayout v-else>
              <GridLayout
                v-for="u in friends"
                :key="'f' + u.id"
                class="fox-row"
                columns="auto,*,auto"
                rows="auto,auto"
                @tap="openFriend(u)"
              >
                <GridLayout row="0" col="0" rowspan="2" class="fox-av">
                  <Image
                    v-if="avatarOf(u)"
                    class="fox-av-img"
                    :src="avatarOf(u)"
                    stretch="aspectFill"
                  />
                  <Label
                    v-else
                    class="fox-avatar"
                    :text="initial(u)"
                    :backgroundColor="friendOn(u) ? '#1f4d33' : '#16232c'"
                  />
                </GridLayout>
                <Label class="fox-row-title" row="0" col="1" :text="nameOf(u)" textWrap="true" />
                <Label class="fox-row-sub" row="1" col="1" colSpan="2" :text="lineOf(u)" />
                <Label
                  row="0"
                  col="2"
                  rowspan="2"
                  class="fox-go"
                  text="›"
                />
              </GridLayout>
              <Label v-if="loaded && !friends.length" class="fox-empty" text="Todavía no tenés amigos. Buscá personas arriba para empezar." />
              <Label v-else-if="loaded && !friends.length" class="fox-empty" text="Cargando…" />
            </StackLayout>
          </StackLayout>

          <!-- ===== pestaña Solicitudes ===== -->
          <StackLayout v-else>
            <Label v-if="sent.length" class="fox-sec" text="Enviadas" />
            <GridLayout
              v-for="r in sent"
              :key="'s' + r.id"
              class="fox-row"
              columns="auto,*,auto"
              rows="auto,auto"
            >
              <GridLayout row="0" col="0" rowspan="2" class="fox-av">
                <Image
                  v-if="avatarOf(r.user)"
                  class="fox-av-img"
                  :src="avatarOf(r.user)"
                  stretch="aspectFill"
                />
                <Label v-else class="fox-avatar" :text="initial(r.user)" backgroundColor="#16232c" />
              </GridLayout>
              <Label class="fox-row-title" row="0" col="1" :text="nameOf(r.user)" textWrap="true" />
              <Label class="fox-row-sub" row="1" col="1" colSpan="2" :text="'@' + (r.user && r.user.username || '')" />
              <Button row="0" col="2" rowspan="2" class="fox-act ghost" text="Cancelar" @tap="cancelReq(r)" />
            </GridLayout>

            <Label v-if="recv.length" class="fox-sec" text="Recibidas" />
            <GridLayout
              v-for="r in recv"
              :key="'v' + r.id"
              class="fox-row"
              columns="auto,*,auto,auto"
              rows="auto,auto"
            >
              <GridLayout row="0" col="0" rowspan="2" class="fox-av">
                <Image
                  v-if="avatarOf(r.user)"
                  class="fox-av-img"
                  :src="avatarOf(r.user)"
                  stretch="aspectFill"
                />
                <Label v-else class="fox-avatar" :text="initial(r.user)" backgroundColor="#16232c" />
              </GridLayout>
              <Label class="fox-row-title" row="0" col="1" :text="nameOf(r.user)" textWrap="true" />
              <Label class="fox-row-sub" row="1" col="1" colSpan="3" :text="'@' + (r.user && r.user.username || '')" />
              <Button row="0" col="2" rowspan="2" class="fox-act" text="Aceptar" @tap="acceptReq(r)" />
              <Button row="0" col="3" rowspan="2" class="fox-act ghost" text="Rechazar" @tap="rejectReq(r)" />
            </GridLayout>

            <Label
              v-if="!sent.length && !recv.length"
              class="fox-empty"
              text="No hay solicitudes por ahora."
            />
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
  import { backToChats, goView } from '../nav';

  const tab = ref<'active' | 'req'>('active');
  const q = ref('');
  const results = ref<any[]>([]);
  const searching = ref(false);

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

  function lineOf(u: any): string {
    if (!friendOn(u)) return 'Desconectado';
    if (u.status_text) return u.status_text;
    if (u.status_preset === 'busy') return 'Ausente';
    if (u.status_preset === 'dnd') return 'No molestar';
    return 'En línea';
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
    if (isFriend(u)) return 'Mensaje';
    if (sentTo(u)) return 'Solicitud enviada';
    return 'Enviar solicitud';
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
      toast((err && err.detail) || 'No se pudo completar la acción', 'err');
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

  function actOnSearch(u: any) {
    if (isFriend(u)) {
      openFriend(u);
      return;
    }
    if (sentTo(u)) return;
    run(() => sendFriendRequest(u.username), 'Solicitud enviada');
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

<style>
.fox-tabs {
  padding: 8 12 0 12;
}

.fox-tab {
  background-color: transparent;
  color: #8aa0ad;
  font-size: 14;
  font-weight: 600;
  padding: 10 14;
  margin-right: 6;
  border-radius: 8;
  border-width: 0;
  android-textAllCaps: false;
}

.fox-tab.on {
  background-color: #16232c;
  color: #ff751f;
}

.fox-search {
  background-color: #16232c;
  color: #e8edf2;
  border-radius: 10;
  border-width: 1;
  border-color: #24333d;
  padding: 10;
  margin: 12;
  font-size: 15;
}

.fox-row {
  padding: 10 14;
  border-bottom-width: 1;
  border-bottom-color: #1d2b34;
}

.fox-av {
  width: 44;
  height: 44;
  margin-right: 12;
}

.fox-av-img {
  width: 44;
  height: 44;
  border-radius: 22;
  background-color: #16232c;
}

.fox-avatar {
  width: 44;
  height: 44;
  border-radius: 22;
  color: #e8edf2;
  font-size: 17;
  font-weight: 600;
  text-align: center;
  vertical-align: center;
}

.fox-row-title {
  color: #e8edf2;
  font-size: 15;
  font-weight: 600;
  vertical-align: center;
}

.fox-row-sub {
  color: #8aa0ad;
  font-size: 12;
  vertical-align: center;
}

.fox-go {
  color: #7d909c;
  font-size: 22;
  vertical-align: center;
  padding-left: 10;
}

.fox-act {
  background-color: #ff751f;
  color: #12181c;
  border-radius: 8;
  padding: 8 12;
  font-size: 12;
  font-weight: 600;
  margin-left: 8;
  android-textAllCaps: false;
}

.fox-act.ghost {
  background-color: transparent;
  color: #8aa0ad;
  border-width: 1;
  border-color: #2b3d49;
}

.fox-act:disabled {
  background-color: transparent;
  color: #56666f;
  border-width: 1;
  border-color: #24333d;
}

.fox-sec {
  color: #7d909c;
  font-size: 12;
  font-weight: 700;
  padding: 14 16 6 16;
  text-transform: uppercase;
}

.fox-empty {
  color: #8aa0ad;
  text-align: center;
  margin-top: 28;
  font-size: 14;
  padding: 0 24;
}
</style>
