-- Unify family_members + business_partners into important_contacts with groups

CREATE TABLE app.important_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES next_auth.users(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  phone text NOT NULL CHECK (char_length(phone) BETWEEN 3 AND 40),
  contact_group text NOT NULL CHECK (contact_group IN ('partners', 'family', 'clients')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, phone)
);

CREATE INDEX important_contacts_user_group_idx
  ON app.important_contacts (user_id, contact_group);

CREATE INDEX important_contacts_user_name_idx
  ON app.important_contacts (user_id, name);

-- Copy family first (wins on phone conflicts)
INSERT INTO app.important_contacts (id, user_id, name, phone, contact_group, created_at, updated_at)
SELECT id, user_id, name, phone, 'family', created_at, updated_at
FROM app.family_members
ON CONFLICT (user_id, phone) DO NOTHING;

INSERT INTO app.important_contacts (id, user_id, name, phone, contact_group, created_at, updated_at)
SELECT id, user_id, name, phone, 'partners', created_at, updated_at
FROM app.business_partners
ON CONFLICT (user_id, phone) DO NOTHING;

UPDATE app.message_rules
SET schema_version = 3
WHERE schema_version < 3;

DROP TABLE IF EXISTS app.family_members;
DROP TABLE IF EXISTS app.business_partners;

ALTER TABLE app.important_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY important_contacts_owner ON app.important_contacts
  FOR ALL
  USING (user_id = next_auth.uid())
  WITH CHECK (user_id = next_auth.uid());

GRANT ALL ON TABLE app.important_contacts TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE app.important_contacts TO authenticated;
