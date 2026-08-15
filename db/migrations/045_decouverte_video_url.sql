-- URL de la vidéo YouTube affichée au clic sur "Comprendre en 4 minutes" sur
-- /decouverte — éditable depuis /admin/settings sans déploiement, même
-- patron que newsletter_enabled (voir 030_site_settings.sql).
INSERT INTO site_settings (key, value) VALUES ('decouverte_video_url', 'https://www.youtube.com/watch?v=NfaeoCORuzk')
ON CONFLICT (key) DO NOTHING;
