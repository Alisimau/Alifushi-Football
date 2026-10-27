-- Run once in Supabase SQL Editor before using League 2.
-- Existing rows have league_id NULL and continue to appear as League 1.
ALTER TABLE public."Players"
  ADD COLUMN IF NOT EXISTS league_id text;

ALTER TABLE public.player_match_records
  ADD COLUMN IF NOT EXISTS league_id text;

CREATE INDEX IF NOT EXISTS players_league_id_idx
  ON public."Players" (league_id);

CREATE INDEX IF NOT EXISTS player_match_records_league_id_idx
  ON public.player_match_records (league_id);

-- New League 2 players and records are saved with league_id = 'league2'.
-- Existing League 1 rows remain NULL so no data migration is required.
