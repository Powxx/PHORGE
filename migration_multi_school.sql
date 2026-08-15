-- 1. Table des Ecoles
CREATE TABLE IF NOT EXISTS schools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  logo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Ajout de school_id à la table profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE SET NULL;

-- Index pour accélérer les jointures multi-tenant
CREATE INDEX IF NOT EXISTS idx_profiles_school_id ON profiles(school_id);

-- 3. Insertion d'une école par défaut si elle n'existe pas
INSERT INTO schools (name) VALUES ('CFA Alès') ON CONFLICT (name) DO NOTHING;

-- 4. Attribution de l'école par défaut aux profils existants qui n'en ont pas
UPDATE profiles 
SET school_id = (SELECT id FROM schools WHERE name = 'CFA Alès' LIMIT 1)
WHERE school_id IS NULL;

-- 5. Mise à jour de la fonction de protection prevents_self_approve pour inclure la validation de school_id
CREATE OR REPLACE FUNCTION prevent_self_approve()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_approved IS DISTINCT FROM OLD.is_approved THEN
    IF NOT EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
        AND role = 'admin_cfa' 
        AND (school_id = NEW.school_id OR school_id IS NULL)
    ) THEN
      RAISE EXCEPTION 'Seul un admin CFA de la même école peut modifier is_approved';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 6. REECRITURE DES POLITIQUES RLS PAR ECOLE

-- PROFILES
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
CREATE POLICY "Public profiles are viewable by everyone" ON profiles FOR SELECT USING (
  id = auth.uid() OR (
    EXISTS (
      SELECT 1 FROM profiles AS self
      WHERE self.id = auth.uid() AND self.school_id = profiles.school_id
    )
  )
);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (
  auth.uid() = id OR (
    EXISTS (
      SELECT 1 FROM profiles AS p
      WHERE p.id = auth.uid() AND p.role = 'admin_cfa' AND p.school_id = profiles.school_id
    )
  )
);

DROP POLICY IF EXISTS "Admin can delete profiles" ON profiles;
CREATE POLICY "Admin can delete profiles" ON profiles FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM profiles AS admin
    WHERE admin.id = auth.uid() AND admin.role = 'admin_cfa' AND admin.school_id = profiles.school_id
  )
);

-- APPRENTIS DETAILS
DROP POLICY IF EXISTS "Public apprentis are viewable by everyone" ON apprentis_details;
CREATE POLICY "Public apprentis are viewable by everyone" ON apprentis_details FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM profiles AS self
    JOIN profiles AS target ON target.id = apprentis_details.profile_id
    WHERE self.id = auth.uid() AND self.school_id = target.school_id
  )
);

-- PATRONS DETAILS
DROP POLICY IF EXISTS "Public patrons are viewable by everyone" ON patrons_details;
CREATE POLICY "Public patrons are viewable by everyone" ON patrons_details FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM profiles AS self
    JOIN profiles AS target ON target.id = patrons_details.profile_id
    WHERE self.id = auth.uid() AND self.school_id = target.school_id
  )
);

-- SWIPES
DROP POLICY IF EXISTS "Approved users can insert own swipes" ON swipes;
CREATE POLICY "Approved users can insert own swipes" ON swipes FOR INSERT WITH CHECK (
  auth.uid() = de_profile_id
  AND EXISTS (
    SELECT 1 FROM profiles AS self
    JOIN profiles AS target ON target.id = vers_profile_id
    WHERE self.id = auth.uid() AND self.is_approved = true AND self.school_id = target.school_id
  )
);

DROP POLICY IF EXISTS "Users and admin can view swipes" ON swipes;
CREATE POLICY "Users and admin can view swipes" ON swipes FOR SELECT USING (
  auth.uid() = de_profile_id OR 
  auth.uid() = vers_profile_id OR 
  EXISTS (
    SELECT 1 FROM profiles AS admin
    JOIN profiles AS de ON de.id = de_profile_id
    WHERE admin.id = auth.uid() AND admin.role = 'admin_cfa' AND admin.school_id = de.school_id
  )
);

-- MATCHES
DROP POLICY IF EXISTS "Participants can view their matches" ON matches;
CREATE POLICY "Participants can view their matches" ON matches FOR SELECT USING (
  auth.uid() = apprenti_id OR 
  auth.uid() = patron_id OR
  EXISTS (
    SELECT 1 FROM profiles AS admin
    JOIN profiles AS app ON app.id = apprenti_id
    WHERE admin.id = auth.uid() AND admin.role = 'admin_cfa' AND admin.school_id = app.school_id
  )
);

-- MESSAGES
DROP POLICY IF EXISTS "Participants can view messages" ON messages;
CREATE POLICY "Participants can view messages" ON messages FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM matches WHERE matches.id = messages.match_id AND (matches.apprenti_id = auth.uid() OR matches.patron_id = auth.uid())
  ) OR EXISTS (
    SELECT 1 FROM profiles AS admin
    JOIN matches AS m ON m.id = messages.match_id
    JOIN profiles AS app ON app.id = m.apprenti_id
    WHERE admin.id = auth.uid() AND admin.role = 'admin_cfa' AND admin.school_id = app.school_id
  )
);

-- STORAGE BUCKET DELETE FOR ADMINS BY SCHOOL
DROP POLICY IF EXISTS "photos_delete" ON storage.objects;
CREATE POLICY "photos_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'photos'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR EXISTS (
      SELECT 1 FROM public.profiles AS admin
      JOIN public.profiles AS target ON target.id::text = (storage.foldername(name))[1]
      WHERE admin.id = auth.uid() AND admin.role = 'admin_cfa' AND admin.school_id = target.school_id
    )
  )
);
