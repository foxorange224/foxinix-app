/* voice.ts — notas de voz de la app NATIVA (W104).

   La web graba con MediaRecorder (navegador). Aquí no hay MediaRecorder:
   se usa el plugin @nativescript-community/audio, que por debajo usa
   android.media.MediaRecorder en Android y AVAudioRecorder en iOS.

   Lo que hace este módulo:
     - pide el permiso del micrófono (Android: RECORD_AUDIO; iOS:
       NSMicrophoneUsageDescription);
     - graba a un archivo de la carpeta temporal de la app;
     - da el nivel de volumen (0..100) para la onda EN VIVO;
     - reproduce una nota de voz desde el CDN (una a la vez, como la
       web con su cadena de reproductores).

   El archivo grabado se sube con sendMedia() del núcleo, que lo lee
   con FileAdapter (ruta -> bytes -> multipart). El server lo guarda
   como audio y lo sirve firmado desde el CDN. */

import { TNSPlayer, TNSRecorder } from '@nativescript-community/audio';
import { File, knownFolders } from '@nativescript/core/file-system';
import { isAndroid, isIOS } from '@nativescript/core';
import { check, isPermResultAuthorized, request } from '@nativescript-community/perms';

/* Tope de la grabación: 5 minutos (como en la web). */
export const MAX_REC_SECS = 300;

/* Lo que devuelve stopRecording(): el archivo ya grabado. */
export interface RecordedVoice {
  path: string;
  size: number;
  type: string;
  name: string;
}

/* ¿El dispositivo tiene micrófono? */
export function canRecord(): boolean {
  try {
    return TNSRecorder.CAN_RECORD();
  } catch (e) {
    return false;
  }
}

/* Pide el permiso del micrófono. true si queda concedido. */
export async function ensureMicPermission(): Promise<boolean> {
  try {
    const st = await check('microphone');
    if (isPermResultAuthorized(st)) return true;
    const st2 = await request('microphone');
    return isPermResultAuthorized(st2);
  } catch (e) {
    return false;
  }
}

let recorder: TNSRecorder | null = null;
let recPath = '';

/* Empieza a grabar. Devuelve la ruta del archivo.
   Lanza si no hay micrófono, si no hay permiso o si el sistema falla. */
export async function startRecording(): Promise<string> {
  if (!canRecord()) throw new Error('sin micrófono');
  if (!(await ensureMicPermission())) throw new Error('permiso');
  if (recorder) return recPath;

  const dir = knownFolders.temp();
  const name = 'nota-de-voz-' + Date.now() + '.m4a';
  const file = dir.getFile(name);
  recPath = file.path;

  const r = new TNSRecorder();
  const opts: any = {
    filename: recPath,
    metering: true,          // hace falta para getMeters()
    maxDuration: MAX_REC_SECS * 1000,
    channels: 1,
    sampleRate: 44100,
    bitRate: 96000,
  };
  if (isAndroid) {
    /* MPEG_4 + AAC: un .m4a que Android, iOS y los navegadores
       reproducen sin preguntar nada. */
    opts.format = android.media.MediaRecorder.OutputFormat.MPEG_4;
    opts.android = {
      encoder: android.media.MediaRecorder.AudioEncoder.AAC,
      source: android.media.MediaRecorder.AudioSource.MIC,
    };
  }
  await r.start(opts);
  recorder = r;
  return recPath;
}

/* Para la grabación. Devuelve el archivo (o null si no había nada). */
export async function stopRecording(): Promise<RecordedVoice | null> {
  const r = recorder;
  const path = recPath;
  recorder = null;
  recPath = '';
  if (!r) return null;
  try {
    await r.stop();
  } catch (e) { /* el sistema puede quejarse si barely se grabó */ }
  try {
    await r.dispose();
  } catch (e) {}
  if (!path) return null;
  let size = 0;
  try {
    const f = File.fromPath(path);
    size = Number(f.size || 0);
    if (!size) return null;
  } catch (e) {
    return null;
  }
  return {
    path: path,
    size: size,
    type: 'audio/mp4',
    name: path.split('/').pop() || 'nota-de-voz.m4a',
  };
}

