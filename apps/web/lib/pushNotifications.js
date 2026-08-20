const STORAGE_KEY = "pdpb_push_management_v1";

export function urlBase64ToUint8Array(value) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}

export function readPushManagement() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || null;
  } catch {
    return null;
  }
}

export function writePushManagement(value) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
}

export function clearPushManagement() {
  localStorage.removeItem(STORAGE_KEY);
}

export function supportsWebPush() {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export function isIosNotInstalled() {
  if (typeof window === "undefined") return false;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  return ios && !standalone;
}
