-- Clean up existant (ATTENTION : Ceci supprime les données de ces tables lors de la ré-exécution)
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS matches CASCADE;
DROP TABLE IF EXISTS swipes CASCADE;
DROP TABLE IF EXISTS patrons_details CASCADE;
DROP TABLE IF EXISTS apprentis_details CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP TYPE IF EXISTS swipe_type CASCADE;
DROP TYPE IF EXISTS match_status CASCADE;
DROP TYPE IF EXISTS user_role CASCADE;

-- Active l'extension pour les UUIDs si nécessaire (souvent par défaut)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enumérations
CREATE TYPE user_role AS ENUM ('apprenti', 'patron', 'admin_cfa');
CREATE TYPE match_status AS ENUM ('actif', 'essai_demande', 'contrat_demande', 'archive');
CREATE TYPE swipe_type AS ENUM ('like', 'dislike', 'superlike');

-- TABLES

-- 1. Profils (Lié à auth.users)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  role user_role NOT NULL,
  is_approved BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Détails Apprentis
CREATE TABLE apprentis_details (
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE PRIMARY KEY,
  nom TEXT NOT NULL,
  prenom TEXT NOT NULL,
  domaine TEXT NOT NULL CHECK (domaine IN ('coiffure', 'esthetique')),
  specialites TEXT[] DEFAULT '{}',
  bio TEXT,
  adresse TEXT,
  photo_profil TEXT,
  book_photos TEXT[] DEFAULT '{}',
  age INT,
  moyen_transport TEXT,
  stage_effectue TEXT,
  experience_apprentissage TEXT,
  autre_experience TEXT,
  experience_pro TEXT,
  diplome_souhaite TEXT,
  diplome_acquis TEXT,
  motivation TEXT,
  latitude FLOAT,
  longitude FLOAT,
  distance_max INT DEFAULT 50
);

-- 3. Détails Patrons (Salons / Instituts)
CREATE TABLE patrons_details (
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE PRIMARY KEY,
  nom_entreprise TEXT NOT NULL,
  domaine TEXT NOT NULL CHECK (domaine IN ('coiffure', 'esthetique')),
  adresse TEXT,
  latitude FLOAT,
  longitude FLOAT,
  photo_profil TEXT,
  presentation TEXT,
  diplome_recherche TEXT,
  besoins TEXT[] DEFAULT '{}',
  distance_max INT DEFAULT 50
);

-- 4. Swipes (Historique des interactions)
CREATE TABLE swipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  de_profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  vers_profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  type swipe_type NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (de_profile_id, vers_profile_id)
);

-- 5. Matches (Quand un Apprenti et un Patron "like" mutuellement)
CREATE TABLE matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  apprenti_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  patron_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  statut match_status DEFAULT 'actif',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (apprenti_id, patron_id)
);

-- 6. Messages (Chat temps réel pour un match)
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID REFERENCES matches(id) ON DELETE CASCADE NOT NULL,
  expediteur_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  texte TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ENABLE ROW LEVEL SECURITY (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE apprentis_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE patrons_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE swipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- POLITIQUES RLS

-- PROFILES
CREATE POLICY "Public profiles are viewable by everyone" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id OR EXISTS (SELECT 1 FROM profiles AS p WHERE p.id = auth.uid() AND p.role = 'admin_cfa'));
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- APPRENTIS DETAILS
CREATE POLICY "Public apprentis are viewable by everyone" ON apprentis_details FOR SELECT USING (true);
CREATE POLICY "Users can update own apprentis details" ON apprentis_details FOR UPDATE USING (auth.uid() = profile_id);
CREATE POLICY "Users can insert own apprentis details" ON apprentis_details FOR INSERT WITH CHECK (auth.uid() = profile_id);

-- PATRONS DETAILS
CREATE POLICY "Public patrons are viewable by everyone" ON patrons_details FOR SELECT USING (true);
CREATE POLICY "Users can update own patrons details" ON patrons_details FOR UPDATE USING (auth.uid() = profile_id);
CREATE POLICY "Users can insert own patrons details" ON patrons_details FOR INSERT WITH CHECK (auth.uid() = profile_id);

-- SWIPES
CREATE POLICY "Users can insert own swipes" ON swipes FOR INSERT WITH CHECK (auth.uid() = de_profile_id);
CREATE POLICY "Users and admin can view swipes" ON swipes FOR SELECT USING (
  auth.uid() = de_profile_id OR 
  auth.uid() = vers_profile_id OR 
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin_cfa')
);

-- MATCHES
CREATE POLICY "Participants can view their matches" ON matches FOR SELECT USING (
  auth.uid() = apprenti_id OR 
  auth.uid() = patron_id OR
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin_cfa')
);
CREATE POLICY "System can create matches" ON matches FOR INSERT WITH CHECK (auth.uid() = apprenti_id OR auth.uid() = patron_id);
CREATE POLICY "Participants can update their matches" ON matches FOR UPDATE USING (auth.uid() = apprenti_id OR auth.uid() = patron_id);

-- MESSAGES
CREATE POLICY "Participants can view messages" ON messages FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM matches WHERE matches.id = messages.match_id AND (matches.apprenti_id = auth.uid() OR matches.patron_id = auth.uid())
  ) OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin_cfa')
);
CREATE POLICY "Participants can insert messages" ON messages FOR INSERT WITH CHECK (
  auth.uid() = expediteur_id AND EXISTS (
    SELECT 1 FROM matches WHERE matches.id = messages.match_id AND (matches.apprenti_id = auth.uid() OR matches.patron_id = auth.uid())
  )
);

-- TRIGGERS
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role)
  VALUES (new.id, new.email, 'apprenti');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- STORAGE BUCKETS & POLICIES
-- Chemins attendus : photos/{auth.uid()}/fichier.ext
INSERT INTO storage.buckets (id, name, public) VALUES ('photos', 'photos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Auth Upload" ON storage.objects;
DROP POLICY IF EXISTS "Auth Update" ON storage.objects;
DROP POLICY IF EXISTS "Auth Delete" ON storage.objects;
DROP POLICY IF EXISTS "photos_select" ON storage.objects;
DROP POLICY IF EXISTS "photos_insert" ON storage.objects;
DROP POLICY IF EXISTS "photos_update" ON storage.objects;
DROP POLICY IF EXISTS "photos_delete" ON storage.objects;

CREATE POLICY "photos_select"
ON storage.objects FOR SELECT
USING (bucket_id = 'photos');

CREATE POLICY "photos_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "photos_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "photos_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
