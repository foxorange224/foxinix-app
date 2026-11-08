<template>
  <Page>
    <ActionBar title="Ajustes">
      <ActionItem text="Volver" @tap="close" ios.position="left" />
    </ActionBar>

    <ScrollView>
      <StackLayout>
        <!-- ===== Chat ===== -->
        <Label class="fox-sec" text="Chat" />
        <GridLayout class="fox-row" columns="*,auto" rows="auto">
          <Label class="fox-row-title" col="0" row="0" text="Sonido al recibir" />
          <Switch
            col="1"
            row="0"
            :checked="prefs.sound"
            @change="setBool('sound', $event.value)"
          />
        </GridLayout>
        <GridLayout class="fox-row" columns="*,auto" rows="auto">
          <Label class="fox-row-title" col="0" row="0" text="Indicador de escritura" />
          <Switch
            col="1"
            row="0"
            :checked="prefs.typing"
            @change="setBool('typing', $event.value)"
          />
        </GridLayout>
        <GridLayout class="fox-row" columns="*,auto" rows="auto">
          <Label class="fox-row-title" col="0" row="0" text="Recibos de lectura" />
          <Switch
            col="1"
            row="0"
            :checked="prefs.receipts"
            @change="setBool('receipts', $event.value)"
          />
        </GridLayout>
        <GridLayout class="fox-row" columns="*,auto" rows="auto">
          <Label class="fox-row-title" col="0" row="0" text="Hora de 12 horas" />
          <Switch
            col="1"
            row="0"
            :checked="prefs.h12"
            @change="setBool('h12', $event.value)"
          />
        </GridLayout>

        <!-- ===== Apariencia ===== -->
        <Label class="fox-sec" text="Apariencia" />

        <Label class="fox-row-title fox-lbl" text="Estilo de emojis" />
        <StackLayout class="fox-seg" orientation="horizontal">
          <Button
            v-for="o in emoOptions"
            :key="o.id"
            class="fox-seg-btn"
            :class="{ on: prefs.emo === o.id }"
            :text="o.label"
            @tap="setEmo(o.id)"
          />
        </StackLayout>

        <Label class="fox-row-title fox-lbl" text="Tamaño de letra" />
        <StackLayout class="fox-seg" orientation="horizontal">
          <Button
            v-for="o in fontOptions"
            :key="o.id"
            class="fox-seg-btn"
            :class="{ on: font === o.id }"
            :text="o.label"
            @tap="setFontSize(o.id)"
          />
        </StackLayout>

        <GridLayout class="fox-row" columns="*,auto" rows="auto">
          <Label class="fox-row-title" col="0" row="0" text="Sin animaciones" />
          <Switch
            col="1"
            row="0"
            :checked="prefs.noAnim"
            @change="setBool('noAnim', $event.value)"
          />
        </GridLayout>
        <GridLayout class="fox-row" columns="*,auto" rows="auto">
          <Label class="fox-row-title" col="0" row="0" text="Reducir estímulos" />
          <Switch
            col="1"
            row="0"
            :checked="prefs.reduceStimuli"
            @change="setBool('reduceStimuli', $event.value)"
          />
        </GridLayout>
        <GridLayout class="fox-row" columns="*,auto" rows="auto">
          <Label class="fox-row-title" col="0" row="0" text="Cola de notas de voz" />
          <Switch
            col="1"
            row="0"
            :checked="prefs.voiceQueue"
            @change="setBool('voiceQueue', $event.value)"
          />
        </GridLayout>

        <!-- ===== Avisos ===== -->
        <Label class="fox-sec" text="Avisos" />
        <GridLayout class="fox-row" columns="*,auto" rows="auto">
          <Label class="fox-row-title" col="0" row="0" text="Notificaciones" />
          <Label class="fox-row-sub" col="1" row="0" :text="notifState" />
        </GridLayout>
        <Button
          v-if="notifState !== 'Concedido'"
          class="fox-btn"
          :text="notifState === 'Bloqueado' ? 'Abrir ajustes del sistema' : 'Activar notificaciones'"
          @tap="askNotif"
        />

        <!-- ===== Cuenta ===== -->
        <Label class="fox-sec" text="Cuenta" />
        <GridLayout class="fox-row" columns="*,auto" rows="auto,auto">
          <Label class="fox-row-title" col="0" row="0" :text="'@' + username" />
          <Label class="fox-row-sub" col="0" row="1" :text="displayName" />
          <Label class="fox-row-sub" col="1" row="0" rowspan="2" :text="verified ? 'verificada' : 'sin verificar'" />
        </GridLayout>

        <Button class="fox-btn fox-out" text="Cerrar sesión" @tap="doLogout" />

        <Label v-if="err" class="fox-err" :text="err" textWrap="true" />
      </StackLayout>
    </ScrollView>
  </Page>
