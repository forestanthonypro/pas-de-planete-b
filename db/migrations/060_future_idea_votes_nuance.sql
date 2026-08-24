-- Aligne le vote des idées-enfants sur celui de la charte éthique :
-- adhère / à nuancer, au lieu d'un simple soutien binaire. Les votes
-- existants deviennent 'adhere' (équivalent du "soutien" d'avant), aucune
-- perte de données.

ALTER TABLE future_idea_votes
  ADD COLUMN IF NOT EXISTS vote_type TEXT NOT NULL DEFAULT 'adhere';
