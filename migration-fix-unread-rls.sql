-- Migration: Résoudre le problème d'actualisation des messages non lus
-- À exécuter dans le SQL Editor de Supabase (https://supabase.com/dashboard/project/zdybrtqcvgrewprewfbw/sql/new)

-- 1. S'assurer que le RLS est activé
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- 2. Supprimer les anciennes politiques UPDATE potentiellement en conflit ou manquantes
DROP POLICY IF EXISTS "Participants can update messages" ON messages;
DROP POLICY IF EXISTS "Users can update own messages" ON messages;
DROP POLICY IF EXISTS "Users can update messages" ON messages;

-- 3. Créer la politique autorisant les participants du match à mettre à jour les messages (marquer comme lu)
CREATE POLICY "Participants can update messages" ON messages 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM matches 
    WHERE matches.id = messages.match_id 
    AND (matches.apprenti_id = auth.uid() OR matches.patron_id = auth.uid())
  )
);
