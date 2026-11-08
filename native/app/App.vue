<template>
  <Frame>
    <LoginView v-if="route === 'login'" />
    <RegisterView v-else-if="route === 'register'" />
    <VerifyView v-else-if="route === 'verify'" />
    <ShellView v-else />
  </Frame>
</template>

<script setup lang="ts">
  import { computed, onMounted } from 'nativescript-vue';
  import { store } from './core/store.js';
  import { bootNative } from './fox';
  import LoginView from './views/LoginView.vue';
  import RegisterView from './views/RegisterView.vue';
  import VerifyView from './views/VerifyView.vue';
  import ShellView from './views/ShellView.vue';

  /* La ruta vive en el store compartido: el núcleo decide, la vista
     nativa obedece. */
  const route = computed(() => store.route || 'login');

  onMounted(() => {
    bootNative();
  });
</script>
