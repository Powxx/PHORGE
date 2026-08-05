-- Migration: Créer la table des abonnements push et la fonction RPC sécurisée
-- À exécuter dans le SQL Editor Supabase de votre projet PHORGE

CREATE TABLE IF NOT EXISTS user_push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  subscription JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_user_subscription UNIQUE (user_id, subscription)
);

ALTER TABLE user_push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Politiques RLS
DROP POLICY IF EXISTS "Users can insert their own push subscriptions" ON user_push_subscriptions;
CREATE POLICY "Users can insert their own push subscriptions" ON user_push_subscriptions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their own push subscriptions" ON user_push_subscriptions;
CREATE POLICY "Users can view their own push subscriptions" ON user_push_subscriptions
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own push subscriptions" ON user_push_subscriptions;
CREATE POLICY "Users can delete their own push subscriptions" ON user_push_subscriptions
  FOR DELETE USING (auth.uid() = user_id);

-- Fonction de contournement RLS (SECURITY DEFINER) pour récupérer les abonnements côté serveur
CREATE OR REPLACE FUNCTION get_user_subscriptions(target_user_id UUID)
RETURNS SETOF user_push_subscriptions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY SELECT * FROM user_push_subscriptions WHERE user_id = target_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION delete_push_subscription(sub_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM user_push_subscriptions WHERE id = sub_id;
END;
$$;
