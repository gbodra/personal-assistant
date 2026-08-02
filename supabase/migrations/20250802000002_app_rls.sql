-- RLS policies for app schema (defense in depth)

ALTER TABLE app.boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.lanes ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.card_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.activity_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.important_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.whatsapp_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.message_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.messages_received ENABLE ROW LEVEL SECURITY;

CREATE POLICY boards_owner ON app.boards
  FOR ALL
  USING (user_id = next_auth.uid())
  WITH CHECK (user_id = next_auth.uid());

CREATE POLICY lanes_owner ON app.lanes
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM app.boards b
      WHERE b.id = lanes.board_id AND b.user_id = next_auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM app.boards b
      WHERE b.id = lanes.board_id AND b.user_id = next_auth.uid()
    )
  );

CREATE POLICY cards_owner ON app.cards
  FOR ALL
  USING (user_id = next_auth.uid())
  WITH CHECK (user_id = next_auth.uid());

CREATE POLICY tags_owner ON app.tags
  FOR ALL
  USING (user_id = next_auth.uid())
  WITH CHECK (user_id = next_auth.uid());

CREATE POLICY card_tags_owner ON app.card_tags
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM app.cards c
      WHERE c.id = card_tags.card_id AND c.user_id = next_auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM app.cards c
      WHERE c.id = card_tags.card_id AND c.user_id = next_auth.uid()
    )
  );

CREATE POLICY activity_owner ON app.activity_events
  FOR ALL
  USING (user_id = next_auth.uid())
  WITH CHECK (user_id = next_auth.uid());

CREATE POLICY important_contacts_owner ON app.important_contacts
  FOR ALL
  USING (user_id = next_auth.uid())
  WITH CHECK (user_id = next_auth.uid());

CREATE POLICY whatsapp_groups_owner ON app.whatsapp_groups
  FOR ALL
  USING (user_id = next_auth.uid())
  WITH CHECK (user_id = next_auth.uid());

CREATE POLICY message_rules_owner ON app.message_rules
  FOR ALL
  USING (user_id = next_auth.uid())
  WITH CHECK (user_id = next_auth.uid());

CREATE POLICY messages_received_owner ON app.messages_received
  FOR ALL
  USING (user_id = next_auth.uid())
  WITH CHECK (user_id = next_auth.uid());
