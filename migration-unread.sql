-- Migration: Ajouter le suivi de lecture des messages (non-destructif)
-- À exécuter dans le SQL Editor Supabase de votre projet PHORGE

ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT false;

DROP POLICY IF EXISTS "Participants can update messages" ON messages;
CREATE POLICY "Participants can update messages" ON messages FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM matches WHERE matches.id = messages.match_id AND (matches.apprenti_id = auth.uid() OR matches.patron_id = auth.uid())
  )
);
