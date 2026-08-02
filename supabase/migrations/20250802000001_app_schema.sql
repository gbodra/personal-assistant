-- App schema: kanban, contacts, message rules, WhatsApp ingest

CREATE SCHEMA IF NOT EXISTS app;

GRANT USAGE ON SCHEMA app TO postgres, service_role, anon, authenticated;
GRANT ALL ON SCHEMA app TO postgres, service_role;

CREATE TABLE app.boards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES next_auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, slug)
);

CREATE TABLE app.lanes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id uuid NOT NULL REFERENCES app.boards(id) ON DELETE CASCADE,
  key text NOT NULL CHECK (key IN ('todo', 'doing', 'done', 'canceled')),
  name text NOT NULL,
  position int NOT NULL,
  UNIQUE (board_id, key)
);

CREATE TABLE app.cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id uuid NOT NULL REFERENCES app.boards(id) ON DELETE CASCADE,
  lane_id uuid NOT NULL REFERENCES app.lanes(id),
  user_id uuid NOT NULL REFERENCES next_auth.users(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  description text,
  due_at timestamptz,
  position numeric NOT NULL,
  priority text NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('critical', 'high', 'normal', 'low')),
  source_message_id uuid,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX cards_lane_position_active_idx
  ON app.cards (lane_id, position)
  WHERE archived_at IS NULL;

CREATE INDEX cards_user_archived_idx
  ON app.cards (user_id, archived_at);

CREATE INDEX cards_board_idx ON app.cards (board_id);

CREATE TABLE app.tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES next_auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text,
  UNIQUE (user_id, name)
);

CREATE TABLE app.card_tags (
  card_id uuid NOT NULL REFERENCES app.cards(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES app.tags(id) ON DELETE CASCADE,
  PRIMARY KEY (card_id, tag_id)
);

CREATE TABLE app.activity_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES next_auth.users(id) ON DELETE CASCADE,
  board_id uuid REFERENCES app.boards(id) ON DELETE SET NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  action text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX activity_user_created_idx
  ON app.activity_events (user_id, created_at DESC);

CREATE INDEX activity_entity_idx
  ON app.activity_events (entity_type, entity_id);

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

CREATE TABLE app.whatsapp_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES next_auth.users(id) ON DELETE CASCADE,
  external_group_id text NOT NULL,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 200),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, external_group_id)
);

CREATE INDEX whatsapp_groups_user_idx
  ON app.whatsapp_groups (user_id, name);

CREATE TABLE app.message_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES next_auth.users(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 200),
  enabled boolean NOT NULL DEFAULT true,
  position int NOT NULL,
  schema_version int NOT NULL DEFAULT 3,
  conditions jsonb NOT NULL DEFAULT '[]'::jsonb,
  actions jsonb NOT NULL,
  is_catch_all boolean NOT NULL DEFAULT false,
  source_utterance text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, position)
);

CREATE INDEX message_rules_user_enabled_position_idx
  ON app.message_rules (user_id, enabled, position);

CREATE TABLE app.messages_received (
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
  was_mentioned boolean NOT NULL DEFAULT true,
  user_id uuid NOT NULL REFERENCES next_auth.users(id) ON DELETE CASCADE,
  matched_rule_id uuid REFERENCES app.message_rules(id) ON DELETE SET NULL,
  card_id uuid REFERENCES app.cards(id) ON DELETE SET NULL,
  classification jsonb NOT NULL DEFAULT '{}'::jsonb,
  processed_at timestamptz
);

CREATE INDEX messages_received_user_processed_idx
  ON app.messages_received (user_id, processed, created_at DESC);

CREATE INDEX messages_received_matched_rule_idx
  ON app.messages_received (matched_rule_id);

ALTER TABLE app.cards
  ADD CONSTRAINT cards_source_message_id_fkey
  FOREIGN KEY (source_message_id) REFERENCES app.messages_received(id) ON DELETE SET NULL;

CREATE INDEX cards_source_message_idx
  ON app.cards (source_message_id)
  WHERE source_message_id IS NOT NULL;

CREATE OR REPLACE FUNCTION app.normalize_phone(raw text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT NULLIF(regexp_replace(coalesce(raw, ''), '[^0-9]', '', 'g'), '');
$$;

GRANT EXECUTE ON FUNCTION app.normalize_phone(text) TO postgres, service_role, authenticated;

GRANT ALL ON ALL TABLES IN SCHEMA app TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA app TO authenticated;
