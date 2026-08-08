import { Router } from "express";
import { requireAdminSession } from "../lib/auth.js";
import { errorDetail } from "../lib/errors.js";

const router = Router();

// --- Traduction automatique (admin uniquement) ---
// Utilisée depuis /admin pour pré-remplir les traductions à partir du texte
// français, jamais exposée aux visiteurs du site. Le résultat est un
// brouillon à relire avant enregistrement, jamais publié automatiquement.
//
// Utilise Google Cloud Translation (API v2, REST simple par clé API) —
// seul service testé couvrant les 8 langues du site, notamment l'hindi
// (DeepL, alternative généralement meilleure en qualité, ne le supporte
// pas). Clé requise dans .env : GOOGLE_TRANSLATE_API_KEY.

const GOOGLE_LANG_CODES = {
  en: "en", es: "es", it: "it", ru: "ru", ja: "ja", zh: "zh", hi: "hi",
};

async function translateBatch(strings, targetLang) {
  const googleLang = GOOGLE_LANG_CODES[targetLang];
  if (!googleLang) throw new Error(`Langue cible non supportée : ${targetLang}`);

  const params = new URLSearchParams();
  params.append("key", process.env.GOOGLE_TRANSLATE_API_KEY);
  params.append("source", "fr");
  params.append("target", googleLang);
  params.append("format", "text");
  strings.forEach((s) => params.append("q", s));

  const res = await fetch("https://translation.googleapis.com/language/translate/v2", {
    method: "POST",
    body: params,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Google Translate a répondu ${res.status} : ${body.slice(0, 200)}`);
  }
  const data = await res.json();
  return data.data.translations.map((t) => t.translatedText);
}

// Corps attendu : { texts: { champA: "...", champB: "..." }, targetLangs: ["en", "es", ...] }
// Réponse : { en: { champA: "...", champB: "..." }, es: { ... }, ... }
router.post("/api/admin/translate", requireAdminSession, async (req, res) => {
  const { texts, targetLangs } = req.body || {};

  if (!texts || typeof texts !== "object" || Object.keys(texts).length === 0) {
    return res.status(400).json({ error: "texts est requis (objet non vide)" });
  }
  if (!Array.isArray(targetLangs) || targetLangs.length === 0) {
    return res.status(400).json({ error: "targetLangs est requis (tableau non vide)" });
  }
  if (!process.env.GOOGLE_TRANSLATE_API_KEY) {
    return res.status(503).json({ error: "Traduction automatique non configurée (clé Google Translate absente)" });
  }

  const fieldNames = Object.keys(texts);
  const sourceStrings = fieldNames.map((f) => texts[f] || "");

  try {
    const result = {};
    for (const lang of targetLangs) {
      const translated = await translateBatch(sourceStrings, lang);
      result[lang] = {};
      fieldNames.forEach((field, i) => {
        result[lang][field] = translated[i];
      });
    }
    res.json(result);
  } catch (err) {
    res.status(502).json({ error: "Échec de la traduction automatique", detail: errorDetail(err) });
  }
});

export default router;