/* Tira la grabación y borra el archivo (el usuario canceló). */
export async function cancelRecording(): Promise<void> {
  const r = recorder;
  const path = recPath;
  recorder = null;
  recPath = '';
  if (r) {
    try { await r.stop(); } catch (e) {}
    try { await r.dispose(); } catch (e) {}
  }
  if (path) {
    try { File.fromPath(path).remove(); } catch (e) {}
  }
}

/* Nivel del micrófono (0..100) para la onda en vivo.
   Android: getMaxAmplitude() va de 0 a 32767.
   iOS: averagePowerForChannel() va de -60 dB a 0 dB. */
export function micLevel(): number {
  if (!recorder) return 0;
  let v = 0;
  try {
    v = Number(recorder.getMeters() || 0);
  } catch (e) {
    return 0;
  }
  if (!v) return 0;
  if (isIOS) {
    /* dB -> 0..100 (silencio = 0, 0 dB = 100) */
    const db = Math.max(-60, Math.min(0, v));
    return Math.round(((db + 60) / 60) * 100);
  }
  return Math.min(100, Math.round((v / 32767) * 130));
}

/* ---------------- reproductor ---------------- */

/* Estado del reproductor. La vista se entera con onChange(). */
export interface VoiceState {
  id: number;        // id del mensaje que suena (0 = nada)
  playing: boolean;
  current: number;   // segundos
  duration: number;  // segundos
}

let player: TNSPlayer | null = null;
let curId = 0;
let curPlaying = false;
let curDur = 0;
let listener: ((s: VoiceState) => void) | null = null;

function state(): VoiceState {
  return {
    id: curId,
    playing: curPlaying,
    current: currentVoiceTime(),
    duration: curDur || voiceDuration(),
  };
}

/* La posición y la duración del plugin van en MILISEGUNDOS (Android:
   getCurrentPosition(); iOS: currentTime * 1000). Acá van en segundos. */
export function currentVoiceTime(): number {
  if (!player) return 0;
  try {
    return Number(player.currentTime || 0) / 1000;
  } catch (e) {
    return 0;
  }
}

export function voiceDuration(): number {
  if (!player) return 0;
  try {
    return Number(player.duration || 0) / 1000;
  } catch (e) {
    return 0;
  }
}

function notify() {
  if (!listener) return;
  try { listener(state()); } catch (e) {}
}

export function onVoiceState(cb: ((s: VoiceState) => void) | null): void {
  listener = cb;
}

/* Reproduce la nota de voz del mensaje `id` (URL del CDN).
   Si ya es la que suena, la pausa (el botón es play/pausa). */
export async function toggleVoice(id: number, url: string, durHint: number): Promise<void> {
  if (!url) return;
  try {
    if (curId === id && curPlaying) {
      await pauseVoice();
      return;
    }
    if (curId === id && player) {
      /* estaba en pausa: sigue donde estaba */
      player.resume();
      curPlaying = true;
      notify();
      return;
    }
    await stopVoice();
    curId = id;
    curDur = durHint || 0;
    if (!player) {
      player = new TNSPlayer();
    }
    await player.playFromUrl({
      audioFile: url,
      loop: false,
      completeCallback: () => {
        /* terminó: la UI vuelve al estado de reposo */
        curPlaying = false;
        curId = 0;
        notify();
      },
      errorCallback: () => {
        curPlaying = false;
        notify();
      },
    });
    curPlaying = true;
    notify();
  } catch (e) {
    curPlaying = false;
    notify();
  }
}

export async function pauseVoice(): Promise<void> {
  if (!player || !curPlaying) return;
  try {
    await player.pause();
  } catch (e) {}
  curPlaying = false;
  notify();
}

/* Para lo que esté sonando y libera el reproductor. */
export async function stopVoice(): Promise<void> {
  if (player) {
    try { await player.stop(); } catch (e) {}
    try { await player.dispose(); } catch (e) {}
  }
  player = null;
  curId = 0;
  curPlaying = false;
  curDur = 0;
  notify();
}

/* ¿Está sonando ahora mismo? */
export function isVoicePlaying(): boolean {
  return curPlaying;
}
