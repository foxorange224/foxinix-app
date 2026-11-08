/* ns-vue-stub.mjs — stub de `nativescript-vue` para probar el núcleo en
   Node. Reproduce la API de composición con el MISMO comportamiento
   observable que necesita el núcleo (ref/reactivity/watch). */

export function ref(value) {
  return { value, __v_isRef: true };
}
export function computed(getter) {
  return {
    __v_isRef: true,
    get value() { return getter(); },
  };
}
export function reactive(obj) { return obj; }
export function readonly(obj) { return obj; }
export function watch() { return function () {}; }
export function watchEffect() { return function () {}; }
export function nextTick(fn) {
  return Promise.resolve().then(function () { if (fn) fn(); });
}
export function onMounted() {}
export function onUnmounted() {}
export function onUpdated() {}
export function onBeforeMount() {}
export function onBeforeUnmount() {}
export function provide() {}
export function inject() { return undefined; }
export function createApp() { return { start() {} }; }
export function component() { return {}; }

export default {
  ref, computed, reactive, readonly, watch, watchEffect, nextTick,
  onMounted, onUnmounted, onUpdated, onBeforeMount, onBeforeUnmount,
  provide, inject, createApp, component,
};
