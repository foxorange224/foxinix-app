<template>
  <!-- W103: grupo nuevo con el estilo de la web: nombre arriba, los
       miembros elegidos en pastilles (.g-chip) y la lista de amigos con
       el tilde de elegido (.ri-check). -->
  <Page :class="'fox-' + theme" actionBarHidden="true">
    <GridLayout rows="auto,auto,auto,*,auto" class="ng-page">
      <!-- ---------- cabecera ---------- -->
      <GridLayout row="0" class="side-head" columns="auto,*">
        <FoxIconBtn col="0" icon="back" bare :tint="accent" @tap="cancel" />
        <Label col="1" class="sh-title" :text="t('Grupo nuevo')" textWrap="false" />
      </GridLayout>

      <!-- ---------- nombre del grupo ---------- -->
      <TextField row="1" class="input ng-name" :text="title"
                 :hint="t('Nombre del grupo')" autocorrect="true"
                 @textChange="title = $event.value" />

      <!-- ---------- miembros elegidos ---------- -->
      <WrapLayout v-if="picked.length" row="2" class="g-chips">
        <GridLayout v-for="u in picked" :key="u.id" class="g-chip">
          <Label class="g-chip-name" :text="nameOf(u)" textWrap="false" />
          <FoxIconBtn icon="x" bare :size="20" :ic="12" :tint="muted"
                      @tap="toggle(u)" />
        </GridLayout>
      </WrapLayout>

      <!-- ---------- lista de amigos ---------- -->
      <ScrollView row="3">
        <StackLayout class="ng-list">
          <GridLayout v-for="u in friends" :key="u.id" class="res-item"
                      columns="auto,*,auto" @tap="toggle(u)">
            <FoxAvatar col="0" :src="avatarOf(u)" :initial="initial(u)"
                       :size="36" :ring="panelRing" />
            <StackLayout col="1" class="ri-col">
              <Label class="ri-name" :text="nameOf(u)" textWrap="false" />
              <Label class="ri-user" :text="'@' + u.username" textWrap="false" />
            </StackLayout>
            <Image v-if="isPicked(u)" col="2" src="res://ic_fox_check" width="18"
                   height="18" :tintColor="accent" />
          </GridLayout>

          <Label v-if="!friends.length" class="res-empty"
                 :text="t('Todavía no tenés amigos. Buscá personas en el panel de Personas.')"
                 textWrap="true" />
        </StackLayout>
      </ScrollView>

      <!-- ---------- crear ---------- -->
      <GridLayout row="4" class="m-foot" columns="*">
        <Button col="0" class="btn" :text="busy ? t('Creando…') : t('Crear grupo')"
                :enabled="canCreate && !busy" @tap="create" />
      </GridLayout>
    </GridLayout>
  </Page>
</template>

<script setup lang="ts">
  import { ref, computed, onMounted } from 'nativescript-vue';
  import { store, toast } from '../core/store.js';
  import { createGroup, loadPeople, mediaUrl } from '../core/actions.js';
  import { t } from '../core/i18n.js';
  import { backToChats } from '../nav';
  import { tok } from '../fmt';
  import FoxAvatar from '../components/FoxAvatar.vue';
  import FoxIconBtn from '../components/FoxIconBtn.vue';

  const title = ref('');
  const picked = ref<any[]>([]);
  const busy = ref(false);

  const theme = computed(() => store.theme);
  const accent = computed(() => tok(store.theme, 'accent'));
  const muted = computed(() => tok(store.theme, 't2'));
  const panelRing = computed(() => tok(store.theme, 'panel'));

  const friends = computed(() => {
    const p = store.people || { friends: [] };
    return p.friends || [];
  });

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
      toast((e && e.detail) || t('No se pudo crear el grupo'), 'err');
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
