<template>
  <!-- W103: ajustes con el estilo de la web: cabecera con volver,
       secciones en mayúsculas (.st-h) y filas con título + explicación
       (.st-row / .st-col) separadas por líneas. -->
  <Page :class="'fox-' + theme" actionBarHidden="true">

    <GridLayout rows="auto,*" class="st-page">
      <!-- ---------- cabecera ---------- -->
      <GridLayout row="0" class="side-head" columns="auto,*">
        <FoxIconBtn col="0" icon="back" bare :tint="accent" @tap="close" />
        <Label col="1" class="sh-title" :text="t('Ajustes')" textWrap="false" />
      </GridLayout>

      <!-- ---------- cuerpo ---------- -->
      <ScrollView row="1">
        <StackLayout>
          <!-- ===== Chat ===== -->
          <Label class="st-h" :text="t('Chat')" />

          <GridLayout class="st-row" columns="*,auto">
            <StackLayout col="0" class="st-col">
              <Label class="st-t" :text="t('Sonido al recibir')" textWrap="true" />
            </StackLayout>
            <Switch col="1" :checked="prefs.sound"
                    @change="setBool('sound', $event.value)" />
          </GridLayout>

          <GridLayout class="st-row" columns="*,auto">
            <StackLayout col="0" class="st-col">
              <Label class="st-t" :text="t('Avisar cuando escribo')" textWrap="true" />
              <Label class="st-s" :text="t('Tus contactos ven “escribiendo…”')"
                     textWrap="true" />
            </StackLayout>
            <Switch col="1" :checked="prefs.typing"
                    @change="setBool('typing', $event.value)" />
          </GridLayout>

          <GridLayout class="st-row" columns="*,auto">
            <StackLayout col="0" class="st-col">
              <Label class="st-t" :text="t('Recibos de lectura')" textWrap="true" />
              <Label class="st-s" :text="t('Mostrar ✓✓ y avisar cuando lees')"
                     textWrap="true" />
            </StackLayout>
            <Switch col="1" :checked="prefs.receipts"
                    @change="setBool('receipts', $event.value)" />
          </GridLayout>

          <GridLayout class="st-row" columns="*,auto">
            <StackLayout col="0" class="st-col">
              <Label class="st-t" :text="t('Formato de hora')" textWrap="true" />
              <Label class="st-s" :text="t('En vez de 20:30, mostrar 8:30 pm')"
                     textWrap="true" />
            </StackLayout>
            <Switch col="1" :checked="prefs.h12"
                    @change="setBool('h12', $event.value)" />
          </GridLayout>

          <!-- ===== Apariencia ===== -->
          <Label class="st-h" :text="t('Apariencia')" />

          <Label class="st-t st-lbl" :text="t('Estilo de emojis')" textWrap="true" />
          <GridLayout class="st-pills" columns="*,*,*">
            <Button v-for="(o, i) in emoOptions" :key="o.id" :col="i"
                    class="ap-opt" :class="{ on: prefs.emo === o.id }"
                    :text="o.label" @tap="setEmo(o.id)" />
          </GridLayout>

          <Label class="st-t st-lbl" :text="t('Tamaño de letra')" textWrap="true" />
          <GridLayout class="st-pills" columns="*,*,*">
            <Button v-for="(o, i) in fontOptions" :key="o.id" :col="i"
                    class="ap-opt" :class="{ on: font === o.id }"
                    :text="o.label" @tap="setFontSize(o.id)" />
          </GridLayout>

          <GridLayout class="st-row" columns="*,auto">
            <StackLayout col="0" class="st-col">
              <Label class="st-t" :text="t('Sin animaciones')" textWrap="true" />
            </StackLayout>
            <Switch col="1" :checked="prefs.noAnim"
                    @change="setBool('noAnim', $event.value)" />
          </GridLayout>

          <GridLayout class="st-row" columns="*,auto">
            <StackLayout col="0" class="st-col">
              <Label class="st-t" :text="t('Reducir estímulos')" textWrap="true" />
            </StackLayout>
            <Switch col="1" :checked="prefs.reduceStimuli"
                    @change="setBool('reduceStimuli', $event.value)" />
          </GridLayout>

          <GridLayout class="st-row" columns="*,auto">
            <StackLayout col="0" class="st-col">
              <Label class="st-t" :text="t('Cola de notas de voz')" textWrap="true" />
            </StackLayout>
            <Switch col="1" :checked="prefs.voiceQueue"
                    @change="setBool('voiceQueue', $event.value)" />
          </GridLayout>

          <!-- ===== Avisos ===== -->
          <Label class="st-h" :text="t('Avisos')" />

          <GridLayout class="st-row" columns="*,auto">
            <StackLayout col="0" class="st-col">
              <Label class="st-t" :text="t('Notificaciones')" textWrap="true" />
              <Label class="st-s" :text="notifState" textWrap="true" />
            </StackLayout>
            <Button v-if="notifState !== t('Concedido')" col="1" class="st-mini"
                    :text="notifState === t('Bloqueado')
                      ? t('Ajustes del sistema')
                      : t('Activar')"
                    @tap="askNotif" />
          </GridLayout>

          <!-- ===== Cuenta ===== -->
          <Label class="st-h" :text="t('Cuenta')" />

          <GridLayout class="st-row" columns="*,auto">
            <StackLayout col="0" class="st-col">
              <Label class="st-t" :text="'@' + username" textWrap="true" />
              <Label class="st-s" :text="displayName" textWrap="true" />
            </StackLayout>
            <Label col="1" class="st-s" :text="verified ? t('verificada') : t('sin verificar')"
                   textWrap="true" />
          </GridLayout>

          <!-- ===== Sesión ===== -->
          <Label class="st-h" :text="t('Sesión')" />

          <Button class="btn btn-ghost btn-full st-out" :text="t('Cerrar sesión')"
                  @tap="doLogout" />

          <Label v-if="err" class="form-err st-err" :text="err" textWrap="true" />
        </StackLayout>
      </ScrollView>
    </GridLayout>
  </Page>
</template>

<script setup lang="ts">
  import { ref, computed, onMounted } from 'nativescript-vue';
  import { store, setFont, setPref, setPrefStr } from '../core/store.js';
  import { session } from '../core/api.js';
  import { t } from '../core/i18n.js';
  import { nativeLogout } from '../fox';
  import { back } from '../nav';
  import { tok } from '../fmt';
  import FoxIconBtn from '../components/FoxIconBtn.vue';
  import {
    askNotificationPermission,
    notificationState,
    openNotificationSettings,
  } from '../notifier';

  const err = ref('');

  const theme = computed(() => store.theme);
  const accent = computed(() => tok(store.theme, 'accent'));

  /* W100: estado del permiso de avisos (el sistema lo concede en
     Android 13+; en Ajustes se puede volver a pedir o abrir los ajustes
     del sistema si está bloqueado). */
  const notifState = ref(t('Pendiente'));

  function notifLabel(p: string): string {
    if (p === 'granted') return t('Concedido');
    if (p === 'denied') return t('Bloqueado');
    if (p === 'prompt') return t('Pendiente');
    return t('No disponible');
  }

  onMounted(async () => {
    notifState.value = notifLabel(await notificationState());
  });

  async function askNotif() {
    if (notifState.value === t('Bloqueado')) {
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
    { id: 'system', label: t('Sistema') },
    { id: 'noto', label: t('Noto') },
    { id: 'twemoji', label: t('Twemoji') },
  ];
  const fontOptions = [
    { id: 'small', label: t('Pequeño') },
    { id: 'normal', label: t('Normal') },
    { id: 'large', label: t('Grande') },
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
