-- Notifications Web Push, ciblées par portée géographique ou élu suivi.
-- Les endpoints et clés sont propres à un navigateur/appareil. Le jeton
-- de gestion n'est jamais stocké en clair (SHA-256 côté API).

ALTER TABLE paysan_resources
  ADD COLUMN IF NOT EXISTS scope_codes TEXT[] NOT NULL DEFAULT '{}';
CREATE INDEX IF NOT EXISTS idx_paysan_resources_scope_codes
  ON paysan_resources USING GIN (scope_codes);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth_secret TEXT NOT NULL,
  manage_token_hash TEXT NOT NULL,
  locale TEXT NOT NULL DEFAULT 'en'
    CHECK (locale IN ('fr','en','es','it','ru','ja','zh','hi')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_success_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS push_preferences (
  id BIGSERIAL PRIMARY KEY,
  subscription_id UUID NOT NULL REFERENCES push_subscriptions(id) ON DELETE CASCADE,
  topic TEXT NOT NULL CHECK (topic IN (
    'petition','deputy_vote','parliament_member_vote','paysan','debunk','future_idea'
  )),
  target_type TEXT NOT NULL CHECK (target_type IN ('scope_code','deputy_uid','member_id')),
  target_value TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (subscription_id, topic, target_type, target_value)
);
CREATE INDEX IF NOT EXISTS idx_push_preferences_match
  ON push_preferences (topic, target_type, target_value) WHERE enabled = true;

CREATE TABLE IF NOT EXISTS notification_events (
  id BIGSERIAL PRIMARY KEY,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'petition_published','paysan_published','debunk_published',
    'future_idea_published','deputy_vote_recorded','parliament_member_vote_recorded'
  )),
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  scope_codes TEXT[] NOT NULL DEFAULT '{}',
  metadata JSONB NOT NULL DEFAULT '{}',
  available_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  UNIQUE (event_type, entity_type, entity_id)
);
CREATE INDEX IF NOT EXISTS idx_notification_events_pending
  ON notification_events (available_at, id) WHERE processed_at IS NULL;

CREATE TABLE IF NOT EXISTS push_deliveries (
  event_id BIGINT NOT NULL REFERENCES notification_events(id) ON DELETE CASCADE,
  subscription_id UUID NOT NULL REFERENCES push_subscriptions(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','sending','sent','retry','failed','expired','skipped')),
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_error TEXT,
  sent_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, subscription_id)
);
CREATE INDEX IF NOT EXISTS idx_push_deliveries_due
  ON push_deliveries (next_attempt_at) WHERE status IN ('pending','retry');

-- Événements éditoriaux créés dans la même transaction que la publication.
-- Une dépublication/republication ne crée pas de doublon grâce à la clé unique.
CREATE OR REPLACE FUNCTION enqueue_editorial_push_event()
RETURNS TRIGGER AS $$
DECLARE
  event_name TEXT;
  content_type TEXT;
