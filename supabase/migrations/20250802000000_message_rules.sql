-- Message prioritization rules, contact lists, and WhatsApp message formalization

-- Priority on cards (urgency; lanes remain workflow)
ALTER TABLE app.cards
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'normal';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cards_priority_check'
  ) THEN
    ALTER TABLE app.cards
      ADD CONSTRAINT cards_priority_check
      CHECK (priority IN ('critical', 'high', 'normal', 'low'));
  END IF;
END $$;

ALTER TABLE app.cards
  ADD COLUMN IF NOT EXISTS source_message_id uuid;

-- Business partners (mirror of family_members)
CREATE TABLE IF NOT EXISTS app.business_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES next_auth.users(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  phone text NOT NULL CHECK (char_length(phone) BETWEEN 3 AND 40),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS business_partners_user_idx
  ON app.business_partners (user_id, name);

-- WhatsApp groups known to the user (Evolution external ids)
CREATE TABLE IF NOT EXISTS app.whatsapp_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES next_auth.users(id) ON DELETE CASCADE,
  external_group_id text NOT NULL,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 200),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, external_group_id)
);

CREATE INDEX IF NOT EXISTS whatsapp_groups_user_idx
  ON app.whatsapp_groups (user_id, name);

-- Structured message rules (evaluated by n8n)
CREATE TABLE IF NOT EXISTS app.message_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES next_auth.users(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 200),
  enabled boolean NOT NULL DEFAULT true,
  position int NOT NULL,
  schema_version int NOT NULL DEFAULT 1,
  conditions jsonb NOT NULL DEFAULT '[]'::jsonb,
  actions jsonb NOT NULL,
  is_catch_all boolean NOT NULL DEFAULT false,
  source_utterance text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, position)
);

CREATE INDEX IF NOT EXISTS message_rules_user_enabled_position_idx
  ON app.message_rules (user_id, enabled, position);

-- Formalize messages_received (may already exist in live DB)
CREATE TABLE IF NOT EXISTS app.messages_received (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  "from" text,
  message text,
  message_type text,
  image_base64 text,
  video_bse64 text,
  audio_base64 text,
  processed boolean DEFAULT false,
  is_group boolean NOT NULL DEFAULT false,
  group_id text,
  participant text,
  was_mentioned boolean NOT NULL DEFAULT true
);

ALTER TABLE app.messages_received
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES next_auth.users(id) ON DELETE CASCADE;

ALTER TABLE app.messages_received
  ADD COLUMN IF NOT EXISTS matched_rule_id uuid REFERENCES app.message_rules(id) ON DELETE SET NULL;

ALTER TABLE app.messages_received
  ADD COLUMN IF NOT EXISTS card_id uuid REFERENCES app.cards(id) ON DELETE SET NULL;

ALTER TABLE app.messages_received
  ADD COLUMN IF NOT EXISTS classification jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE app.messages_received
  ADD COLUMN IF NOT EXISTS processed_at timestamptz;

ALTER TABLE app.messages_received
  ADD COLUMN IF NOT EXISTS is_group boolean NOT NULL DEFAULT false;

ALTER TABLE app.messages_received
  ADD COLUMN IF NOT EXISTS group_id text;

ALTER TABLE app.messages_received
  ADD COLUMN IF NOT EXISTS participant text;

ALTER TABLE app.messages_received
  ADD COLUMN IF NOT EXISTS was_mentioned boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS messages_received_user_processed_idx
  ON app.messages_received (user_id, processed, created_at DESC);

CREATE INDEX IF NOT EXISTS messages_received_matched_rule_idx
  ON app.messages_received (matched_rule_id);

-- Optional FK from cards to source message (after messages_received exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cards_source_message_id_fkey'
  ) THEN
    ALTER TABLE app.cards
      ADD CONSTRAINT cards_source_message_id_fkey
      FOREIGN KEY (source_message_id) REFERENCES app.messages_received(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS cards_source_message_idx
  ON app.cards (source_message_id)
  WHERE source_message_id IS NOT NULL;

-- Phone normalization helper (digits only, keep leading country code as stored)
CREATE OR REPLACE FUNCTION app.normalize_phone(raw text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT NULLIF(regexp_replace(coalesce(raw, ''), '[^0-9]', '', 'g'), '');
$$;

GRANT EXECUTE ON FUNCTION app.normalize_phone(text) TO postgres, service_role, authenticated;

-- RLS
ALTER TABLE app.business_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.whatsapp_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.message_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.messages_received ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS business_partners_owner ON app.business_partners;
CREATE POLICY business_partners_owner ON app.business_partners
  FOR ALL
  USING (user_id = next_auth.uid())
  WITH CHECK (user_id = next_auth.uid());

DROP POLICY IF EXISTS whatsapp_groups_owner ON app.whatsapp_groups;
CREATE POLICY whatsapp_groups_owner ON app.whatsapp_groups
  FOR ALL
  USING (user_id = next_auth.uid())
  WITH CHECK (user_id = next_auth.uid());

DROP POLICY IF EXISTS message_rules_owner ON app.message_rules;
CREATE POLICY message_rules_owner ON app.message_rules
  FOR ALL
  USING (user_id = next_auth.uid())
  WITH CHECK (user_id = next_auth.uid());

DROP POLICY IF EXISTS messages_received_owner ON app.messages_received;
CREATE POLICY messages_received_owner ON app.messages_received
  FOR ALL
  USING (user_id = next_auth.uid())
  WITH CHECK (user_id = next_auth.uid());

GRANT ALL ON TABLE app.business_partners TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE app.business_partners TO authenticated;

GRANT ALL ON TABLE app.whatsapp_groups TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE app.whatsapp_groups TO authenticated;

GRANT ALL ON TABLE app.message_rules TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE app.message_rules TO authenticated;

GRANT ALL ON TABLE app.messages_received TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE app.messages_received TO authenticated;
