-- Migration: Ajouter le suivi de lecture des messages (non-destructif)
-- À exécuter dans le SQL Editor Supabase de votre projet PHORGE

ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT false;
