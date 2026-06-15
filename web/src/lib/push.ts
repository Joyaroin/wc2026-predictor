// Web Push client helpers: register the service worker, subscribe/unsubscribe, and report support.
import { api } from '../api/client';

export function pushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

/** True only when push can actually be delivered (iOS Safari needs the PWA installed). */
export function pushDeliverable(): boolean {
  if (!pushSupported()) return false;
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const installed = window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
  return isIOS ? installed : true;
}

let swReg: Promise<ServiceWorkerRegistration> | null = null;
export function registerServiceWorker(): Promise<ServiceWorkerRegistration> {
  if (!swReg) swReg = navigator.serviceWorker.register('/sw.js');
  return swReg;
}

export async function pushSubscribed(): Promise<boolean> {
  if (!pushSupported()) return false;
  const reg = await registerServiceWorker();
  return !!(await reg.pushManager.getSubscription());
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

/** Ask permission, subscribe, and register with the server. Throws with a friendly reason on failure. */
export async function enablePush(): Promise<void> {
  if (!pushSupported()) throw new Error('Notifications aren’t supported on this browser.');
  const { publicKey } = await api.pushPublicKey();
  if (!publicKey) throw new Error('Notifications aren’t available right now.');

  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('Permission denied — allow notifications in your browser settings.');

  const reg = await registerServiceWorker();
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    }));

  const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) throw new Error('Could not create a subscription.');
  await api.pushSubscribe({ endpoint: json.endpoint, keys: { p256dh: json.keys.p256dh, auth: json.keys.auth } });
}

export async function disablePush(): Promise<void> {
  if (!pushSupported()) return;
  const reg = await registerServiceWorker();
  const sub = await reg.pushManager.getSubscription();
  if (sub) {
    await api.pushUnsubscribe(sub.endpoint).catch(() => {});
    await sub.unsubscribe().catch(() => {});
  }
}
