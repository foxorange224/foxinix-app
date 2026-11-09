<template>
  <!-- W103: barra de pestañas de abajo, como la de la web en el móvil
       (.mobile-tabs): icono + rótulo, la activa en naranja con la
       rayita de arriba y el contador de solicitudes en "Personas". -->
  <GridLayout class="mt-bar" columns="*,*,*,*">
    <!-- Chats -->
    <GridLayout col="0" class="mt-btn" :class="{ on: tab === 'chats' }"
                rows="auto,auto,auto" @tap="goChats">
      <StackLayout row="0" class="mt-top" :class="{ on: tab === 'chats' }" />
      <Image row="1" class="mt-ic" src="res://ic_fox_chat" width="24" height="24"
             :tintColor="tab === 'chats' ? accent : muted" />
      <Label row="2" class="mt-label" :text="t('Chats')" />
    </GridLayout>

    <!-- Personas -->
    <GridLayout col="1" class="mt-btn" :class="{ on: tab === 'people' }"
                rows="auto,auto,auto" @tap="goPeople">
      <StackLayout row="0" class="mt-top" :class="{ on: tab === 'people' }" />
      <GridLayout row="1" class="mt-ic-wrap">
        <Image class="mt-ic" src="res://ic_fox_users" width="24" height="24"
               :tintColor="tab === 'people' ? accent : muted" />
        <Label v-if="nReq" class="mt-badge" :text="nReq > 9 ? '9+' : String(nReq)" />
      </GridLayout>
      <Label row="2" class="mt-label" :text="t('Personas')" />
    </GridLayout>

    <!-- Archivados -->
    <GridLayout col="2" class="mt-btn" :class="{ on: tab === 'archived' }"
                rows="auto,auto,auto" @tap="goArchived">
      <StackLayout row="0" class="mt-top" :class="{ on: tab === 'archived' }" />
      <Image row="1" class="mt-ic" src="res://ic_fox_archive" width="24" height="24"
             :tintColor="tab === 'archived' ? accent : muted" />
      <Label row="2" class="mt-label" :text="t('Archivados')" />
    </GridLayout>

    <!-- Ajustes -->
    <GridLayout col="3" class="mt-btn" :class="{ on: tab === 'settings' }"
                rows="auto,auto,auto" @tap="goSettings">
      <StackLayout row="0" class="mt-top" :class="{ on: tab === 'settings' }" />
      <Image row="1" class="mt-ic" src="res://ic_fox_gear" width="24" height="24"
             :tintColor="tab === 'settings' ? accent : muted" />
      <Label row="2" class="mt-label" :text="t('Ajustes')" />
    </GridLayout>
  </GridLayout>
</template>

<script setup lang="ts">
  import { computed } from 'nativescript-vue';
  import { store } from '../core/store.js';
  import { t } from '../core/i18n.js';
  import { tok } from '../fmt';

  defineProps<{
    /** Qué pestaña está activa: chats | people | archived | settings. */
    tab: string;
  }>();

  const emit = defineEmits<{ tab: [string] }>();

  const accent = computed(() => tok(store.theme, 'accent'));
  const muted = computed(() => tok(store.theme, 't2'));

  /* Contador de solicitudes pendientes (como el .mt-badge de la web). */
  const nReq = computed(() => {
    const p: any = store.people;
    if (!p || !p.received) return 0;
    return p.received.length;
  });

  function goChats() { emit('tab', 'chats'); }
  function goPeople() { emit('tab', 'people'); }
  function goArchived() { emit('tab', 'archived'); }
  function goSettings() { emit('tab', 'settings'); }
</script>
