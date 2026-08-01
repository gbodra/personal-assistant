-- Family members module

CREATE TABLE app.family_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES next_auth.users(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  phone text NOT NULL CHECK (char_length(phone) BETWEEN 3 AND 40),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX family_members_user_idx ON app.family_members (user_id, name);

ALTER TABLE app.family_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY family_members_owner ON app.family_members
  FOR ALL
  USING (user_id = next_auth.uid())
  WITH CHECK (user_id = next_auth.uid());

GRANT ALL ON TABLE app.family_members TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE app.family_members TO authenticated;
