<template>
  <Page>
    <ActionBar title="Grupo nuevo">
      <ActionItem text="Cancelar" @tap="cancel" ios.position="left" />
    </ActionBar>

    <GridLayout rows="auto,auto,*,auto">
      <!-- nombre del grupo -->
      <TextField
        row="0"
        class="fox-search"
        :text="title"
        hint="Nombre del grupo"
        autocorrect="true"
        @textChange="title = $event.value"
      />

      <!-- miembros elegidos -->
      <Label
        row="1"
        class="fox-picked"
        :text="picked.length ? 'Miembros (' + picked.length + '): ' + pickedNames : 'Elegí a los miembros del grupo'"
        textWrap="true"
      />

      <ScrollView row="2">
        <StackLayout>
          <GridLayout
            v-for="u in friends"
            :key="u.id"
            class="fox-row"
            columns="auto,auto,*"
            rows="auto,auto"
            @tap="toggle(u)"
          >
            <GridLayout row="0" col="0" rowspan="2" class="fox-av">
              <Image
                v-if="avatarOf(u)"
                class="fox-av-img"
                :src="avatarOf(u)"
                stretch="aspectFill"
              />
              <Label v-else class="fox-avatar" :text="initial(u)" backgroundColor="#16232c" />
            </GridLayout>
            <Label
              row="0"
              col="1"
              rowspan="2"
              class="fox-check"
              :class="{ on: isPicked(u) }"
              :text="isPicked(u) ? '✓' : ''"
            />
            <Label class="fox-row-title" row="0" col="2" :text="nameOf(u)" textWrap="true" />
            <Label class="fox-row-sub" row="1" col="2" :text="'@' + u.username" />
          </GridLayout>

          <Label v-if="!friends.length" class="fox-empty" text="Todavía no tenés amigos. Buscá personas en el panel de Personas." />
        </StackLayout>
      </ScrollView>

      <!-- crear -->
      <Button
        row="3"
        class="fox-create"
        text="Crear grupo"
        :enabled="canCreate && !busy"
        @tap="create"
      />
    </GridLayout>
  </Page>
</template>

<script setup lang="ts">
  import { ref, computed, onMounted } from 'nativescript-vue';
  import { store, toast } from '../core/store.js';
  import { createGroup, loadPeople, mediaUrl } from '../core/actions.js';
  import { backToChats } from '../nav';

  const title = ref('');
  const picked = ref<any[]>([]);
  const busy = ref(false);

  const friends = computed(() => {
    const p = store.people || { friends: [] };
    return p.friends || [];
  });

  const pickedNames = computed(() => picked.value.map((u) => u.display_name || u.username).join(', '));

  /* Con el creador siempre son 2: el grupo puede tener un solo miembro
     (el que lo crea). */
  const canCreate = computed(() => title.value.trim().length > 0 && !busy.value);

  function nameOf(u: any): string {
    if (!u) return '';
    return u.display_name || u.username || '';
  }

  function initial(u: any): string {
    const n = nameOf(u).trim();
    return n ? n.charAt(0).toUpperCase() : '?';
  }

  function avatarOf(u: any): string {
    if (!u || !u.avatar_url) return '';
    try { return mediaUrl(u.avatar_url); } catch (e) { return ''; }
  }

  function isPicked(u: any): boolean {
    return picked.value.some((x) => x.id === u.id);
  }

  function toggle(u: any) {
    if (isPicked(u)) {
      picked.value = picked.value.filter((x) => x.id !== u.id);
    } else {
      picked.value = picked.value.concat([u]);
    }
  }

  async function create() {
    if (!canCreate.value) return;
    busy.value = true;
    try {
      const members = picked.value.map((u) => u.username);
      /* createGroup abre el chat (lo hace el núcleo) y lo deja como
         activo: la app vuelve a la lista y el chat queda listo. */
      await createGroup(title.value.trim(), members);
      title.value = '';
      picked.value = [];
      backToChats();
    } catch (e: any) {
      toast((e && e.detail) || 'No se pudo crear el grupo', 'err');
    } finally {
      busy.value = false;
    }
  }

  function cancel() {
    backToChats();
  }

  onMounted(async () => {
    if (!store.people) await loadPeople();
  });
</script>

<style>
.fox-picked {
  color: #8aa0ad;
  font-size: 12;
  padding: 0 16 10 16;
}

.fox-check {
  width: 26;
  height: 26;
  border-radius: 13;
  border-width: 2;
  border-color: #2b3d49;
  color: #12181c;
  background-color: transparent;
  text-align: center;
  vertical-align: center;
  font-size: 15;
  font-weight: 700;
  margin-right: 12;
}

.fox-check.on {
  background-color: #ff751f;
  border-color: #ff751f;
}

.fox-create {
  background-color: #ff751f;
  color: #12181c;
  border-radius: 10;
  padding: 13;
  font-size: 16;
  font-weight: 600;
  margin: 12;
  android-textAllCaps: false;
}

.fox-create:disabled {
  background-color: #7a4420;
  color: #b9c4cb;
}
</style>
