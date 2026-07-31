-- Réglages généraux du site, en clé/valeur — extensible pour de futurs
-- interrupteurs (ex: activer/désactiver une section) sans nouvelle
-- migration à chaque fois.
CREATE TABLE IF NOT EXISTS site_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- Désactivée par défaut : l'envoi réel des emails n'est pas encore
-- configuré (nécessite un service tiers comme Brevo/Mailgun/SendGrid),
-- donc pas la peine de proposer l'inscription tant que ce n'est pas prêt.
INSERT INTO site_settings (key, value) VALUES ('newsletter_enabled', 'false')
ON CONFLICT (key) DO NOTHING;
