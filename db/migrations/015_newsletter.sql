-- Inscriptions à la newsletter "Il est temps d'agir !" — collecte le profil
-- (ville/campagne, maison/appartement, enfants) pour personnaliser les
-- actions proposées. Ne couvre que le stockage : l'envoi réel des emails
-- nécessite un service tiers (Mailgun, SendGrid, Brevo...) à choisir et
-- configurer séparément.
CREATE TABLE IF NOT EXISTS newsletter_subscribers (
    id SERIAL PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    area_type TEXT,       -- 'ville' ou 'campagne'
    housing_type TEXT,    -- 'maison' ou 'appartement'
    has_children BOOLEAN,
    confirmed BOOLEAN NOT NULL DEFAULT false,
    unsubscribed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
