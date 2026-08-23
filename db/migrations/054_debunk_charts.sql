-- Permet d'attacher des graphiques (Chart.js) aux entrées debunk, saisis
-- par l'admin sous forme de configuration JSON (données pures : type,
-- libellés, valeurs, couleurs) — jamais de code exécutable collé et
-- stocké en base, pour rester cohérent avec le reste du durcissement
-- sécurité du site (voir audit du 21 août). Le rendu réel se fait
-- toujours via le Chart.js déjà enregistré côté site (lib/chartSetup.js),
-- jamais via un script fourni par l'admin.
ALTER TABLE debunk_entries ADD COLUMN IF NOT EXISTS charts JSONB;
