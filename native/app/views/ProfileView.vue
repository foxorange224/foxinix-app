<template>
  <Page>
    <ActionBar :title="title">
      <ActionItem text="Volver" @tap="close" ios.position="left" />
    </ActionBar>

    <ScrollView>
      <StackLayout>
        <!-- portada -->
        <GridLayout class="fox-banner" rows="auto">
          <Image
            v-if="banner"
            class="fox-banner-img"
            :src="banner"
            stretch="aspectFill"
          />
        </GridLayout>

        <!-- avatar + datos -->
        <GridLayout class="fox-pf-head" columns="auto,*" rows="auto,auto,auto">
          <GridLayout row="0" col="0" rowspan="3" class="fox-av fox-av-big">
            <Image
              v-if="avatar"
              class="fox-av-img fox-av-img-big"
              :src="avatar"
              stretch="aspectFill"
            />
            <Label v-else class="fox-avatar fox-avatar-big" :text="initial" backgroundColor="#16232c" />
          </GridLayout>
          <Label row="0" col="1" class="fox-pf-name" :text="name" textWrap="true" />
          <Label row="1" col="1" class="fox-pf-user" :text="'@' + username" />
          <Label row="2" col="1" class="fox-pf-status" :text="statusLine" textWrap="true" />
        </GridLayout>

        <!-- bio -->
        <Label
          v-if="bio"
          class="fox-pf-bio"
          :text="bio"
          textWrap="true"
        />

        <!-- acción principal según la relación -->
        <Button
          class="fox-btn"
          :class="{ ghost: relation === 'sent' || relation === 'blocked' }"
          :text="mainAction"
          :enabled="mainEnabled && !busy"
          @tap="doMain"
        />

        <!-- bloquear / desbloquear -->
        <Button
          v-if="relation !== 'me'"
          class="fox-btn ghost"
          :text="relation === 'blocked' ? 'Desbloquear' : 'Bloquear'"
          :enabled="!busy"
          @tap="toggleBlock"
        />

        <Label v-if="err" class="fox-err" :text="err" textWrap="true" />
      </StackLayout>
    </ScrollView>
  </Page>
</template>

<script setup lang="ts">
  import { ref, computed, onMounted } from 'nativescript-vue';
  import { store, toast } from '../core/store.js';
  import {
    blockUser, createDm, loadProfile, mediaUrl, sendFriendRequest, unblockUser,
  } from '../core/actions.js';
  import { back, backToChats } from '../nav';

  /* El id del usuario viene de la navegación nativa. */
  const props = defineProps<{ userId: number }>();

  const user = ref<any>(null);
  const relation = ref('none');
  const err = ref('');
  const busy = ref(false);

  const title = computed(() => (user.value ? name.value : 'Perfil'));

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

  const statusLine = computed(() => {
    const u = user.value;
    if (!u) return '';
    if (u.status_text) return u.status_text;
    if (u.status_preset === 'busy') return 'Ausente';
    if (u.status_preset === 'dnd') return 'No molestar';
    if (u.status_preset === 'invisible') return 'Invisible';
    return u.online ? 'En línea' : 'Desconectado';
  });

  const mainAction = computed(() => {
    if (relation.value === 'friend') return 'Mensaje';
    if (relation.value === 'sent') return 'Solicitud pendiente';
    if (relation.value === 'received') return 'Solicitud recibida';
    if (relation.value === 'blocked') return 'Bloqueado';
    if (relation.value === 'me') return 'Es tu cuenta';
    return 'Enviar solicitud';
  });

  const mainEnabled = computed(() => {
    return relation.value === 'friend' || relation.value === 'none';
  });

  function run(fn: () => any, okMsg?: string) {
    busy.value = true;
    Promise.resolve(fn()).then(() => {
      if (okMsg) toast(okMsg, 'ok');
    }).catch((e: any) => {
      toast((e && e.detail) || 'No se pudo completar la acción', 'err');
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
      }, 'Solicitud enviada');
    }
  }

  function toggleBlock() {
    if (!user.value) return;
    if (relation.value === 'blocked') {
      run(async () => {
        await unblockUser(user.value.username);
        relation.value = 'none';
      }, 'Usuario desbloqueado');
    } else {
      run(async () => {
        await blockUser(user.value.username);
        relation.value = 'blocked';
      }, 'Usuario bloqueado');
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
      err.value = (e && e.detail) || 'No se pudo cargar el perfil';
    }
  });
</script>

<style>
.fox-banner {
  height: 120;
  background-color: #16232c;
}

.fox-banner-img {
  width: 100%;
  height: 120;
}

.fox-pf-head {
  padding: 0 16;
  margin-top: -26;
}

.fox-av-big {
  width: 74;
  height: 74;
}

.fox-av-img-big {
  width: 74;
  height: 74;
  border-radius: 37;
  border-width: 3;
  border-color: #0b141a;
}

.fox-avatar-big {
  width: 74;
  height: 74;
  border-radius: 37;
  font-size: 28;
  border-width: 3;
  border-color: #0b141a;
}

.fox-pf-name {
  color: #e8edf2;
  font-size: 20;
  font-weight: 700;
  margin-left: 12;
  margin-top: 32;
}

.fox-pf-user {
  color: #8aa0ad;
  font-size: 14;
  margin-left: 12;
}

.fox-pf-status {
  color: #7d909c;
  font-size: 13;
  margin-left: 12;
}

.fox-pf-bio {
  color: #c7d3da;
  font-size: 15;
  padding: 14 16;
}

.fox-btn.ghost {
  background-color: transparent;
  color: #8aa0ad;
  border-width: 1;
  border-color: #2b3d49;
}
</style>
