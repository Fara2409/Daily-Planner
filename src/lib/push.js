// Push-уведомления: подписка этого устройства и сохранение её на сервере.
import { supabase } from './supabase.js';

// ПУБЛИЧНЫЙ VAPID-ключ — его можно хранить в коде.
// Приватная пара к нему хранится только в секретах Supabase.
export const VAPID_PUBLIC_KEY = 'VAPID_PUBLIC_KEY_HERE';

const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;

// Что можно сделать на этом устройстве:
//   'unsupported'   — браузер не умеет push
//   'needs-install' — iPhone: push работает только в приложении, добавленном на главный экран
//   'denied'        — человек запретил уведомления в настройках
//   'on' / 'off'    — включены / выключены
export async function getPushState() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return isIOS() && !isStandalone() ? 'needs-install' : 'unsupported';
  }
  if (Notification.permission === 'denied') return 'denied';
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  return sub && Notification.permission === 'granted' ? 'on' : 'off';
}

function urlBase64ToUint8Array(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function saveSubscription(sub, lang) {
  const json = sub.toJSON();
  const { error } = await supabase.rpc('save_push_subscription', {
    p_endpoint: json.endpoint,
    p_p256dh: json.keys.p256dh,
    p_auth: json.keys.auth,
    p_lang: lang,
    p_user_agent: navigator.userAgent,
  });
  if (error) throw error;
}

// Включить уведомления (нужно вызывать по нажатию кнопки — иначе iPhone не покажет запрос).
export async function enablePush(lang) {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'off';

  const reg = await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true, // каждое push-сообщение обязательно показывается человеку
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    }));
  await saveSubscription(sub, lang);
  return 'on';
}

export async function disablePush() {
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
    await sub.unsubscribe();
  }
  return 'off';
}

// При каждом запуске: если уведомления уже включены — обновить запись на сервере
// (язык мог поменяться, или запись удалилась при смене аккаунта).
export async function refreshPush(lang) {
  try {
    if ((await getPushState()) !== 'on') return;
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg.pushManager.getSubscription();
    await saveSubscription(sub, lang);
  } catch (e) {
    console.error('refreshPush', e);
  }
}