BEGIN
  IF NEW.published IS TRUE AND COALESCE(OLD.published, FALSE) IS FALSE THEN
    IF TG_TABLE_NAME = 'petitions' THEN
      event_name := 'petition_published'; content_type := 'petition';
    ELSIF TG_TABLE_NAME = 'paysan_resources' THEN
      event_name := 'paysan_published'; content_type := 'paysan';
    ELSIF TG_TABLE_NAME = 'debunk_entries' THEN
      event_name := 'debunk_published'; content_type := 'debunk';
    ELSIF TG_TABLE_NAME = 'future_ideas' THEN
      event_name := 'future_idea_published'; content_type := 'future_idea';
    ELSE
      RETURN NEW;
    END IF;

    INSERT INTO notification_events
      (event_type, entity_type, entity_id, scope_codes, metadata)
    VALUES
      (event_name, content_type, NEW.slug, COALESCE(NEW.scope_codes, '{}'),
       jsonb_build_object('slug', NEW.slug))
    ON CONFLICT (event_type, entity_type, entity_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_petitions_push_event ON petitions;
CREATE TRIGGER trg_petitions_push_event AFTER UPDATE OF published ON petitions
FOR EACH ROW EXECUTE FUNCTION enqueue_editorial_push_event();

DROP TRIGGER IF EXISTS trg_paysan_push_event ON paysan_resources;
CREATE TRIGGER trg_paysan_push_event AFTER UPDATE OF published ON paysan_resources
FOR EACH ROW EXECUTE FUNCTION enqueue_editorial_push_event();

DROP TRIGGER IF EXISTS trg_debunk_push_event ON debunk_entries;
CREATE TRIGGER trg_debunk_push_event AFTER UPDATE OF published ON debunk_entries
FOR EACH ROW EXECUTE FUNCTION enqueue_editorial_push_event();

DROP TRIGGER IF EXISTS trg_future_ideas_push_event ON future_ideas;
CREATE TRIGGER trg_future_ideas_push_event AFTER UPDATE OF published ON future_ideas
FOR EACH ROW EXECUTE FUNCTION enqueue_editorial_push_event();

-- Les INSERT déjà publiés doivent également produire un événement.
CREATE OR REPLACE FUNCTION enqueue_editorial_push_event_on_insert()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.published IS TRUE THEN
    INSERT INTO notification_events (event_type, entity_type, entity_id, scope_codes, metadata)
    VALUES (
      CASE TG_TABLE_NAME
        WHEN 'petitions' THEN 'petition_published'
        WHEN 'paysan_resources' THEN 'paysan_published'
        WHEN 'debunk_entries' THEN 'debunk_published'
        WHEN 'future_ideas' THEN 'future_idea_published'
      END,
      CASE TG_TABLE_NAME
        WHEN 'petitions' THEN 'petition'
        WHEN 'paysan_resources' THEN 'paysan'
        WHEN 'debunk_entries' THEN 'debunk'
        WHEN 'future_ideas' THEN 'future_idea'
      END,
      NEW.slug, COALESCE(NEW.scope_codes, '{}'), jsonb_build_object('slug', NEW.slug)
    ) ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_petitions_push_insert ON petitions;
CREATE TRIGGER trg_petitions_push_insert AFTER INSERT ON petitions
FOR EACH ROW EXECUTE FUNCTION enqueue_editorial_push_event_on_insert();
DROP TRIGGER IF EXISTS trg_paysan_push_insert ON paysan_resources;
CREATE TRIGGER trg_paysan_push_insert AFTER INSERT ON paysan_resources
FOR EACH ROW EXECUTE FUNCTION enqueue_editorial_push_event_on_insert();
DROP TRIGGER IF EXISTS trg_debunk_push_insert ON debunk_entries;
CREATE TRIGGER trg_debunk_push_insert AFTER INSERT ON debunk_entries
FOR EACH ROW EXECUTE FUNCTION enqueue_editorial_push_event_on_insert();
DROP TRIGGER IF EXISTS trg_future_ideas_push_insert ON future_ideas;
CREATE TRIGGER trg_future_ideas_push_insert AFTER INSERT ON future_ideas
FOR EACH ROW EXECUTE FUNCTION enqueue_editorial_push_event_on_insert();

-- Les ingestions parlementaires font des INSERT idempotents. Les triggers
-- n'émettent donc qu'un événement par vote et par élu, quelle que soit la
-- fréquence de relance des scripts d'ingestion.
CREATE OR REPLACE FUNCTION enqueue_deputy_vote_push_event()
RETURNS TRIGGER AS $$
DECLARE vote_title TEXT;
BEGIN
  SELECT title INTO vote_title FROM scrutins
  WHERE legislature = NEW.legislature AND numero = NEW.numero_scrutin;
  INSERT INTO notification_events
    (event_type, entity_type, entity_id, scope_codes, metadata)
  VALUES (
    'deputy_vote_recorded', 'deputy_vote',
    NEW.legislature || ':' || NEW.numero_scrutin || ':' || NEW.acteur_uid,
    ARRAY['FRA'],
    jsonb_build_object(
      'deputy_uid', NEW.acteur_uid,
      'title', COALESCE(vote_title, 'New parliamentary vote'),
      'url', '/scrutins/' || NEW.legislature || '/' || NEW.numero_scrutin
    )
  ) ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_deputy_vote_push_event ON deputy_votes;
CREATE TRIGGER trg_deputy_vote_push_event AFTER INSERT ON deputy_votes
FOR EACH ROW EXECUTE FUNCTION enqueue_deputy_vote_push_event();

CREATE OR REPLACE FUNCTION enqueue_member_vote_push_event()
RETURNS TRIGGER AS $$
DECLARE vote_row RECORD;
BEGIN
  SELECT v.country_code, v.chamber, v.question, m.external_id, m.full_name
    INTO vote_row
  FROM parliament_votes v, parliament_members m
  WHERE v.id = NEW.vote_id AND m.id = NEW.member_id;
  INSERT INTO notification_events
    (event_type, entity_type, entity_id, scope_codes, metadata)
  VALUES (
    'parliament_member_vote_recorded', 'parliament_member_vote',
    NEW.vote_id || ':' || NEW.member_id,
    ARRAY[vote_row.country_code],
    jsonb_build_object(
      'member_id', NEW.member_id,
      'member_name', vote_row.full_name,
      'title', vote_row.question,
      'url', '/international/' || lower(vote_row.country_code) || '/scrutins/' || NEW.vote_id
    )
  ) ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_member_vote_push_event ON parliament_member_votes;
CREATE TRIGGER trg_member_vote_push_event AFTER INSERT ON parliament_member_votes
FOR EACH ROW EXECUTE FUNCTION enqueue_member_vote_push_event();
