-- ==============================================================================
-- SCHEMA OFFICIEL PHORGE - CONSOLIDÉ & COMPLET
-- Plateforme de mise en relation Patrons / Apprentis
-- Multi-structures (CFA / Écoles) avec Super-Administrateurs & Administrateurs de structure
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. ENUMÉRATIONS
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM ('apprenti', 'patron', 'admin_cfa', 'super_admin');
  ELSE
    ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'super_admin';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'match_status') THEN
    CREATE TYPE match_status AS ENUM ('actif', 'essai_demande', 'contrat_demande', 'archive');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'swipe_type') THEN
    CREATE TYPE swipe_type AS ENUM ('like', 'dislike', 'superlike');
  END IF;
END $$;

-- 3. TABLES PRINCIPALES

-- 3.1 Structures / Écoles / CFA
CREATE TABLE IF NOT EXISTS schools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  logo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insertion de la structure par défaut si non existante
INSERT INTO schools (name) VALUES ('CFA Alès') ON CONFLICT (name) DO NOTHING;

-- 3.2 Profils utilisateurs
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  role user_role NOT NULL,
  school_id UUID REFERENCES schools(id) ON DELETE SET NULL,
  is_approved BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_profiles_school_id ON profiles(school_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- 3.3 Détails Apprentis
CREATE TABLE IF NOT EXISTS apprentis_details (
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

-- 3.4 Détails Patrons (Entreprises)
CREATE TABLE IF NOT EXISTS patrons_details (
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

-- 3.5 Swipes
CREATE TABLE IF NOT EXISTS swipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  de_profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  vers_profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  type swipe_type NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (de_profile_id, vers_profile_id)
);

-- 3.6 Matches
CREATE TABLE IF NOT EXISTS matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  apprenti_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  patron_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  statut match_status DEFAULT 'actif',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (apprenti_id, patron_id)
);

-- 3.7 Messages
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID REFERENCES matches(id) ON DELETE CASCADE NOT NULL,
  expediteur_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  texte TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_messages_match_id ON messages(match_id);

-- 3.8 Abonnements Web Push
CREATE TABLE IF NOT EXISTS user_push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  subscription JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_user_subscription UNIQUE (user_id, subscription)
);

-- 4. FONCTIONS SÉCURISÉES & TRIGGERS

-- Trigger: Protection auto-approbation & validation de statut
CREATE OR REPLACE FUNCTION prevent_self_approve()
RETURNS TRIGGER AS $$
DECLARE
  current_user_role TEXT;
  current_user_school UUID;
BEGIN
  IF auth.uid() = NEW.id AND NEW.is_approved = true AND OLD.is_approved = false THEN
    RAISE EXCEPTION 'Interdiction de s''auto-approuver';
  END IF;

  IF NEW.is_approved IS DISTINCT FROM OLD.is_approved THEN
    SELECT role, school_id INTO current_user_role, current_user_school
    FROM public.profiles
    WHERE id = auth.uid();

    IF current_user_role = 'super_admin' THEN
      RETURN NEW;
    END IF;

    IF current_user_role = 'admin_cfa' THEN
      IF NEW.role IN ('apprenti', 'patron') AND NEW.school_id = current_user_school THEN
        RETURN NEW;
      END IF;
      RAISE EXCEPTION 'Droit insuffisant : les administrateurs CFA ne peuvent valider que les apprentis et patrons de leur propre établissement';
    END IF;

    RAISE EXCEPTION 'Droit insuffisant pour modifier le statut d''approbation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_prevent_self_approve ON profiles;
CREATE TRIGGER trg_prevent_self_approve
BEFORE UPDATE ON profiles
FOR EACH ROW
EXECUTE FUNCTION prevent_self_approve();

-- RPC: Récupération des abonnements push
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

-- RPC: Suppression d'un abonnement push invalide
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

-- 5. ROW LEVEL SECURITY (RLS)

