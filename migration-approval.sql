-- Migration: bloquer le swipe tant que le profil n'est pas validé par un admin CFA
-- À exécuter dans le SQL Editor Supabase du projet PHORGE

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT false;

-- Remplace la policy d'insert swipe
DROP POLICY IF EXISTS "Users can insert own swipes" ON swipes;
DROP POLICY IF EXISTS "Approved users can insert own swipes" ON swipes;

CREATE POLICY "Approved users can insert own swipes" ON swipes FOR INSERT WITH CHECK (
  auth.uid() = de_profile_id
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.is_approved = true
  )
);

-- Empêche un utilisateur de s'auto-valider
CREATE OR REPLACE FUNCTION prevent_self_approve()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_approved IS DISTINCT FROM OLD.is_approved THEN
    IF NOT EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin_cfa'
    ) THEN
      RAISE EXCEPTION 'Seul un admin CFA peut modifier is_approved';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_prevent_self_approve ON profiles;
CREATE TRIGGER trg_prevent_self_approve
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION prevent_self_approve();