</template>

<script setup lang="ts">
  import { ref, computed, onMounted } from 'nativescript-vue';
  import { store, setFont, setPref, setPrefStr } from '../core/store.js';
  import { session } from '../core/api.js';
  import { nativeLogout } from '../fox';
  import { back } from '../nav';
  import {
    askNotificationPermission,
    notificationState,
    openNotificationSettings,
  } from '../notifier';

  const err = ref('');

  /* W100: estado del permiso de avisos (el sistema lo concede en
     Android 13+; en Ajustes se puede volver a pedir o abrir los ajustes
     del sistema si está bloqueado). */
  const notifState = ref('Pendiente');

  function notifLabel(p: string): string {
    if (p === 'granted') return 'Concedido';
    if (p === 'denied') return 'Bloqueado';
    if (p === 'prompt') return 'Pendiente';
    return 'No disponible';
  }

  onMounted(async () => {
    notifState.value = notifLabel(await notificationState());
  });

  async function askNotif() {
    if (notifState.value === 'Bloqueado') {
      /* Si el usuario lo bloqueó, el sistema no vuelve a mostrar el
         diálogo: hay que ir a los ajustes del sistema. */
      if (!openNotificationSettings()) {
        const r = await askNotificationPermission(true);
        notifState.value = notifLabel(r);
      }
      return;
    }
    const r = await askNotificationPermission(true);
    notifState.value = notifLabel(r);
  }

  /* Las preferencias viven en el store compartido: el núcleo las usa
     igual que en la web (sonido, recibos, estilo de emojis…). */
  const prefs = computed(() => store.prefs || {});
  const font = computed(() => store.font || 'normal');

  const user = computed(() => store.user || session.user || null);
  const username = computed(() => (user.value && user.value.username) || '');
  const displayName = computed(() => (user.value && user.value.display_name) || '');
  const verified = computed(() => !!(user.value && user.value.email_verified));

  const emoOptions = [
    { id: 'system', label: 'Sistema' },
    { id: 'noto', label: 'Noto' },
    { id: 'twemoji', label: 'Twemoji' },
  ];
  const fontOptions = [
    { id: 'small', label: 'Chica' },
    { id: 'normal', label: 'Normal' },
    { id: 'large', label: 'Grande' },
  ];

  function setBool(key: string, val: boolean) {
    setPref(key, !!val);
  }

  function setEmo(v: string) {
    setPrefStr('emo', v);
  }

  function setFontSize(v: string) {
    setFont(v);
  }

  function doLogout() {
    nativeLogout();
  }

  function close() {
    back();
  }
</script>

<style>
.fox-sec {
  color: #7d909c;
  font-size: 12;
  font-weight: 700;
  padding: 18 16 6 16;
  text-transform: uppercase;
}

.fox-lbl {
  padding: 10 16 4 16;
}

.fox-seg {
  padding: 0 12 8 12;
}

.fox-seg-btn {
  background-color: #16232c;
  color: #8aa0ad;
  border-radius: 8;
  border-width: 1;
  border-color: #24333d;
  padding: 8 14;
  font-size: 13;
  margin: 4;
  android-textAllCaps: false;
}

.fox-seg-btn.on {
  background-color: #ff751f;
  color: #12181c;
  border-color: #ff751f;
  font-weight: 600;
}

.fox-out {
  background-color: transparent;
  color: #ff8a5c;
  border-width: 1;
  border-color: #7a3b3b;
  margin: 18 16;
}
</style>