-- 5.1 Schools (Accessible publiquement en lecture pour sélection à l'inscription)
ALTER TABLE public.schools DISABLE ROW LEVEL SECURITY;

-- 5.2 Profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles FOR SELECT USING (
  id = auth.uid() OR (
    EXISTS (
      SELECT 1 FROM public.profiles AS self
      WHERE self.id = auth.uid() AND (self.school_id = profiles.school_id OR self.role = 'super_admin')
    )
  )
);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (
  auth.uid() = id
);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (
  auth.uid() = id OR (
    EXISTS (
      SELECT 1 FROM public.profiles AS self
      WHERE self.id = auth.uid() AND ((self.role = 'admin_cfa' AND self.school_id = profiles.school_id) OR self.role = 'super_admin')
    )
  )
);

DROP POLICY IF EXISTS "Admin can delete profiles" ON public.profiles;
CREATE POLICY "Admin can delete profiles" ON public.profiles FOR DELETE USING (
  auth.uid() = id OR (
    EXISTS (
      SELECT 1 FROM public.profiles AS admin
      WHERE admin.id = auth.uid() AND ((admin.role = 'admin_cfa' AND admin.school_id = profiles.school_id) OR admin.role = 'super_admin')
    )
  )
);

-- 5.3 Apprentis Details
ALTER TABLE public.apprentis_details ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public apprentis are viewable by everyone" ON public.apprentis_details;
CREATE POLICY "Public apprentis are viewable by everyone" ON public.apprentis_details FOR SELECT USING (
  profile_id = auth.uid() OR (
    EXISTS (
      SELECT 1 FROM public.profiles AS self
      JOIN public.profiles AS target ON target.id = apprentis_details.profile_id
      WHERE self.id = auth.uid() AND (self.school_id = target.school_id OR self.role = 'super_admin')
    )
  )
);

DROP POLICY IF EXISTS "Users can insert own apprenti details" ON public.apprentis_details;
CREATE POLICY "Users can insert own apprenti details" ON public.apprentis_details FOR INSERT WITH CHECK (
  auth.uid() = profile_id
);

DROP POLICY IF EXISTS "Users can update own apprenti details" ON public.apprentis_details;
CREATE POLICY "Users can update own apprenti details" ON public.apprentis_details FOR UPDATE USING (
  auth.uid() = profile_id OR (
    EXISTS (
      SELECT 1 FROM public.profiles AS self
      JOIN public.profiles AS target ON target.id = apprentis_details.profile_id
      WHERE self.id = auth.uid() AND ((self.role = 'admin_cfa' AND self.school_id = target.school_id) OR self.role = 'super_admin')
    )
  )
);

-- 5.4 Patrons Details
ALTER TABLE public.patrons_details ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public patrons are viewable by everyone" ON public.patrons_details;
CREATE POLICY "Public patrons are viewable by everyone" ON public.patrons_details FOR SELECT USING (
  profile_id = auth.uid() OR (
    EXISTS (
      SELECT 1 FROM public.profiles AS self
      JOIN public.profiles AS target ON target.id = patrons_details.profile_id
      WHERE self.id = auth.uid() AND (self.school_id = target.school_id OR self.role = 'super_admin')
    )
  )
);

DROP POLICY IF EXISTS "Users can insert own patron details" ON public.patrons_details;
CREATE POLICY "Users can insert own patron details" ON public.patrons_details FOR INSERT WITH CHECK (
  auth.uid() = profile_id
);

DROP POLICY IF EXISTS "Users can update own patron details" ON public.patrons_details;
CREATE POLICY "Users can update own patron details" ON public.patrons_details FOR UPDATE USING (
  auth.uid() = profile_id OR (
    EXISTS (
      SELECT 1 FROM public.profiles AS self
      JOIN public.profiles AS target ON target.id = patrons_details.profile_id
      WHERE self.id = auth.uid() AND ((self.role = 'admin_cfa' AND self.school_id = target.school_id) OR self.role = 'super_admin')
    )
  )
);

-- 5.5 Swipes
ALTER TABLE public.swipes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users and admin can view swipes" ON public.swipes;
CREATE POLICY "Users and admin can view swipes" ON public.swipes FOR SELECT USING (
  auth.uid() = de_profile_id OR 
  auth.uid() = vers_profile_id OR 
  EXISTS (
    SELECT 1 FROM public.profiles AS admin
    JOIN public.profiles AS de ON de.id = de_profile_id
    WHERE admin.id = auth.uid() AND ((admin.role = 'admin_cfa' AND admin.school_id = de.school_id) OR admin.role = 'super_admin')
  )
);

DROP POLICY IF EXISTS "Approved users can insert own swipes" ON public.swipes;
CREATE POLICY "Approved users can insert own swipes" ON public.swipes FOR INSERT WITH CHECK (
  auth.uid() = de_profile_id
  AND EXISTS (
    SELECT 1 FROM public.profiles AS self
    JOIN public.profiles AS target ON target.id = vers_profile_id
    WHERE self.id = auth.uid() AND self.is_approved = true AND (self.school_id = target.school_id OR self.role = 'super_admin')
  )
);

-- 5.6 Matches
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Participants can view their matches" ON public.matches;
CREATE POLICY "Participants can view their matches" ON public.matches FOR SELECT USING (
  auth.uid() = apprenti_id OR 
  auth.uid() = patron_id OR
  EXISTS (
    SELECT 1 FROM public.profiles AS admin
    JOIN public.profiles AS app ON app.id = apprenti_id
    WHERE admin.id = auth.uid() AND ((admin.role = 'admin_cfa' AND admin.school_id = app.school_id) OR admin.role = 'super_admin')
  )
);

DROP POLICY IF EXISTS "Participants can insert matches" ON public.matches;
CREATE POLICY "Participants can insert matches" ON public.matches FOR INSERT WITH CHECK (
  auth.uid() = apprenti_id OR auth.uid() = patron_id
);

DROP POLICY IF EXISTS "Participants and admin can update matches" ON public.matches;
CREATE POLICY "Participants and admin can update matches" ON public.matches FOR UPDATE USING (
  auth.uid() = apprenti_id OR auth.uid() = patron_id OR
  EXISTS (
    SELECT 1 FROM public.profiles AS admin
    JOIN public.profiles AS app ON app.id = apprenti_id
    WHERE admin.id = auth.uid() AND ((admin.role = 'admin_cfa' AND admin.school_id = app.school_id) OR admin.role = 'super_admin')
  )
);

-- 5.7 Messages
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Participants can view messages" ON public.messages;
CREATE POLICY "Participants can view messages" ON public.messages FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.matches WHERE matches.id = messages.match_id AND (matches.apprenti_id = auth.uid() OR matches.patron_id = auth.uid())
  ) OR EXISTS (
    SELECT 1 FROM public.profiles AS admin
    JOIN public.matches AS m ON m.id = messages.match_id
    JOIN public.profiles AS app ON app.id = m.apprenti_id
    WHERE admin.id = auth.uid() AND ((admin.role = 'admin_cfa' AND admin.school_id = app.school_id) OR admin.role = 'super_admin')
  )
);

DROP POLICY IF EXISTS "Participants can insert messages" ON public.messages;
CREATE POLICY "Participants can insert messages" ON public.messages FOR INSERT WITH CHECK (
  auth.uid() = expediteur_id
  AND EXISTS (
    SELECT 1 FROM public.matches
    WHERE matches.id = messages.match_id
      AND (matches.apprenti_id = auth.uid() OR matches.patron_id = auth.uid())
  )
);

-- 5.8 Web Push Subscriptions
ALTER TABLE public.user_push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert their own push subscriptions" ON user_push_subscriptions;
CREATE POLICY "Users can insert their own push subscriptions" ON user_push_subscriptions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their own push subscriptions" ON user_push_subscriptions;
CREATE POLICY "Users can view their own push subscriptions" ON user_push_subscriptions
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own push subscriptions" ON user_push_subscriptions;
CREATE POLICY "Users can delete their own push subscriptions" ON user_push_subscriptions
  FOR DELETE USING (auth.uid() = user_id);
