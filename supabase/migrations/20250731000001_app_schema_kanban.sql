-- App schema: kanban boards, lanes, cards, tags, activity

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

GRANT ALL ON ALL TABLES IN SCHEMA app TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA app TO authenticated;
