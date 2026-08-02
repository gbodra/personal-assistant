-- Require user_id on ingest so n8n/service_role cannot leave unscoped messages.
-- Orphan rows without an owner cannot be attributed safely; drop them first.

DELETE FROM app.messages_received WHERE user_id IS NULL;

ALTER TABLE app.messages_received
  ALTER COLUMN user_id SET NOT NULL;
