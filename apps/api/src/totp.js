// Implémentation TOTP (RFC 6238) sans dépendance externe — compatible
// Google Authenticator, Authy, etc. Utilisé uniquement pour l'accès à
// l'administration de contenu (pas pour l'ingestion automatisée CI/CD, qui
// garde son jeton statique séparé).
import crypto from "crypto";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function generateBase32Secret(byteLength = 20) {
  const bytes = crypto.randomBytes(byteLength);
  let bits = "";
  for (const byte of bytes) bits += byte.toString(2).padStart(8, "0");
  let secret = "";
  for (let i = 0; i + 5 <= bits.length; i += 5) {
    secret += BASE32_ALPHABET[parseInt(bits.slice(i, i + 5), 2)];
  }
  return secret;
}

function base32Decode(base32) {
  const clean = base32.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = "";
  for (const char of clean) {
    const val = BASE32_ALPHABET.indexOf(char);
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, "0");
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

function hotp(secretBuffer, counter) {
  const counterBuffer = Buffer.alloc(8);
  // Écrit le compteur sur 64 bits (big-endian) — on n'utilise que les 32
  // bits de poids faible en pratique, largement suffisant ici.
  counterBuffer.writeUInt32BE(counter, 4);

  const hmac = crypto.createHmac("sha1", secretBuffer).update(counterBuffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return (binary % 1000000).toString().padStart(6, "0");
}

// Vérifie un code à 6 chiffres, en tolérant ±1 fenêtre de 30s (dérive
// d'horloge raisonnable entre le téléphone et le serveur).
//
// Comparaison en temps constant (crypto.timingSafeEqual) plutôt que
// "===" — même principe que timingSafeTokenEqual dans lib/auth.js pour
// le jeton d'ingestion. Moins critique ici (limite de fréquence déjà en
// place sur cette route, code à 6 chiffres donc entropie limitée de
// toute façon), mais protège en profondeur sans coût.
function timingSafeCodeEqual(a, b) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export function verifyTotp(secretBase32, code, window = 1) {
  if (!/^\d{6}$/.test(String(code || ""))) return false;
  const secretBuffer = base32Decode(secretBase32);
  const counter = Math.floor(Date.now() / 1000 / 30);
  for (let errorWindow = -window; errorWindow <= window; errorWindow++) {
    if (timingSafeCodeEqual(hotp(secretBuffer, counter + errorWindow), String(code))) return true;
  }
  return false;
}

export function buildOtpauthUri(secretBase32, label = "Pas de planète B", issuer = "PDPB Admin") {
  const encodedLabel = encodeURIComponent(`${issuer}:${label}`);
  const encodedIssuer = encodeURIComponent(issuer);
  return `otpauth://totp/${encodedLabel}?secret=${secretBase32}&issuer=${encodedIssuer}&digits=6&period=30`;
}
