-- Generalise the "experiences" table into a unified resume timeline that also
-- holds education and certifications, distinguished by `kind`. A `url` column
-- supports links (credential pages, institution pages, etc.).

ALTER TABLE experiences ADD COLUMN kind TEXT NOT NULL DEFAULT 'work';
ALTER TABLE experiences ADD COLUMN url TEXT;

CREATE INDEX IF NOT EXISTS idx_experiences_kind ON experiences(kind, sort_order);
