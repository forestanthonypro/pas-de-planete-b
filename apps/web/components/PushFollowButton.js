import { useState } from "react";
import { useT } from "../lib/useT";
import { isIosNotInstalled, readPushManagement, supportsWebPush, urlBase64ToUint8Array, writePushManagement } from "../lib/pushNotifications";


export default function PushFollowButton({ topic, targetType, targetValue, name }) {
  const { locale } = useT();
  const [status, setStatus] = useState("idle");

  async function follow() {
    setStatus("saving");
    try {
      if (!supportsWebPush()) throw new Error("unsupported");
      if (isIosNotInstalled()) throw new Error("install");
      if (await Notification.requestPermission() !== "granted") throw new Error("denied");
      const registration = await navigator.serviceWorker.ready;
      let browserSubscription = await registration.pushManager.getSubscription();
      if (!browserSubscription) {
        const { publicKey } = await fetch(`/api/push/public-key`).then((response) => response.json());
        browserSubscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) });
      }
      let management = readPushManagement();
      if (!management) {
        const response = await fetch(`/api/push/subscriptions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subscription: browserSubscription.toJSON(), locale }) });
        if (!response.ok) throw new Error("subscription");
        management = await response.json();
      }
      const extra = [...(management.extraPreferences || []).filter((item) => !(item.topic === topic && item.targetValue === String(targetValue))), { topic, targetType, targetValue: String(targetValue) }];
      const geographic = (management.scopes || []).flatMap((scope) => Object.entries(management.topics || {}).filter(([, enabled]) => enabled).map(([savedTopic]) => ({ topic: savedTopic, targetType: "scope_code", targetValue: scope })));
      const response = await fetch(`/api/push/preferences`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subscriptionId: management.subscriptionId, manageToken: management.manageToken, locale, preferences: [...geographic, ...extra] }) });
      if (!response.ok) throw new Error("saving");
      management = { ...management, extraPreferences: extra };
      writePushManagement(management); setStatus("done");
    } catch (error) { setStatus(error.message === "install" ? "install" : "error"); }
  }

  if (status === "done") return <p role="status" style={{ color: "#1baf7a", fontSize: 13 }}>✓ {name}</p>;
  return (
    <div style={{ margin: "0.5rem 0" }}>
      <button type="button" onClick={follow} disabled={status === "saving"}>🔔 {status === "saving" ? "…" : `Push : ${name}`}</button>
      {status === "install" && <p role="alert" style={{ fontSize: 12 }}>Sur iPhone/iPad, ajoutez d’abord le site à l’écran d’accueil.</p>}
      {status === "error" && <p role="alert" style={{ fontSize: 12, color: "#d63e2a" }}>Impossible d’activer les notifications.</p>}
    </div>
  );
}
