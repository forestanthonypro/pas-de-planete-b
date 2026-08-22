-- paysan_resources avait été oubliée lors de 049_submitter_contact.sql, qui
-- a ajouté ces deux colonnes aux 5 autres tables avec formulaire public
-- (petitions, resource_locations, resource_online, future_idea_suggestions,
-- debunk_entries, science_relays). Repéré le 21 août : le formulaire public
-- "On devient tous paysans" n'avait aucun moyen de transmettre un contexte
-- ou un email à l'équipe de modération.
ALTER TABLE paysan_resources ADD COLUMN IF NOT EXISTS submitter_email TEXT;
ALTER TABLE paysan_resources ADD COLUMN IF NOT EXISTS submission_notes TEXT;
