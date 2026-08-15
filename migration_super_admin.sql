-- 0. AJOUT DE LA VALEUR 'super_admin' A L'ENUM EXISTANT user_role
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'super_admin';

-- 1. MISE A JOUR DU TRIGGER DE PROTECTION CONTRE L'AUTO-APPROBATION ET RESTRICTION DE PROMOTION
CREATE OR REPLACE FUNCTION prevent_self_approve()
RETURNS TRIGGER AS $$
DECLARE
  current_user_role TEXT;
  current_user_school UUID;
BEGIN
  -- Empêcher l'auto-approbation dans tous les cas
  IF auth.uid() = NEW.id AND NEW.is_approved = true AND OLD.is_approved = false THEN
    RAISE EXCEPTION 'Interdiction de s''auto-approuver';
  END IF;

  IF NEW.is_approved IS DISTINCT FROM OLD.is_approved THEN
    -- Récupérer le rôle et l'école de l'utilisateur actuel qui effectue la modification
    SELECT role, school_id INTO current_user_role, current_user_school
    FROM public.profiles
    WHERE id = auth.uid();

    -- Si l'utilisateur actuel est super_admin, il a tous les droits de validation
    IF current_user_role = 'super_admin' THEN
      RETURN NEW;
    END IF;

    -- Si l'utilisateur actuel est admin_cfa
    IF current_user_role = 'admin_cfa' THEN
      -- Un admin de CFA peut uniquement valider les apprentis et patrons de son école
      IF NEW.role IN ('apprenti', 'patron') AND NEW.school_id = current_user_school THEN
        RETURN NEW;
      END IF;
      RAISE EXCEPTION 'Droit insuffisant : les administrateurs CFA ne peuvent valider que les apprentis et les patrons de leur propre école';
    END IF;

    -- Tout autre rôle n'a aucun droit de modification sur is_approved
    RAISE EXCEPTION 'Droit insuffisant pour modifier le statut d''approbation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. REECRITURE DES POLITIQUES RLS POUR INTEGRER LE SUPER_ADMIN

-- PROFILES
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles FOR SELECT USING (
  id = auth.uid() OR (
    EXISTS (
      SELECT 1 FROM public.profiles AS self
      WHERE self.id = auth.uid() AND (self.school_id = profiles.school_id OR self.role = 'super_admin')
    )
  )
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
  EXISTS (
    SELECT 1 FROM public.profiles AS admin
    WHERE admin.id = auth.uid() AND ((admin.role = 'admin_cfa' AND admin.school_id = profiles.school_id) OR admin.role = 'super_admin')
  )
);

-- APPRENTIS DETAILS
DROP POLICY IF EXISTS "Public apprentis are viewable by everyone" ON public.apprentis_details;
CREATE POLICY "Public apprentis are viewable by everyone" ON public.apprentis_details FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.profiles AS self
    JOIN public.profiles AS target ON target.id = apprentis_details.profile_id
    WHERE self.id = auth.uid() AND (self.school_id = target.school_id OR self.role = 'super_admin')
  )
);

-- PATRONS DETAILS
DROP POLICY IF EXISTS "Public patrons are viewable by everyone" ON public.patrons_details;
CREATE POLICY "Public patrons are viewable by everyone" ON public.patrons_details FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.profiles AS self
    JOIN public.profiles AS target ON target.id = patrons_details.profile_id
    WHERE self.id = auth.uid() AND (self.school_id = target.school_id OR self.role = 'super_admin')
  )
);

-- SWIPES
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

-- MATCHES
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

-- MESSAGES
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

-- STORAGE BUCKET DELETE
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
      WHERE admin.id = auth.uid() AND ((admin.role = 'admin_cfa' AND admin.school_id = target.school_id) OR admin.role = 'super_admin')
    )
  )
);
