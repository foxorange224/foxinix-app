<template>
  <!-- W114: renombrar grupo (W57 de la web). Overlay centrado, montado
       globalmente en App.vue (row0 rowSpan2, antes de NativeToasts).
       Se abre desde el menú chat-more ⋮ (solo owner/admin del grupo). -->
  <GridLayout rows="*,auto,*" columns="*,auto,*" class="newchat">
    <StackLayout row="0" col="0" rowSpan="3" colSpan="3" class="modal-veil"
                 @tap="emit('close')" />

    <GridLayout row="1" col="1" class="modal confirm" :width="modalW"
                rows="auto,auto,auto">
      <Label row="0" class="rename-head" :text="t('Renombrar grupo')"
             textWrap="false" />
      <StackLayout row="1" class="cf-body">
        <Label class="cf-text" :text="t('El nuevo nombre lo verán todos los miembros.')"
               textWrap="true" />
        <GridLayout class="field group-rename-field" rows="auto,auto">
          <Label row="0" class="field-label" :text="t('Nombre del grupo')"
                 textWrap="false" />
          <TextField row="1" ref="inputEl" class="group-rename-input"
                     v-model="title" :maxLength="60"
                     :placeholder="t('Nombre del grupo (máx. 60)')"
                     :placeholderColor="muted" autocorrect="false"
                     autocapitalizationType="none"
                     @submit="save" />
        </GridLayout>
        <GridLayout v-if="err" class="form-err st-err" columns="auto,*"
                    role="alert">
          <Image col="0" src="res://ic_fox_alert" width="14" height="14"
                 :tintColor="errColor" stretch="aspectFit"
                 verticalAlignment="center" />
          <Label col="1" class="st-err-t" :text="err" textWrap="true" />
        </GridLayout>
      </StackLayout>
      <GridLayout row="2" class="m-foot st-btns" columns="*,*">
        <Button col="0" class="btn btn-ghost" :text="t('Cancelar')"
                :disabled="busy" @tap="emit('close')" />
        <Button col="1" class="btn" :text="busy ? t('Guardando…') : t('Guardar')"
                :disabled="busy || !title.trim()" @tap="save" />
      </GridLayout>
    </GridLayout>
  </GridLayout>
</template>

<script setup lang="ts">
  /* W114: renombrar un grupo (solo owner/admin, el server revalida).
     Port del RenameGroupModal.js de la web (mismo orden de teclas t(),
     mismo flujo: PATCH /chats/:id {title}, loadChats, toast ok/err). */
  import { ref, computed, onMounted, nextTick } from 'nativescript-vue';
  import { Screen } from '@nativescript/core';
  import { store, toast } from '../core/store.js';
  import { api, loadChats } from '../core/actions.js';
  import { t } from '../core/i18n.js';
  import { tok } from '../fmt';

  const emit = defineEmits<{ close: [] }>();

  const title = ref(store.renameGroupTitle || '');
  const busy = ref(false);
  const err = ref('');
  const inputEl = ref<any>(null);

  const theme = computed(() => store.theme);
  const muted = computed(() => tok(store.theme, 't2'));
  const errColor = computed(() => tok(store.theme, 'err'));

  const modalW = computed(() => {
    try { return Math.min(400, Math.round(Screen.mainScreen.widthDIPs - 32)); }
    catch { return 300; }
  });

  onMounted(() => {
    nextTick(() => {
      const el: any = inputEl.value;
      const nv = el ? (el.nativeView || el) : null;
      if (nv && typeof nv.focus === 'function') nv.focus();
    });
  });

  const save = async () => {
    const id = store.renameGroupId;
    const name = title.value.trim();
    if (!id || !name) { err.value = t('Escribe un nombre para el grupo'); return; }
    busy.value = true; err.value = '';
    try {
      await api('PATCH', '/chats/' + id, { title: name });
      store.renameGroupId = 0;
      store.renameGroupTitle = '';
      toast(t('Nombre del grupo actualizado'), 'ok');
      await loadChats();
    } catch (e: any) {
      err.value = (e && e.detail && t(e.detail)) || t('No se pudo cambiar el nombre');
    } finally { busy.value = false; }
  };
</script>
