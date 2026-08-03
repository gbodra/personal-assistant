-- Add inbox lane for unmatched WhatsApp messages (n8n fallback)

ALTER TABLE app.lanes DROP CONSTRAINT IF EXISTS lanes_key_check;

ALTER TABLE app.lanes
  ADD CONSTRAINT lanes_key_check
  CHECK (key IN ('inbox', 'todo', 'doing', 'done', 'canceled'));

-- Make room for inbox as first column only on boards that do not have it yet
UPDATE app.lanes AS l
SET position = position + 1
WHERE NOT EXISTS (
  SELECT 1 FROM app.lanes AS i
  WHERE i.board_id = l.board_id AND i.key = 'inbox'
);

INSERT INTO app.lanes (board_id, key, name, position)
SELECT b.id, 'inbox', 'Inbox', 0
FROM app.boards b
WHERE NOT EXISTS (
  SELECT 1 FROM app.lanes l WHERE l.board_id = b.id AND l.key = 'inbox'
);
