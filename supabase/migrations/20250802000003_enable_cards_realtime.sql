-- Enable Realtime postgres_changes for app.cards (INSERT events for Focus board)

ALTER PUBLICATION supabase_realtime ADD TABLE app.cards;
