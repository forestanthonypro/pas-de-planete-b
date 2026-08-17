// Envoi d'email via l'API transactionnelle Brevo. Si BREVO_API_KEY n'est
// pas configurée (cas par défaut en développement, avant que le compte
// Brevo soit créé), on se contente de logger le contenu au lieu d'échouer
// — permet de développer/tester tout le système de suivi sans dépendre
// d'un vrai envoi d'email.
export async function sendEmail({ to, subject, html, replyTo }) {
  const apiKey = process.env.BREVO_API_KEY;

  if (!apiKey) {
    console.log(`[email non envoyé — BREVO_API_KEY absente] À: ${to} | Sujet: ${subject}`);
    return { sent: false, reason: "no_api_key" };
  }

  const senderEmail = process.env.BREVO_SENDER_EMAIL || "no-reply@pasdeplaneteb.fr";
  const senderName = process.env.BREVO_SENDER_NAME || "Pas de planète B";

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "api-key": apiKey,
    },
    body: JSON.stringify({
      sender: { email: senderEmail, name: senderName },
      to: [{ email: to }],
      subject,
      htmlContent: html,
      ...(replyTo ? { replyTo: { email: replyTo } } : {}),
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Échec d'envoi Brevo (${res.status}): ${detail}`);
  }

  return { sent: true };
}
