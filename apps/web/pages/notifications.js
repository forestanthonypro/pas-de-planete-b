import { useEffect, useState } from "react";
import PageHeader from "../components/PageHeader";
import ScopeMultiSelect from "../components/ScopeMultiSelect";
import { IconBell } from "../components/icons";
import { useT } from "../lib/useT";
import { clearPushManagement, isIosNotInstalled, readPushManagement, supportsWebPush, urlBase64ToUint8Array, writePushManagement } from "../lib/pushNotifications";

const COPY = {
  fr: { title: "Mes notifications", intro: "Choisissez les pays et les sujets qui vous intéressent.", countries: "Pays ou régions suivis", enable: "Activer les notifications", save: "Enregistrer mes choix", disable: "Désactiver les notifications", petition: "Nouvelles pétitions", paysan: "Nouveaux articles — On devient tous paysans", debunk: "Nouveaux débunks", future: "Nouvelles idées pour le futur", saved: "Préférences enregistrées.", ios: "Sur iPhone ou iPad, ajoutez d’abord ce site à l’écran d’accueil depuis le menu Partager, puis ouvrez l’application installée.", unsupported: "Les notifications push ne sont pas prises en charge par ce navigateur." },
  en: { title: "My notifications", intro: "Choose the countries and topics you want to follow.", countries: "Countries or regions followed", enable: "Enable notifications", save: "Save my choices", disable: "Disable notifications", petition: "New petitions", paysan: "New articles — We can all become farmers", debunk: "New fact-checks", future: "New ideas for the future", saved: "Preferences saved.", ios: "On iPhone or iPad, first add this site to your Home Screen from the Share menu, then open the installed app.", unsupported: "Push notifications are not supported by this browser." },
};

export default function NotificationsPage() {
  const { locale } = useT();
  const c = COPY[locale] || COPY.en;
  const [scopes, setScopes] = useState([]);
  const [topics, setTopics] = useState({ petition: true, paysan: true, debunk: true, future_idea: false });
  const [management, setManagement] = useState(null);
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");
  // Valeurs par défaut déterministes côté serveur (aucune des deux branches
  // n'est affichée tant qu'on n'a pas confirmé côté client) — évite le
  // mismatch d'hydratation lié à `typeof window`, cf. lib/pushNotifications.js.
  const [browserSupportsPush, setBrowserSupportsPush] = useState(true);
  const [iosNeedsInstall, setIosNeedsInstall] = useState(false);

  useEffect(() => {
    const stored = readPushManagement();
    if (stored) {
      setManagement(stored);
      setScopes(stored.scopes || []);
      setTopics(stored.topics || topics);
    }
    setBrowserSupportsPush(supportsWebPush());
    setIosNeedsInstall(isIosNotInstalled());
  // Initialisation unique depuis ce navigateur.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function ensureSubscription() {
    if (!supportsWebPush()) throw new Error(c.unsupported);
    if (isIosNotInstalled()) throw new Error(c.ios);
    const permission = await Notification.requestPermission();
    if (permission !== "granted") throw new Error(c.unsupported);
    const registration = await navigator.serviceWorker.ready;
    let browserSubscription = await registration.pushManager.getSubscription();
    if (!browserSubscription) {
      const keyResponse = await fetch(`/api/push/public-key`);
      if (!keyResponse.ok) throw new Error("Push service unavailable");
      const { publicKey } = await keyResponse.json();
      browserSubscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) });
    }
    if (management) return { browserSubscription, management };
    const response = await fetch(`/api/push/subscriptions`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscription: browserSubscription.toJSON(), locale }),
    });
    if (!response.ok) throw new Error("Subscription failed");
    const created = await response.json();
    return { browserSubscription, management: created };
  }

  async function save() {
    setStatus("saving"); setMessage("");
    try {
      const result = await ensureSubscription();
      const preferences = scopes.flatMap((scope) => Object.entries(topics)
        .filter(([, enabled]) => enabled)
        .map(([topic]) => ({ topic, targetType: "scope_code", targetValue: scope })));
      const response = await fetch(`/api/push/preferences`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...result.management, locale, preferences: [...preferences, ...(result.management.extraPreferences || [])] }),
      });
      if (!response.ok) throw new Error("Saving failed");
      const stored = { ...result.management, scopes, topics, extraPreferences: result.management.extraPreferences || [] };
      writePushManagement(stored); setManagement(stored); setStatus("done"); setMessage(c.saved);
    } catch (error) { setStatus("error"); setMessage(error.message); }
  }

  async function disable() {
    setStatus("saving");
    try {
      const registration = await navigator.serviceWorker.ready;
      const current = await registration.pushManager.getSubscription();
      if (management) await fetch(`/api/push/subscriptions/${management.subscriptionId}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ manageToken: management.manageToken }) });
      if (current) await current.unsubscribe();
      clearPushManagement(); setManagement(null); setStatus("idle"); setMessage("");
    } catch { setStatus("error"); }
  }

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "2rem 1rem" }}>
      <PageHeader Icon={IconBell} tint="green" title={c.title}><p>{c.intro}</p></PageHeader>
      {iosNeedsInstall && <p role="status" style={{ padding: 12, border: "1px solid #ba7517", borderRadius: 8 }}>{c.ios}</p>}
      {!browserSupportsPush && <p role="alert">{c.unsupported}</p>}
      <ScopeMultiSelect value={scopes} onChange={setScopes} locale={locale} label={c.countries} placeholder="France, Europe, World…" />
      <fieldset style={{ margin: "1.5rem 0", border: "1px solid var(--color-bordure)", borderRadius: 8 }}>
        {[["petition", c.petition], ["paysan", c.paysan], ["debunk", c.debunk], ["future_idea", c.future]].map(([key, label]) => (
          <label key={key} style={{ display: "block", padding: 8 }}><input type="checkbox" checked={topics[key]} onChange={(e) => setTopics({ ...topics, [key]: e.target.checked })} /> {label}</label>
        ))}
      </fieldset>
      <button type="button" onClick={save} disabled={status === "saving" || scopes.length === 0}>{management ? c.save : c.enable}</button>
      {management && <button type="button" onClick={disable} disabled={status === "saving"} style={{ marginLeft: 12 }}>{c.disable}</button>}
      {message && <p role={status === "error" ? "alert" : "status"}>{message}</p>}
    </div>
  );
}

export async function getStaticProps() { return { props: {} }; }
